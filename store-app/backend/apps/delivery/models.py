import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CourierTrackingEvent(TimestampedModel):
    """Real-time courier webhook & tracking events lifecycle."""

    STATUS_SHIPMENT_CREATED = "SHIPMENT_CREATED"
    STATUS_PICKED_UP = "PICKED_UP"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    STATUS_DELIVERED = "DELIVERED"
    STATUS_DELIVERY_FAILED = "DELIVERY_FAILED"
    STATUS_RETURNED = "RETURNED"

    STATUS_CHOICES = [
        (STATUS_SHIPMENT_CREATED, "تم إنشاء الشحنة"),
        (STATUS_PICKED_UP, "تم استلام الشحنة من المستودع"),
        (STATUS_IN_TRANSIT, "في الطريق بين مراكز الفرز"),
        (STATUS_OUT_FOR_DELIVERY, "مع المندوب - جاري التوصيل"),
        (STATUS_DELIVERED, "تم التسليم بنجاح للعميل"),
        (STATUS_DELIVERY_FAILED, "تعذر التوصيل / تأجيل"),
        (STATUS_RETURNED, "مرتجع إلى مستودع المتجر"),
    ]

    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="tracking_events",
        verbose_name="الطلب",
    )
    courier_code = models.CharField("رمز شركة التوصيل", max_length=50, db_index=True)
    status_code = models.CharField("رمز الحالة", max_length=50, choices=STATUS_CHOICES, db_index=True)
    status_label_ar = models.CharField("وصف الحالة بالعربية", max_length=255)
    location = models.CharField("الموقع الحالي", max_length=255, blank=True)
    driver_name = models.CharField("اسم السائق / المندوب", max_length=150, blank=True)
    driver_phone = models.CharField("هاتف السائق", max_length=50, blank=True)
    notes = models.TextField("ملاحظات إضافية", blank=True)
    raw_payload = models.JSONField("بيانات الـ Webhook الخام", default=dict, blank=True)
    occurred_at = models.DateTimeField("تاريخ ووقت حدوث الحركة")

    class Meta:
        verbose_name = "حركة تتبع شحنة"
        verbose_name_plural = "حركات تتبع الشحنات"
        ordering = ["-occurred_at", "-created_at"]

    def __str__(self):
        return f"[{self.courier_code}] {self.order.order_number} - {self.status_label_ar}"


