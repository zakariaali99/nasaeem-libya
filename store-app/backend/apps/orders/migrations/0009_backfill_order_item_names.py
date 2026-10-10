from django.db import migrations


def backfill(apps, schema_editor):
    """Quick orders were saved without the product-name snapshot, so their
    lines printed blank on invoices and waybills. Fill them from the product."""
    OrderItem = apps.get_model("orders", "OrderItem")
    for item in OrderItem.objects.filter(product_name="", product__isnull=False).select_related("product"):
        item.product_name = item.product.name
        item.save(update_fields=["product_name"])


class Migration(migrations.Migration):
    dependencies = [("orders", "0008_cartpromotion_off_by_default")]

    operations = [migrations.RunPython(backfill, migrations.RunPython.noop)]
