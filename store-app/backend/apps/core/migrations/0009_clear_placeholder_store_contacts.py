from django.db import migrations

# Values seeded by 0008 as stand-ins. Left in place they would show customers a
# fake bank account and send order invoices to a WhatsApp number nobody reads;
# the real ones are entered from /admin/settings.
PLACEHOLDER_ACCOUNT_NUMBER = "0123456789"
PLACEHOLDER_CONTACTS = {"phone": "0910000000", "whatsapp": "0915555555", "email": "support@nasaeem.ly"}


def clear_placeholders(apps, schema_editor):
    BankAccount = apps.get_model("core", "BankAccount")
    StoreSettings = apps.get_model("core", "StoreSettings")

    BankAccount.objects.filter(account_number=PLACEHOLDER_ACCOUNT_NUMBER).delete()

    settings = StoreSettings.objects.filter(pk=1).first()
    if settings is None:
        return
    changed = [field for field, value in PLACEHOLDER_CONTACTS.items() if getattr(settings, field) == value]
    for field in changed:
        setattr(settings, field, "")
    if changed:
        settings.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("core", "0008_populate_default_store_settings")]

    operations = [migrations.RunPython(clear_placeholders, migrations.RunPython.noop)]
