"""Payment records.

`provider_payload` holds the raw provider request/response for audit. Secrets
are redacted before anything is written here — see apps/payments/providers.
"""

import uuid

from django.conf import settings
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


class PaymentRefund(models.Model):
    """Refund transaction associated with an electronic payment or cash order."""

    STATUS_PENDING = "pending"
    STATUS_COMPLETED = "completed"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_PENDING, "قيد المعالجة"),
        (STATUS_COMPLETED, "مكتمل بنجاح"),
        (STATUS_FAILED, "فشل الاسترداد"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment = models.ForeignKey(
        Payment, on_delete=models.CASCADE, related_name="refunds", verbose_name="الدفعة الأصلية"
    )
    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="payment_refunds", verbose_name="الطلب"
    )
    amount = models.DecimalField("مبلغ الاسترداد", max_digits=10, decimal_places=2)
    reason = models.CharField("سبب الاسترداد", max_length=255, blank=True)
    provider_refund_id = models.CharField("مرجع الاسترداد لدى البوابة", max_length=100, blank=True)
    status = models.CharField("حالة الاسترداد", max_length=32, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="الموظف المنفذ"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField("تاريخ الاكتمال", null=True, blank=True)

    class Meta:
        verbose_name = "استرداد مالي"
        verbose_name_plural = "الاستردادات المالية"
        ordering = ["-created_at"]

    def __str__(self):
        return f"استرداد {self.amount} د.ل للطلب {self.order.order_number} ({self.get_status_display()})"


class LedgerAccount(models.Model):
    """Double-entry chart of accounts."""

    TYPE_ASSET = "asset"
    TYPE_LIABILITY = "liability"
    TYPE_EQUITY = "equity"
    TYPE_REVENUE = "revenue"
    TYPE_EXPENSE = "expense"

    TYPE_CHOICES = [
        (TYPE_ASSET, "أصول"),
        (TYPE_LIABILITY, "التزامات"),
        (TYPE_EQUITY, "حقوق ملكية"),
        (TYPE_REVENUE, "إيرادات"),
        (TYPE_EXPENSE, "مصروفات"),
    ]

    code = models.CharField("رمز الحساب", max_length=64, unique=True, db_index=True)
    name = models.CharField("اسم الحساب", max_length=128)
    account_type = models.CharField("نوع الحساب", max_length=32, choices=TYPE_CHOICES)
    balance = models.DecimalField("الرصيد الحالي", max_digits=12, decimal_places=2, default=0)
    is_active = models.BooleanField("نشط", default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "حساب مالي"
        verbose_name_plural = "شجرة الحسابات المالية"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name} ({self.balance} د.ل)"


class LedgerTransaction(models.Model):
    """Double-entry transaction record grouping balanced debit and credit entries."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_type = models.CharField("نوع المرجع", max_length=64, db_index=True)
    reference_id = models.CharField("معرّف المرجع", max_length=128, blank=True, db_index=True)
    description = models.CharField("البيان / الوصف", max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "قيد محاسبي"
        verbose_name_plural = "دفتر القيود المحاسبية"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.description} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"


class LedgerEntry(models.Model):
    """Individual debit or credit leg of a double-entry transaction."""

    ENTRY_DEBIT = "debit"
    ENTRY_CREDIT = "credit"

    ENTRY_CHOICES = [
        (ENTRY_DEBIT, "مدين"),
        (ENTRY_CREDIT, "دائن"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction = models.ForeignKey(
        LedgerTransaction, on_delete=models.CASCADE, related_name="entries", verbose_name="القيد المحاسبي"
    )
    account = models.ForeignKey(
        LedgerAccount, on_delete=models.PROTECT, related_name="entries", verbose_name="الحساب"
    )
    entry_type = models.CharField("نوع القيد", max_length=16, choices=ENTRY_CHOICES)
    amount = models.DecimalField("المبلغ", max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "طرف القيد"
        verbose_name_plural = "أطراف القيود المحاسبية"

    def __str__(self):
        return f"{self.account.name} | {self.get_entry_type_display()}: {self.amount} د.ل"
