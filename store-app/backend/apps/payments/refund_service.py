"""1-Click Gateway & Manual Refund Service for Nasaeem Libya."""

import logging
from decimal import Decimal
from typing import Optional

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.orders.models import OrderStatus, PaymentStatus
from apps.payments.ledger_service import record_refund_ledger
from apps.payments.models import Payment, PaymentRefund

logger = logging.getLogger(__name__)


@transaction.atomic
def process_payment_refund(
    *,
    payment_id: str,
    amount: Decimal,
    reason: str = "",
    operator_user=None,
) -> PaymentRefund:
    """Executes a full or partial refund for a payment record."""
    payment = Payment.objects.select_for_update().get(id=payment_id)
    order = payment.order

    if payment.status != PaymentStatus.COMPLETED:
        raise ValidationError("لا يمكن استرداد دفعة لم يتم تأكيد استلامها بنجاح")

    # Compute already refunded amounts
    existing_refunds_sum = sum(
        (r.amount for r in payment.refunds.filter(status=PaymentRefund.STATUS_COMPLETED)),
        Decimal("0.00"),
    )
    available_to_refund = payment.amount - existing_refunds_sum

    if amount <= Decimal("0.00"):
        raise ValidationError("مبلغ الاسترداد يجب أن يكون أكبر من الصفر")

    if amount > available_to_refund:
        raise ValidationError(
            f"مبلغ الاسترداد المطلوب ({amount} د.ل) يتجاوز الرصيد المتاح للاسترداد ({available_to_refund} د.ل)"
        )

    # Generate gateway / system refund transaction reference
    date_str = timezone.now().strftime("%Y%m%d%H%M")
    provider_refund_id = f"REF-{payment.method_code[:4].upper()}-{date_str}-{str(payment.id)[:6].upper()}"

    refund = PaymentRefund.objects.create(
        payment=payment,
        order=order,
        amount=amount,
        reason=reason or "طلب استرجاع من الإدارة / العميل",
        provider_refund_id=provider_refund_id,
        status=PaymentRefund.STATUS_COMPLETED,
        operator=operator_user,
        completed_at=timezone.now(),
    )

    # Record reverse double-entry ledger entries
    try:
        record_refund_ledger(refund)
    except Exception as e:
        logger.exception("Failed to record refund ledger for refund %s: %s", refund.id, e)

    # If full refund completed, mark order and payment as refunded
    if (existing_refunds_sum + amount) >= payment.amount:
        payment.status = "refunded"
        payment.save(update_fields=["status", "updated_at"])

        if order.status != OrderStatus.COMPLETED:
            order.status = OrderStatus.CANCELLED
            order.save(update_fields=["status", "updated_at"])

    return refund
