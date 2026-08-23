"""Automated Payment Reconciliation Service for Network Disconnections and Webhook Fallbacks.

Polls payment gateways for pending/stuck transactions, updates order statuses,
and maintains double-entry ledger integrity automatically.
"""

import logging
from datetime import timedelta
from typing import Any, Dict

from django.db import transaction
from django.utils import timezone

from apps.orders.models import OrderStatus, PaymentStatus
from apps.payments.ledger_service import record_order_sale_ledger
from apps.payments.models import Payment
from apps.payments.providers.registry import get_gateway, get_gateway_config

logger = logging.getLogger(__name__)


def reconcile_pending_payments(
    *,
    min_age_minutes: int = 3,
    max_age_minutes: int = 1440,
) -> Dict[str, Any]:
    """Scans and queries gateways for all pending payments within the time window."""
    now = timezone.now()
    older_than = now - timedelta(minutes=min_age_minutes)
    newer_than = now - timedelta(minutes=max_age_minutes)

    pending_payments = Payment.objects.filter(
        status__in=[PaymentStatus.PENDING, "initiated"],
        created_at__lte=older_than,
        created_at__gte=newer_than,
    ).select_related("order")

    checked_count = 0
    reconciled_count = 0
    failed_count = 0
    skipped_count = 0

    for payment in pending_payments:
        checked_count += 1
        method_code = payment.method_code
        gateway = get_gateway(method_code)

        if not gateway:
            skipped_count += 1
            continue

        config = get_gateway_config(method_code)

        try:
            webhook_res = gateway.verify_remotely(payment=payment, config=config)
            if not webhook_res:
                skipped_count += 1
                continue

            if webhook_res.success and webhook_res.status == PaymentStatus.COMPLETED:
                with transaction.atomic():
                    payment = Payment.objects.select_for_update().get(id=payment.id)
                    payment.status = PaymentStatus.COMPLETED
                    payment.verified_at = timezone.now()
                    if webhook_res.transaction_id:
                        payment.reference_id = webhook_res.transaction_id
                    payment.save(update_fields=["status", "verified_at", "reference_id", "updated_at"])

                    order = payment.order
                    if order.status == OrderStatus.PENDING:
                        order.status = OrderStatus.PROCESSING
                        order.save(update_fields=["status", "updated_at"])

                    # Record double-entry sale
                    try:
                        record_order_sale_ledger(order)
                    except Exception as le:
                        logger.warning("Ledger recording warning on reconcile: %s", le)

                reconciled_count += 1
                logger.info("Payment %s for order %s reconciled successfully.", payment.id, payment.order.order_number)

            elif webhook_res.status == PaymentStatus.FAILED:
                payment.status = PaymentStatus.FAILED
                payment.save(update_fields=["status", "updated_at"])
                failed_count += 1

        except Exception as err:
            logger.exception("Error reconciling payment %s: %s", payment.id, err)
            skipped_count += 1

    return {
        "checked_count": checked_count,
        "reconciled_count": reconciled_count,
        "failed_count": failed_count,
        "skipped_count": skipped_count,
        "message": f"تم فحص {checked_count} معاملة معلقة: تمت مطابقة {reconciled_count} بنجاح، وفشل {failed_count}.",
    }
