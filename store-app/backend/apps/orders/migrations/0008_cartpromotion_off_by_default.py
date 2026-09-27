from django.db import migrations, models

# The free-delivery promotion was created switched ON the first time the
# discounts screen was opened, waiving delivery fees on orders ≥ 200 د.ل that
# the owner never approved. Turn existing rows off (the owner re-enables from
# the dashboard) and drop the «د.ل» typed after {remaining}, which the
# storefront already appends.


def switch_off_and_fix_message(apps, schema_editor):
    CartPromotion = apps.get_model("orders", "CartPromotion")
    for promo in CartPromotion.objects.all():
        promo.is_active = False
        promo.message = promo.message.replace("{remaining} د.ل", "{remaining}")
        promo.save(update_fields=["is_active", "message"])

    from django.core.cache import cache

    cache.delete("store:promotions:active")  # the storefront endpoint caches for 12h


class Migration(migrations.Migration):
    dependencies = [("orders", "0007_alter_cartitem_product_alter_cartitem_variant_and_more")]

    operations = [
        migrations.AlterField(
            model_name="cartpromotion",
            name="is_active",
            field=models.BooleanField(db_index=True, default=False, verbose_name="مفعّل"),
        ),
        migrations.AlterField(
            model_name="cartpromotion",
            name="message",
            field=models.CharField(
                default="أضف {remaining} للحصول على توصيل مجاني!", max_length=255, verbose_name="نص التشجيع"
            ),
        ),
        migrations.RunPython(switch_off_and_fix_message, migrations.RunPython.noop),
    ]
