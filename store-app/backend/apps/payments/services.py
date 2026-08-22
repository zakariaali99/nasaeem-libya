"""Payment orchestration — the ONLY module that moves money state.

The providers own the wire protocol (hashes, payloads, redirects); this module
owns the store's reaction to them. Three rules govern everything here:

1. **Stock leaves the shelf only on a CONFIRMED payment.** Checkout reserves;
   confirmation converts the reservation into a sale. Nothing before that
   touches `stock`.
2. **A webhook is processed at most once.** The same notification delivered
   twice credits the order once — the second delivery is acknowledged with the
   same outcome but performs no state change.
3. **Every path to "paid" funnels through `_confirm_payment`** — webhook,
   redirect poll, or operator verification — so idempotency cannot drift
   between entry points.
"""

from __future__ import annotations

import logging

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from apps.orders.models import Order, OrderStatus, PaymentStatus

from .models import Payment
from .providers.base import WebhookResult
from .providers.registry import get_gateway

logger = logging.getLogger(__name__)


class PaymentError(Exception):
    def __init__(self, message: str, *, status: int = 409, field: str = ""):
        super().__init__(message)
        self.message = message
        self.status = status
        self.field = field


def get_configuration(method_code: str):
    """The gateway's stored settings. A disabled or unknown method is not a
    500: it is a plain "unavailable" answer, because a customer choosing it is
    a normal state, not an error."""
    from apps.orders.models import PaymentMethodConfiguration

    configuration = PaymentMethodConfiguration.objects.filter(
        method_code=method_code, is_enabled=True
    ).first()
    if configuration is None:
        raise PaymentError("طريقة الدفع غير متاحة حالياً", status=400, field="method_code")
    return configuration


def initiate_payment(*, order: Order, method_code: str, user_input: dict | None = None) -> dict:
    """Start (or re-start) a payment for a finalised order.

    Re-initiating while a payment is still pending replaces the attempt — a
    customer who closed the lightbox must be able to try again. Re-initiating
    after a COMPLETED payment is refused: one order, one charge.
    """
    if not order.finalised_at:
        raise PaymentError("أكمل تفاصيل الطلب قبل الدفع", field="order_id")

    # Most-specific refusal first: a paid order stays paid whatever else is
    # wrong with the request.
    if Payment.objects.filter(order=order, status=PaymentStatus.COMPLETED).exists():
        raise PaymentError("تم دفع هذا الطلب مسبقاً")

    if not method_code:
        raise PaymentError(
            "طريقة الدفع لا تطابق المختارة عند تأكيد الطلب", field="method_code"
        )

    # Unknown or disabled gateways are answered as "unavailable", never as a
    # 500 — a customer landing on a switched-off method is normal life.
    try:
        gateway = get_gateway(method_code)
    except KeyError:
        raise PaymentError(
            "طريقة الدفع غير متاحة حالياً", status=400, field="method_code"
        ) from None

    if order.payment_method and order.payment_method != method_code:
        raise PaymentError(
            "طريقة الدفع لا تطابق المختارة عند تأكيد الطلب", field="method_code"
        )

    if order.status != OrderStatus.PENDING:
        raise PaymentError("لا يمكن دفع هذا الطلب في حالته الحالية")

    configuration = get_configuration(method_code)

    result = gateway.initiate(
        order=order, config=configuration.config_data, user_input=user_input or {}
    )

    with transaction.atomic():
        # One live attempt per order+method: retrying supersedes the previous
        # pending row rather than accumulating duplicates.
        payment = (
            Payment.objects.select_for_update()
            .filter(order=order, method_code=method_code, status=PaymentStatus.PENDING)
            .first()
        )
        if result.next_step == PaymentStatus.WAITING_FOR_VERIFICATION and payment is None:
            payment = (
                Payment.objects.select_for_update()
                .filter(
                    order=order,
                    method_code=method_code,
                    status=PaymentStatus.WAITING_FOR_VERIFICATION,
                )
                .first()
            )
        if payment is None:
            payment = Payment(order=order, method_code=method_code)
        payment.status = result.next_step
        payment.amount = order.total
        payment.provider_payload = {"initiate": result.data}
        if result.transaction_id:
            payment.reference_id = result.transaction_id[:100]
        payment.save()

    return {
        "success": result.success,
        "next_step": result.next_step,
        "message": result.message,
        "redirect_url": result.redirect_url,
        "payment_id": str(payment.id),
        "transaction_id": result.transaction_id,
        "data": result.data,
    }


def _convert_reservation_to_sale(order: Order) -> None:
    """The units were reserved at checkout; on a confirmed payment they leave
    the shelf. `stock` decrements exactly once — here."""
    from apps.catalog.models import Product, ProductVariant

    for item in order.items.select_related("product", "variant"):
        if not item.product.track_quantity:
            continue
        updates = {
            "stock": F("stock") - item.quantity,
            "reserved_stock": F("reserved_stock") - item.quantity,
        }
        if item.variant_id:
            ProductVariant.objects.filter(pk=item.variant_id).update(**updates)
        else:
            Product.objects.filter(pk=item.product_id).update(**updates)


