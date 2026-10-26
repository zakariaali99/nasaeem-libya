# Written by hand (plan 8, phase د): the customer file. `makemigrations` is
# never run on this project — see fixes/08.

import uuid
from decimal import Decimal

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_city_region_name_en"),
    ]

    operations = [
        migrations.CreateModel(
            name="CustomerTag",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(max_length=40, unique=True, verbose_name="الوسم")),
                ("color", models.CharField(default="#6b7280", max_length=7, verbose_name="اللون")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "verbose_name": "وسم عميل",
                "verbose_name_plural": "وسوم العملاء",
                "ordering": ["name"],
            },
        ),
        migrations.AddField(
            model_name="user",
            name="birthday",
            field=models.DateField(blank=True, null=True, verbose_name="تاريخ الميلاد"),
        ),
        migrations.AddField(
            model_name="user",
            name="tags",
            field=models.ManyToManyField(
                blank=True, related_name="customers", to="core.customertag", verbose_name="الوسوم"
            ),
        ),
        migrations.CreateModel(
            name="CustomerInteraction",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("call", "مكالمة"),
                            ("whatsapp", "واتساب"),
                            ("complaint", "شكوى"),
                            ("followup", "متابعة"),
                            ("note", "ملاحظة"),
                        ],
                        default="note",
                        max_length=12,
                        verbose_name="النوع",
                    ),
                ),
                ("text", models.CharField(max_length=600, verbose_name="النص")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "customer",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="interactions",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="العميل",
                    ),
                ),
                (
                    "staff",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="الموظف",
                    ),
                ),
            ],
            options={
                "verbose_name": "تواصل مع عميل",
                "verbose_name_plural": "سجل التواصل",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddField(
            model_name="storesettings",
            name="crm_vip_min_orders",
            field=models.PositiveIntegerField(default=5, verbose_name="طلبات VIP"),
        ),
        migrations.AddField(
            model_name="storesettings",
            name="crm_vip_min_spend",
            field=models.DecimalField(
                decimal_places=2, default=Decimal("500.00"), max_digits=10, verbose_name="إنفاق VIP (د.ل)"
            ),
        ),
        migrations.AddField(
            model_name="storesettings",
            name="crm_inactive_days",
            field=models.PositiveIntegerField(default=60, verbose_name="أيام الخمول"),
        ),
    ]
