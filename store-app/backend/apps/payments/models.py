"""Payment records.

`provider_payload` holds the raw provider request/response for audit. Secrets
are redacted before anything is written here — see apps/payments/providers.
"""

import uuid

from django.db import models

from apps.orders.models import Order, PaymentStatus


class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="payments", verbose_name="الطلب"
    )
    method_code = models.CharField("رمز الطريقة", max_length=50, db_index=True)
    status = models.CharField(
        "الحالة", max_length=32, choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING, db_index=True,
    )
    amount = models.DecimalField("المبلغ", max_digits=10, decimal_places=2)
    reference_id = models.CharField("المرجع", max_length=100, blank=True, db_index=True)
    provider_payload = models.JSONField("بيانات المزوّد", default=dict, blank=True)
    verified_at = models.DateTimeField("تاريخ التحقق", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "دفعة"
        verbose_name_plural = "الدفعات"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.order.order_number} — {self.method_code} ({self.get_status_display()})"