@transaction.atomic
def confirm_payment(*, payment: Payment, transaction_id: str = "", raw: dict | None = None) -> bool:
    """Mark a payment COMPLETED and advance its order. Returns True when THIS
    call did the crediting; False means it was already credited (the webhook
    arrived twice, or the redirect beat the webhook).

    The row is locked for the whole critical section so two concurrent
    deliveries serialise, the second observing COMPLETED and doing nothing.
    """
    locked = Payment.objects.select_for_update().select_related("order").get(pk=payment.pk)
    if locked.status == PaymentStatus.COMPLETED:
        return False

    order: Order = locked.order
    locked.status = PaymentStatus.COMPLETED
    locked.verified_at = timezone.now()
    if transaction_id:
        locked.reference_id = transaction_id[:100]
    if raw is not None:
        locked.provider_payload = {**locked.provider_payload, "confirm": raw}
    locked.save(update_fields=["status", "verified_at", "reference_id",
                               "provider_payload", "updated_at"])

    _convert_reservation_to_sale(order)

    # PENDING → PROCESSING is the paid transition. The order may already have
    # moved (an operator got there first); both are legal, neither re-runs.
    if order.status == OrderStatus.PENDING:
        order.status = OrderStatus.PROCESSING
        order.save(update_fields=["status", "updated_at"])

    return True


@transaction.atomic
def fail_payment(*, payment: Payment, raw: dict | None = None) -> None:
    locked = Payment.objects.select_for_update().get(pk=payment.pk)
    if locked.status in (PaymentStatus.COMPLETED, PaymentStatus.FAILED):
        return
    locked.status = PaymentStatus.FAILED
    if raw is not None:
        locked.provider_payload = {**locked.provider_payload, "failure": raw}
    locked.save(update_fields=["status", "provider_payload", "updated_at"])


def handle_webhook(*, method_code: str, payload: dict, headers: dict) -> tuple[dict, int]:
    """Verify, then process, a provider notification. The response body is the
    provider's receipt: 200 either way once verified — providers retry on
    failures, and a duplicate is not a failure — but 400 on a bad signature,
    which is a request we want the provider to stop sending."""
    gateway = get_gateway(method_code)
    configuration = get_configuration(method_code)

    result: WebhookResult = gateway.handle_webhook(
        payload=payload, headers=headers, config=configuration.config_data
    )

    if not result.signature_valid:
        logger.warning("payment webhook rejected: bad signature method=%s", method_code)
        return {"success": False, "message": result.message}, 400

    order = Order.objects.filter(order_number=result.order_number or "").first()
    if order is None:
        return {"success": False, "message": "الطلب غير معروف"}, 200

    payment = (
        Payment.objects.filter(order=order, method_code=method_code)
        .exclude(status__in=[PaymentStatus.CANCELLED])
        .order_by("-created_at")
        .first()
    )
    if payment is None:
        return {"success": False, "message": "لا توجد عملية دفع لهذا الطلب"}, 200

    # The provider says an amount; the order says an amount. They are the same
    # order — a mismatch means the notification does not describe this charge,
    # and confirming it would be booking money we did not ask for.
    if result.amount is not None and result.amount != payment.amount:
        logger.warning(
            "payment webhook amount mismatch: payment=%s webhook=%s",
            payment.amount, result.amount,
        )
        return {"success": False, "message": "مبلغ الإشعار لا يطابق المبلغ المستحق"}, 200

    if result.status == PaymentStatus.COMPLETED:
        credited = confirm_payment(payment=payment, transaction_id=result.transaction_id, raw=result.raw)
        message = "تم تأكيد الدفع" if credited else "الدفع مؤكد مسبقاً"
        return {"success": True, "credited": credited, "message": message}, 200

    if result.status == PaymentStatus.FAILED:
        fail_payment(payment=payment, raw=result.raw)
        return {"success": False, "message": "فشلت عملية الدفع"}, 200

    return {"success": False, "message": result.message or "حالة غير مكتملة"}, 200


def resolve_redirect(*, order: Order) -> dict:
    """`/checkout/redirect` — the customer is back from the gateway.

    Works whichever arrived first: the webhook already credited → report that;
    it has not → query the gateway server-to-server and credit now if it can.
    Either way the SPA gets the authoritative state and routes accordingly.
    """
    payment = (
        Payment.objects.filter(order=order).exclude(status=PaymentStatus.CANCELLED)
        .order_by("-created_at")
        .first()
    )
    if payment is None:
        raise PaymentError("لا توجد عملية دفع لهذا الطلب", field="order_id")
    if payment.status == PaymentStatus.COMPLETED:
        return {"payment_status": payment.status, "confirmed": True}

    gateway = get_gateway(payment.method_code)
    configuration = get_configuration(payment.method_code)

    result = gateway.verify_remotely(payment=payment, config=configuration.config_data)
    if result is not None and result.signature_valid:
        if result.status == PaymentStatus.COMPLETED:
            confirm_payment(payment=payment, transaction_id=result.transaction_id, raw=result.raw)
            payment.refresh_from_db()
        elif result.status == PaymentStatus.FAILED:
            fail_payment(payment=payment, raw=result.raw)
            payment.refresh_from_db()

    return {
        "payment_status": payment.status,
        "confirmed": payment.status == PaymentStatus.COMPLETED,
    }


@transaction.atomic
def admin_verify(*, payment: Payment) -> dict:
    """An operator confirms a manual / waiting-for-verification payment.

    Same funnel as every other confirmation — the stock conversion and the
    order advance cannot diverge from the webhook path.
    """
    credited = confirm_payment(payment=payment)
    payment.refresh_from_db()
    return {"credited": credited, "payment_status": payment.status}
