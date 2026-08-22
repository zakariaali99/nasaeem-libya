"""Delivery orchestration — creating shipments.

The courier owns the wire protocol; this module owns when a shipment may be
created and where its tracking number lands:

- Only a finalised order with a chosen courier can ship.
- An order that already has a tracking number ships again only as an explicit
  re-dispatch — the default answer is the number we already hold.
- The tracking number is written onto the order in the same transaction that
  records the attempt, so an operator can never see a shipped order without a
  number.
"""

from __future__ import annotations

import logging

from django.db import transaction

from apps.orders.models import Order

from .providers.registry import get_courier

logger = logging.getLogger(__name__)


class DeliveryError(Exception):
    def __init__(self, message: str, *, status: int = 409):
        super().__init__(message)
        self.message = message
        self.status = status


def start_delivery(*, order: Order, force: bool = False) -> dict:
    """Create the courier shipment for a finalised, paid-order flow.

    `force` re-dispatches: a courier losing a parcel is real life, and the
    operator needs to be able to create a replacement shipment.
    """
    if not order.finalised_at:
        raise DeliveryError("أكمل تفاصيل الطلب قبل الشحن")
    if not order.delivery_method_id:
        raise DeliveryError("اختر طريقة التوصيل أولاً")

    method = order.delivery_method
    try:
        courier = get_courier(method.code)
    except KeyError:
        # A non-courier delivery method (e.g. استلام من المتجر) has no shipment.
        raise DeliveryError(
            f"طريقة التوصيل «{method.name}» لا تدعم إنشاء شحنة", status=400,
        ) from None

    if order.tracking_number and not force:
        return {
            "success": True,
            "tracking_number": order.tracking_number,
            "tracking_url": order.tracking_url,
            "message": "الشحنة موجودة مسبقاً",
            "reused": True,
        }

    result = courier.create_shipment(order=order, config=method.configuration)

    with transaction.atomic():
        locked = Order.objects.select_for_update().get(pk=order.pk)
        if result.success:
            locked.tracking_number = (result.tracking_number or "")[:100]
            locked.save(update_fields=["tracking_number", "updated_at"])
        logger.info(
            "shipment create: order=%s courier=%s success=%s",
            order.id, method.code, result.success,
        )

    return {
        "success": result.success,
        "tracking_number": result.tracking_number,
        "tracking_url": "",
        "message": result.message,
        "reused": False,
    }
