import uuid
from django.db import migrations


def populate_default_store_settings(apps, schema_editor):
    StoreSettings = apps.get_model("core", "StoreSettings")
    BankAccount = apps.get_model("core", "BankAccount")

    StoreSettings.objects.get_or_create(
        pk=1,
        defaults={
            "store_name": "نسائم ليبيا",
            "legal_name": "شركة نسائم ليبيا للتجارة العامة",
            "legal_name_en": "NASAEM LIBYA TRADING CO.",
            "cr_number": "2024/09812",
            "address": "طرابلس — ليبيا",
            "site_url": "https://nasaeem.ly",
            "phone": "0910000000",
            "whatsapp": "0915555555",
            "email": "support@nasaeem.ly",
            "bank_transfer_note": "يرجى كتابة رقم الطلب في خانة الغرض/الملاحظة عند إجراء التحويل المصرفي، ثم إرسال صورة الإشعار.",
        },
    )

    if not BankAccount.objects.exists():
        BankAccount.objects.create(
            id=uuid.uuid4(),
            bank_name="مصرف الجمهورية",
            branch="الرئيسي",
            account_holder="شركة نسائم ليبيا للتجارة العامة",
            account_number="0123456789",
            iban="LY88000100000000012345678",
            is_active=True,
            sort_order=0,
        )


def rollback_store_settings(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_bankaccount_storesettings"),
    ]

    operations = [
        migrations.RunPython(populate_default_store_settings, rollback_store_settings),
    ]
