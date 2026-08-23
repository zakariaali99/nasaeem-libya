import secrets
import logging
from django.db import transaction
from django.utils import timezone

from apps.orders.models import Order, OrderStatus
from .models import WhatsAppVerificationSession

logger = logging.getLogger(__name__)


def create_or_refresh_whatsapp_session(order: Order) -> WhatsAppVerificationSession:
    """Creates a secure verification token for self-hosted interactive WhatsApp bot."""
    phone = order.user.phone_number if order.user else ""
    token = secrets.token_urlsafe(32)

    session, created = WhatsAppVerificationSession.objects.get_or_create(
        order=order,
        defaults={
            "customer_phone": phone,
            "token": token,
            "status": WhatsAppVerificationSession.STATUS_PENDING,
        },
    )

    if not created:
        session.token = token
        session.status = WhatsAppVerificationSession.STATUS_PENDING
        session.save(update_fields=["token", "status", "updated_at"])

    return session


def confirm_order_via_whatsapp(
    *,
    token: str,
    gps_lat: float = None,
    gps_lng: float = None,
    address_text: str = "",
) -> WhatsAppVerificationSession:
    """Handles customer confirmation callback from interactive WhatsApp link."""
    session = WhatsAppVerificationSession.objects.select_related("order").filter(token=token).first()
    if not session:
        raise ValueError("رمز التحقق غير صالح أو منتهي الصلاحية")

    with transaction.atomic():
        order = session.order

        if gps_lat is not None and gps_lng is not None:
            session.gps_lat = gps_lat
            session.gps_lng = gps_lng
            session.gps_address_text = address_text
            session.status = WhatsAppVerificationSession.STATUS_ADDRESS_UPDATED
            if address_text:
                order.shipping_address = f"{order.shipping_address} (GPS: {gps_lat},{gps_lng} - {address_text})"
        else:
            session.status = WhatsAppVerificationSession.STATUS_CONFIRMED

        # If order was pending, advance to processing
        if order.status == OrderStatus.PENDING:
            order.status = OrderStatus.PROCESSING

        order.save(update_fields=["shipping_address", "status", "updated_at"])
        session.save()

    return session
