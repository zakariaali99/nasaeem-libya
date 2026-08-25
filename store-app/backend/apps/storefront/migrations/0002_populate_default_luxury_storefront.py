import sys
import uuid
from django.db import migrations


def seed_default_layout(apps, schema_editor):
    if "pytest" in sys.modules or "test" in sys.argv:
        return

    StorefrontLayout = apps.get_model("storefront", "StorefrontLayout")
    Widget = apps.get_model("storefront", "Widget")

    if StorefrontLayout.objects.filter(is_global_active=True).exists():
        return

    layout = StorefrontLayout.objects.create(
        id=uuid.uuid4(),
        name="التخطيط الملكي الفاخر (Royal Luxury Theme)",
        is_global_active=True,
    )

    default_widgets = [
        (
            "announcement_bar",
            {
                "title": "ضمان الرضا الكامل",
                "message": "عطور أصلية فاخرة 100% مع ضمان التجربة والاسترجاع وتوصيل سريع لكافة المدن الليبية 🇱🇾",
                "linkLabel": "تصفح العطور",
                "linkUrl": "/products",
                "icon": "sparkles",
                "dismissible": True,
            },
            0,
        ),
        (
            "hero_cta",
            {
                "title": "أفخم العطور الشرقية والفرنسية في ليبيا",
                "subtitle": "تشكيلة حصرية من أرقى الماركات العالمية المختارة بعناية لتناسب ذوقك الرفيع مع عينات تجربة مجانية.",
                "buttonLabel": "اكتشف المجموعة الملكية",
                "buttonUrl": "/products",
                "alignment": "center",
                "desktopImageUrl": "/media/banners/hero-desktop.jpg",
                "mobileImageUrl": "/media/banners/hero-mobile.jpg",
            },
            1,
        ),
        (
            "category_list",
            {
                "title": "تسوق حسب العائلة العطرية",
                "layout": "grid",
            },
            2,
        ),
        (
            "discovery_box",
            {
                "title": "باقة عينات التجربة واسترداد القيمة 100%",
                "badge": "ضمان الرضا الكامل 🧪",
                "description": "جرّب 5 عينات فاخرة بحجم 5 مل براحتك في البيت بـ 60 د.ل فقط، وسنمنحك كوبون استرداد فوري بـ 60 د.ل يُخصم بالكامل عند طلبك الزجاجة الأصلية خلال 14 يوماً!",
                "price": "60 د.ل",
                "sampleCount": 5,
                "cashbackPercent": 100,
                "linkUrl": "/search?q=عينات",
                "buttonText": "اطلب باقة التجربة الآن",
                "showInCart": True,
                "showInProductDetail": True,
            },
            3,
        ),
        (
            "product_list",
            {
                "title": "العطور الأكثر طلباً ونخبة التشكيلات",
                "layout": "slider",
            },
            4,
        ),
        (
            "trust_badges",
            {
                "title": "لماذا يثق بنا عملاؤنا في ليبيا؟",
                "items": [
                    {
                        "icon": "shield-check",
                        "title": "عطور أصلية 100%",
                        "subtitle": "ماركات عالمية وأصلية مضمونة",
                    },
                    {
                        "icon": "truck",
                        "title": "توصيل لجميع مدن ليبيا",
                        "subtitle": "شحن سريع وموثوق لباب بيتك",
                    },
                    {
                        "icon": "credit-card",
                        "title": "دفع آمن ومريح",
                        "subtitle": "سداد، معاملات، بطاقات، أو كاش",
                    },
                ],
            },
            5,
        ),
    ]

    for widget_type, data, order in default_widgets:
        Widget.objects.create(
            id=uuid.uuid4(),
            layout=layout,
            type=widget_type,
            data=data,
            order=order,
            is_active=True,
        )


def remove_default_layout(apps, schema_editor):
    StorefrontLayout = apps.get_model("storefront", "StorefrontLayout")
    StorefrontLayout.objects.filter(name="التخطيط الملكي الفاخر (Royal Luxury Theme)").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("storefront", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_default_layout, remove_default_layout),
    ]