class CODReconciliationStatement(TimestampedModel):
    """Excel / CSV settlement statement uploaded for courier COD cash matching."""

    STATUS_DRAFT = "draft"
    STATUS_COMMITTED = "committed"
    STATUS_REJECTED = "rejected"

    STATUS_CHOICES = [
        (STATUS_DRAFT, "مسودة تحت المراجعة"),
        (STATUS_COMMITTED, "معتمدة ومرحّلة مالياً"),
        (STATUS_REJECTED, "مرفوضة"),
    ]

    statement_id = models.CharField("رقم الكشف", max_length=50, unique=True, db_index=True)
    courier_code = models.CharField("رمز شركة الشحن", max_length=50)
    courier_name = models.CharField("اسم شركة الشحن", max_length=150)
    period_start = models.DateField("بداية الفترة", null=True, blank=True)
    period_end = models.DateField("نهاية الفترة", null=True, blank=True)
    total_orders_count = models.PositiveIntegerField("إجمالي الشحنات بالكشف", default=0)
    matched_orders_count = models.PositiveIntegerField("عدد الشحنات المتطابقة", default=0)
    discrepancies_count = models.PositiveIntegerField("عدد الفروقات والملاحظات", default=0)
    total_collected_expected = models.DecimalField(
        "إجمالي المطلوب تحصيله", max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    total_collected_actual = models.DecimalField(
        "إجمالي المحصل الفعلي", max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    total_delivery_fees = models.DecimalField(
        "إجمالي عمولات التوصيل", max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    net_bank_deposit = models.DecimalField(
        "صافي الإيداع البنكي", max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    status = models.CharField("حالة المطابقة", max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    operator_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciled_cod_statements",
        verbose_name="الموظف المسؤول",
    )

    class Meta:
        verbose_name = "كشف مطابقة تحصيل COD"
        verbose_name_plural = "كشوفات مطابقة تحصيل COD"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.statement_id} - {self.courier_name} ({self.get_status_display()})"


class CODReconciliationItem(TimestampedModel):
    """Individual shipment row in a COD reconciliation statement."""

    MATCH_PERFECT = "matched"
    MATCH_AMOUNT_MISMATCH = "amount_mismatch"
    MATCH_ORDER_NOT_FOUND = "order_not_found"
    MATCH_ALREADY_SETTLED = "already_settled"

    MATCH_STATUS_CHOICES = [
        (MATCH_PERFECT, "مطابق 100%"),
        (MATCH_AMOUNT_MISMATCH, "فارق في مبلغ التحصيل"),
        (MATCH_ORDER_NOT_FOUND, "الطلب غير موجود بالنظام"),
        (MATCH_ALREADY_SETTLED, "تمت تسويته مسبقاً"),
    ]

    statement = models.ForeignKey(
        CODReconciliationStatement,
        on_delete=models.CASCADE,
        related_name="items",
        verbose_name="كشف المطابقة",
    )
    order = models.ForeignKey(
        "orders.Order",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reconciliation_items",
        verbose_name="الطلب المتطابق",
    )
    tracking_number = models.CharField("رقم التتبع", max_length=100, db_index=True)
    order_number = models.CharField("رقم الطلب", max_length=100, blank=True, db_index=True)
    recipient_name = models.CharField("اسم المستلم", max_length=150, blank=True)
    expected_amount = models.DecimalField("المبلغ المسجل بالنظام", max_digits=10, decimal_places=2, default=Decimal("0.00"))
    collected_amount = models.DecimalField("المبلغ المحصل فعلياً", max_digits=10, decimal_places=2, default=Decimal("0.00"))
    delivery_fee = models.DecimalField("عمولة التوصيل", max_digits=10, decimal_places=2, default=Decimal("0.00"))
    discrepancy_amount = models.DecimalField("فارق المبلغ", max_digits=10, decimal_places=2, default=Decimal("0.00"))
    match_status = models.CharField("حالة التطابق", max_length=30, choices=MATCH_STATUS_CHOICES, default=MATCH_PERFECT)
    status_note = models.CharField("ملاحظة التدقيق", max_length=255, blank=True)
    is_approved = models.BooleanField("معتمد للتسوية", default=True)

    class Meta:
        verbose_name = "بند كشف مطابقة"
        verbose_name_plural = "بنود كشف المطابقة"
        ordering = ["id"]


class WarehouseHub(TimestampedModel):
    """Multi-Branch inventory distribution hub for smart order routing."""

    HUB_TRIPOLI = "TRIPOLI_MAIN"
    HUB_BENGHAZI = "BENGHAZI_REGIONAL"
    HUB_MISRATA = "MISRATA_CENTRAL"
    HUB_SOUTH = "SOUTH_SEBHA"

    HUB_CHOICES = [
        (HUB_TRIPOLI, "مخزن طرابلس الرئيسي والمنطقة الغربية"),
        (HUB_BENGHAZI, "مخزن بنغازي الإقليمي والمنطقة الشرقية"),
        (HUB_MISRATA, "مخزن مصراتة والوسطى"),
        (HUB_SOUTH, "مخزن سبها والمنطقة الجنوبية"),
    ]

    code = models.CharField("رمز المخزن", max_length=50, unique=True, choices=HUB_CHOICES)
    name_ar = models.CharField("اسم المخزن بالعربية", max_length=150)
    city_coverage = models.JSONField("المدن المغطاة", default=list, help_text="قائمة بأسماء المدن الليبية التابعة للمخزن")
    address = models.CharField("العنوان والموقع", max_length=255, blank=True)
    manager_phone = models.CharField("هاتف المشرف / المسؤول", max_length=50, blank=True)
    is_active = models.BooleanField("مفعل للخدمة", default=True)

    class Meta:
        verbose_name = "مركز توزيع مخزني"
        verbose_name_plural = "مراكز التوزيع المخزنية"
        ordering = ["code"]

    def __str__(self):
        return f"{self.name_ar} ({self.code})"


class WhatsAppVerificationSession(TimestampedModel):
    """Self-hosted WhatsApp interactive order confirmation & GPS pinning session."""

    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_ADDRESS_UPDATED = "address_updated"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = [
        (STATUS_PENDING, "بانتظار رد العميل"),
        (STATUS_CONFIRMED, "تم التأكيد من العميل بنجاح"),
        (STATUS_ADDRESS_UPDATED, "تم تحديث العنوان والـ GPS"),
        (STATUS_EXPIRED, "منتهي الصلاحية"),
    ]

    order = models.OneToOneField(
        "orders.Order",
        on_delete=models.CASCADE,
        related_name="whatsapp_session",
        verbose_name="الطلب",
    )
    customer_phone = models.CharField("هاتف العميل", max_length=50)
    token = models.CharField("رمز التحقق الآمن", max_length=64, unique=True, db_index=True)
    gps_lat = models.FloatField("خط العرض (Latitude)", null=True, blank=True)
    gps_lng = models.FloatField("خط الطول (Longitude)", null=True, blank=True)
    gps_address_text = models.TextField("العنوان المحدث من العميل", blank=True)
    status = models.CharField("حالة التأكيد", max_length=30, choices=STATUS_CHOICES, default=STATUS_PENDING)

    class Meta:
        verbose_name = "جلسة تأكيد واتساب"
        verbose_name_plural = "جلسات تأكيد الواتساب"
        ordering = ["-created_at"]

    def __str__(self):
        return f"جلسة واتساب #{self.order.order_number} ({self.get_status_display()})"
