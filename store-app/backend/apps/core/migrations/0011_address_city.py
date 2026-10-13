import django.db.models.deletion
from django.db import migrations, models


def fill_city(apps, schema_editor):
    """Every saved address so far has a region; its city is that region's."""
    UserAddress = apps.get_model("core", "UserAddress")
    for address in UserAddress.objects.filter(city__isnull=True, region__isnull=False).select_related("region"):
        address.city_id = address.region.city_id
        address.save(update_fields=["city"])


class Migration(migrations.Migration):
    dependencies = [("core", "0010_store_texts")]

    operations = [
        migrations.AddField(
            model_name="useraddress",
            name="city",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="addresses", to="core.city", verbose_name="المدينة",
            ),
        ),
        migrations.AlterField(
            model_name="useraddress",
            name="region",
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.PROTECT,
                related_name="addresses", to="core.region", verbose_name="المنطقة",
            ),
        ),
        migrations.RunPython(fill_city, migrations.RunPython.noop),
    ]
