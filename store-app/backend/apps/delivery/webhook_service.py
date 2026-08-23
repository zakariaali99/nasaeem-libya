import logging
from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, OrderStatus, ShippingStatus
from apps.payments.ledger_service import record_order_sale_ledger

from .models import CourierTrackingEvent

logger = logging.getLogger(__name__)

STATUS_MAPPING = {
    # Standardized Courier status -> (OrderStatus, ShippingStatus, Arabic Label)
    "SHIPMENT_CREATED": (OrderStatus.PROCESSING, "processing", "تم إنشاء بوليصة الشحن بنجاح"),
    "PICKED_UP": (OrderStatus.PROCESSING, "picked_up", "تم استلام الطرد من مستودع نسائم ليبيا"),
    "IN_TRANSIT": (OrderStatus.PROCESSING, "in_transit", "الشحنة في الطريق بين مراكز الفرز"),
    "OUT_FOR_DELIVERY": (OrderStatus.PROCESSING, "out_for_delivery", "الشحنة مع المندوب - جاري التوصيل للعميل اليوم"),
    "DELIVERED": (OrderStatus.COMPLETED, "delivered", "تم تسليم الشحنة للعميل بنجاح"),
    "DELIVERY_FAILED": (OrderStatus.PROCESSING, "delivery_failed", "تعذر تسليم الشحنة / تم تأجيل الموعد"),
    "RETURNED": (OrderStatus.CANCELLED, "returned", "مرتجع إلى مستودع المتجر الرئيسي"),
}


def process_courier_webhook_event(
    *,
    courier_code: str,
    tracking_number: str,
    status_code: str,
    location: str = "",
    driver_name: str = "",
    driver_phone: str = "",
    notes: str = "",
    raw_payload: dict = None,
    occurred_at=None,
) -> CourierTrackingEvent:
    """Processes an incoming webhook event from a courier and synchronizes order states."""
    if occurred_at is None:
        occurred_at = timezone.now()

    normalized_status = status_code.upper().strip()
    status_info = STATUS_MAPPING.get(
        normalized_status,
        (OrderStatus.PROCESSING, "in_transit", f"حالة الشحنة: {status_code}"),
    )
    target_order_status, target_shipping_status, status_label_ar = status_info

    # Find the matching order by tracking number
    order = Order.objects.filter(tracking_number=tracking_number).first()
    if not order:
        logger.warning(
            "Courier webhook event for unknown tracking number %s (courier=%s)",
            tracking_number,
            courier_code,
        )
        # Attempt fallback to match order number if tracking_number equals order_number
        order = Order.objects.filter(order_number=tracking_number).first()

    if not order:
        raise ValueError(f"لم يتم العثور على طلب برقم التتبع «{tracking_number}»")

    with transaction.atomic():
        locked_order = Order.objects.select_for_update().get(pk=order.pk)

        # Update order status & shipping status
        locked_order.shipping_status = target_shipping_status
        if target_order_status == OrderStatus.COMPLETED and locked_order.status != OrderStatus.COMPLETED:
            locked_order.status = OrderStatus.COMPLETED
            # Record sale ledger
            try:
                record_order_sale_ledger(locked_order)
            except Exception as e:
                logger.error("Failed recording ledger on delivery for order %s: %s", locked_order.id, e)
        elif target_order_status == OrderStatus.CANCELLED:
            locked_order.status = OrderStatus.CANCELLED

        locked_order.save(update_fields=["shipping_status", "status", "updated_at"])

        # Create tracking event
        event = CourierTrackingEvent.objects.create(
            order=locked_order,
            courier_code=courier_code,
            status_code=normalized_status,
            status_label_ar=status_label_ar,
            location=location,
            driver_name=driver_name,
            driver_phone=driver_phone,
            notes=notes,
            raw_payload=raw_payload or {},
            occurred_at=occurred_at,
        )

    logger.info(
        "Processed courier webhook event: order=%s, courier=%s, status=%s",
        order.order_number,
        courier_code,
        normalized_status,
    )
    return event


def build_order_tracking_timeline(order: Order) -> dict:
    """Builds comprehensive tracking timeline history for an order."""
    events = list(order.tracking_events.all().order_by("occurred_at"))
    
    formatted_events = [
        {
            "id": str(e.id),
            "courier_code": e.courier_code,
            "status_code": e.status_code,
            "status_label_ar": e.status_label_ar,
            "location": e.location,
            "driver_name": e.driver_name,
            "driver_phone": e.driver_phone,
            "notes": e.notes,
            "occurred_at": e.occurred_at.isoformat(),
        }
        for e in events
    ]

    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "courier_name": order.delivery_method.name if order.delivery_method else "شركة التوصيل",
        "courier_code": order.delivery_method.code if order.delivery_method else "",
        "tracking_number": order.tracking_number,
        "tracking_url": order.tracking_url,
        "shipping_status": order.shipping_status,
        "current_status_label": order.get_shipping_status_display() if hasattr(order, "get_shipping_status_display") else order.shipping_status,
        "events": formatted_events,
    }
