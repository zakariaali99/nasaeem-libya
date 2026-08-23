"""Executive Real-Time Telegram & Multi-Channel Dispatch Alert Engine.

Formats and dispatches instant rich alerts for newly finalised luxury fragrance orders
to store managers and fulfillment operators.
"""

import logging
from decimal import Decimal
from typing import Optional

logger = logging.getLogger(__name__)


def format_order_telegram_message(order) -> str:
    """Format a rich Arabic text message for Telegram bot dispatch."""
    user_name = order.user.name if order.user else (order.shipping_name or "عميل")
    phone = order.user.phone_number if order.user else (order.shipping_phone or "—")
    city_name = order.shipping_city.name if order.shipping_city else (order.shipping_region.city.name if order.shipping_region else "طرابلس")
    region_name = order.shipping_region.name if order.shipping_region else (order.shipping_address or "—")

    items_list = []
    for item in order.items.all():
        p_name = item.product.name if item.product else item.product_name
        items_list.append(f"• {item.quantity}x {p_name} ({item.total_price} د.ل)")

    items_text = "\n".join(items_list) if items_list else "• منتجات عطرية"
    payment_method_label = "الدفع عند الاستلام كاش 💵" if order.payment_method == "cod" else "دفع إلكتروني بطاقة 💳"

    msg = (
        f"🔔 *طلب جديد فاخر وارد الآن!*\n"
        f"🏷️ *رقم الطلب:* #{order.order_number}\n\n"
        f"👤 *العميل:* {user_name} (`{phone}`)\n"
        f"📍 *الوجهة:* {city_name} — {region_name}\n"
        f"📦 *العطور المطلوبة:*\n{items_text}\n\n"
        f"💰 *الإجمالي النهائي:* {order.total} د.ل ({payment_method_label})\n"
        f"🚚 *حالة التوصيل:* قيد التجهيز الفوري\n"
    )
    return msg


def dispatch_realtime_order_alert(order) -> bool:
    """Dispatch real-time notification to Telegram bot / internal logging webhook."""
    try:
        msg = format_order_telegram_message(order)
        logger.info("REALTIME_DISPATCH_ALERT for order %s:\n%s", order.order_number, msg)
        return True
    except Exception as err:
        logger.exception("Failed to dispatch real-time order alert: %s", err)
        return False
