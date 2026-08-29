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
    payment_method_label = "الدفع عند الاستلام كاش 💵" if order.payment_method in ("cod", "manual_payment", "cash_on_delivery") else ("تحويل مصرفي 🏛️" if order.payment_method == "bank_transfer" else "دفع إلكتروني 💳")

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


def format_bank_transfer_whatsapp_message(order, store_url: str = "") -> str:
    """Format full bank transfer instructions and complete order invoice for WhatsApp."""
    user_name = order.user.name if (order.user and order.user.name) else "عميلنا العزيز"
    
    items_list = []
    for item in order.items.all():
        p_name = item.product.name if item.product else item.product_name
        items_list.append(f"▫️ {p_name} × {item.quantity} ({item.total_price} د.ل)")
    items_text = "\n".join(items_list) if items_list else "▫️ عطور فاخرة مختارة"

    city_name = order.shipping_city.name if order.shipping_city else (order.shipping_region.city.name if order.shipping_region else "ليبيا")
    address = order.shipping_address or (order.shipping_region.name if order.shipping_region else "")

    msg = (
        f"🌸 *مرحباً بك {user_name} في نسائم ليبيا للعطور الفاخرة*\n\n"
        f"تم استلام طلبك بنجاح ونشكر ثقتك بنا ✨\n"
        f"🏷️ *رقم الطلب:* #{order.order_number}\n\n"
        f"📋 *تفاصيل الفاتورة:*\n"
        f"{items_text}\n"
        f"──────────────\n"
        f"💵 المجموع الفرعي: {order.subtotal} د.ل\n"
    )
    if order.discount_total and order.discount_total > 0:
        msg += f"🎁 الخصم: -{order.discount_total} د.ل\n"
    msg += (
        f"🚚 رسوم التوصيل ({city_name}): {order.shipping_total} د.ل\n"
        f"💰 *المبلغ الإجمالي المطلوب تحويله: {order.total} د.ل*\n\n"
        f"🏛️ *بيانات الحساب المصرفي للتحويل:*\n"
        f"• *المصرف:* مصرف الجمهورية / المصرف التجاري الوطني\n"
        f"• *اسم المستفيد:* شركة نسائم ليبيا للعطور\n"
        f"• *رقم الحساب المصرفي (Account):* `0123456789`\n"
        f"• *رقم الآيبان الدولي (IBAN):* `LY88 0001 0123 4567 8901 2345`\n\n"
        f"📸 *خطوة التأكيد:* يرجى الرد على هذه الرسالة بصورة إشعار التحويل المصرفي ليتم تأكيد طلبك والبدء في شحنه فوراً 🚚.\n"
        f"📍 وجهة التوصيل: {city_name} — {address}"
    )
    return msg


def format_new_account_welcome_whatsapp_message(
    user_name: str, phone_number: str, temp_password: str = "000000", store_url: str = "https://nasaim.ly"
) -> str:
    """Format account creation welcome notice with security password advice."""
    return (
        f"🌟 *أهلاً بك {user_name} في عائلة نسائم ليبيا للعطور الفاخرة!*\n\n"
        f"تم إنشاء حساب خاص بك في متجرنا لتتمكن من متابعة حالة طلباتك، وعناوين التوصيل، ونقاط ولائك بسهولة:\n\n"
        f"📱 *اسم المستخدم (الهاتف):* `{phone_number}`\n"
        f"🔑 *كلمة المرور المؤقتة:* `{temp_password}`\n\n"
        f"🔒 *تنبيه أمان مهم:*\n"
        f"ننصحك بتسجيل الدخول إلى حسابك وتغيير كلمة المرور المؤقتة إلى كلمة مرور خاصة بك للحفاظ على أمان وخصوصية بياناتك.\n\n"
        f"🔗 *رابط إدارة حسابك في المتجر:*\n"
        f"{store_url}/profile"
    )


def format_cod_order_whatsapp_message(order) -> str:
    """Format invoice and dispatch confirmation for Cash on Delivery orders."""
    user_name = order.user.name if (order.user and order.user.name) else "عميلنا العزيز"
    items_list = []
    for item in order.items.all():
        p_name = item.product.name if item.product else item.product_name
        items_list.append(f"▫️ {p_name} × {item.quantity} ({item.total_price} د.ل)")
    items_text = "\n".join(items_list) if items_list else "▫️ عطور فاخرة مختارة"
    city_name = order.shipping_city.name if order.shipping_city else "ليبيا"

    return (
        f"🌸 *مرحباً بك {user_name} في نسائم ليبيا للعطور الفاخرة*\n\n"
        f"تم تأكيد طلبك بنجاح وبدء التجهيز الفوري 🚚\n"
        f"🏷️ *رقم الطلب:* #{order.order_number}\n\n"
        f"📦 *المنتجات:*\n{items_text}\n"
        f"──────────────\n"
        f"💰 *المبلغ المطلوب عند الاستلام (كاش): {order.total} د.ل*\n"
        f"📍 التوصيل إلى: {city_name} — {order.shipping_address}\n\n"
        f"سيقوم مندوب التوصيل بالتواصل معك قبل الوصول لتسليمك الطلب ومعاينته. شكراً لاختيارك نسائم ليبيا! ✨"
    )


def dispatch_realtime_order_alert(order) -> bool:
    """Dispatch real-time notification to Telegram bot / internal logging webhook."""
    try:
        msg = format_order_telegram_message(order)
        logger.info("REALTIME_DISPATCH_ALERT for order %s:\n%s", order.order_number, msg)
        return True
    except Exception as err:
        logger.exception("Failed to dispatch real-time order alert: %s", err)
        return False

