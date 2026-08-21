"""Payment lifecycle — the money path after checkout.

Three rules this module exists to enforce:

1. **A webhook is untrusted until its signature verifies.** The gateway layer
   answers `signature_valid=False` and nothing here may touch an order.
2. **The same notification delivered twice credits the order once.** Every
   confirmation runs inside one transaction holding a lock on the ORDER row;
   the second delivery finds a COMPLETED payment and changes nothing.
3. **Stock leaves the shelf only on confirmed payment.** Checkout reserves; the
   single decrement point is `confirm_payment()`.

Delivery starts here too: an online order ships when its payment confirms, a
pay-on-delivery order ships when the operator marks its payment collected.
"""

from __future__ import annotations

import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.catalog.models import Product, ProductVariant
from apps.orders.models import (
    Order,
    OrderStatus,
    PaymentMethodConfiguration,
    PaymentStatus,
)

from .models import Payment
from .providers import registry
from .providers.base import InitiationResult, WebhookResult

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    def __init__(self, message, *, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def get_method_config(method_code: str) -> dict:
    row = PaymentMethodConfiguration.objects.filter(method_code=method_code).first()
    if row is None or not row.is_enabled:
        return {}
    return row.config_data or {}


def initiate_payment(*, order: Order, method_code: str, user_input: dict | None = None) -> tuple[Payment, InitiationResult]:
    """Record the intent to pay and ask the gateway how to proceed.

    One live payment per (order, method): re-initiating updates the record
    instead of stacking rows, unless a COMPLETED payment already exists — then
    the initiation is refused outright.
    """
    try:
        gateway = registry.get_gateway(method_code)
    except KeyError as exc:
        raise PaymentError(str(exc), status=404)

    config = get_method_config(method_code)
    result = gateway.initiate(order=order, config=config, user_input=user_input or {})

    with transaction.atomic():
        existing_completed = Payment.objects.select_for_update().filter(
            order=order, method_code=method_code, status=PaymentStatus.COMPLETED
        ).first()
        if existing_completed:
            raise PaymentError("تم تأكيد الدفع لهذا الطلب مسبقاً", status=409)

        payment, _created = Payment.objects.update_or_create(
            order=order,
            method_code=method_code,
            defaults={
                "status": result.next_step,
                "reference_id": result.payment_id or "",
                "provider_payload": {"initiation": result.data},
            },
        )
    return payment, result


def handle_webhook(*, method_code: str, payload: dict, headers: dict) -> WebhookResult:
    """Route a provider notification. An invalid signature never reaches the
    order; a valid one goes through the same idempotent confirmation as any
    other path."""
    try:
        gateway = registry.get_gateway(method_code)
    except KeyError as exc:
        raise PaymentError(str(exc), status=404)

    config = get_method_config(method_code)
    if not config:
        return WebhookResult(success=False, signature_valid=False,
                             message="طريقة الدفع غير مهيّأة")

    result = gateway.handle_webhook(payload, headers, config)
    if not result.signature_valid:
        logger.warning("webhook signature rejected method=%s", method_code)
        return result

    if not result.order_number:
        return result

    if result.status == PaymentStatus.COMPLETED:
        confirm_payment(
            order_number=result.order_number,
            method_code=method_code,
            transaction_id=result.transaction_id or "",
            provider_payload={"webhook": result.raw},
            amount=result.amount,
        )
    else:
        _mark_failed(order_number=result.order_number, method_code=method_code,
                     provider_payload={"webhook": result.raw}, message=result.message)
    return result


@transaction.atomic
def confirm_payment(
    *,
    order_number: str,
    method_code: str,
    transaction_id: str = "",
    provider_payload: dict | None = None,
    amount: Decimal | None = None,
) -> Payment:
    """Mark an order's payment completed — idempotently.

    The ORDER row lock serialises everything racing to credit the same order:
    two webhook deliveries, a webhook and `/checkout/redirect`, an operator and
    a webhook. Whichever arrives second sees the COMPLETED payment and exits
    without side effects.
    """
    order = Order.objects.select_for_update().filter(order_number=order_number).first()
    if order is None:
        raise PaymentError("الطلب غير موجود", status=404)

    already = Payment.objects.filter(
        order=order, method_code=method_code, status=PaymentStatus.COMPLETED
    ).first()

    if already is None:
        payment, _ = Payment.objects.update_or_create(
            order=order,
            method_code=method_code,
            defaults={
                "status": PaymentStatus.COMPLETED,
                "amount": amount if amount is not None else order.total,
                "reference_id": transaction_id,
                "provider_payload": provider_payload or {},
                "verified_at": timezone.now(),
            },
        )
        _decrement_stock(order)
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.PROCESSING
            order.save(update_fields=["status", "updated_at"])
    else:
        payment = already

    # Best-effort shipment creation; a courier outage must not roll back a
    # confirmed payment. Retried from the admin action or the next verify.
    if not order.tracking_number:
        try:
            from apps.delivery.services import start_delivery

            start_delivery(order)
        except Exception:
            logger.exception("shipment creation failed for %s", order.order_number)

    order.refresh_from_db()
    return payment


def _mark_failed(*, order_number: str, method_code: str, provider_payload: dict, message: str) -> None:
    Payment.objects.filter(
        order__order_number=order_number, method_code=method_code
    ).exclude(status=PaymentStatus.COMPLETED).update(
        status=PaymentStatus.FAILED,
        provider_payload={**provider_payload, "failure": message},
        verified_at=timezone.now(),
    )


def _decrement_stock(order: Order) -> None:
    """THE stock decrement point. Reserved at checkout; leaves the shelf now."""
    for item in order.items.select_related("product", "variant"):
        if not item.product.track_quantity:
            continue
        if item.variant_id:
            ProductVariant.objects.filter(pk=item.variant_id).update(
                reserved_stock=F("reserved_stock") - item.quantity,
                stock=F("stock") - item.quantity,
            )
        else:
            Product.objects.filter(pk=item.product_id).update(
                reserved_stock=F("reserved_stock") - item.quantity,
                stock=F("stock") - item.quantity,
            )


def resolve_redirect(*, reference: str) -> dict:
    """State for `/checkout/redirect` — works before AND after the webhook.

    If no confirmed payment exists yet and the gateway can answer remotely,
    ask it right now; that closes the window where the customer returns faster
    than the notification travels.
    """
    order = (
        Order.objects.filter(order_number=reference).first()
        or Order.objects.filter(reference_id=reference).first()
    )
    if order is None:
        raise PaymentError("الطلب غير موجود", status=404)

    payments = list(order.payments.all())
    completed = [p for p in payments if p.status == PaymentStatus.COMPLETED]

    if not completed and payments:
        payment = payments[0]
        try:
            gateway = registry.get_gateway(payment.method_code)
        except KeyError:
            gateway = None
        if gateway is not None:
            config = get_method_config(payment.method_code)
            remote = gateway.verify_remotely(payment=payment, config=config)
            if remote is not None and remote.signature_valid:
                if remote.status == PaymentStatus.COMPLETED and remote.order_number:
                    confirm_payment(
                        order_number=remote.order_number,
                        method_code=payment.method_code,
                        transaction_id=remote.transaction_id or "",
                        provider_payload={"remote_verify": remote.raw},
                    )
                    completed = list(order.payments.filter(status=PaymentStatus.COMPLETED))
                elif remote.status == PaymentStatus.FAILED:
                    _mark_failed(order_number=order.order_number,
                                 method_code=payment.method_code,
                                 provider_payload={"remote_verify": remote.raw},
                                 message=remote.message)
                    payments = list(order.payments.all())

    latest = max(payments + completed, key=lambda p: p.updated_at, default=None)
    return {
        "order_number": order.order_number,
        "status": PaymentStatus.COMPLETED if completed else (latest.status if latest else PaymentStatus.PENDING),
        "tracking_number": order.tracking_number,
        "total": str(order.total),
    }
