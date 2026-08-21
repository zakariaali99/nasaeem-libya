"""Cart, orders, discounts, delivery and payment configuration.

The enum values below are normative — they are what the reference stored and
what the admin screens display. Do not rename a value to make code read better;
the Arabic label is the only thing a user sees.
"""

import uuid

from django.conf import settings
from django.db import models

from apps.catalog.models import Product, ProductVariant
from apps.core.models import City, Region


class OrderStatus(models.TextChoices):
    PENDING = "pending", "قيد الانتظار"
    PROCESSING = "processing", "قيد المعالجة"
    COMPLETED = "completed", "مكتمل"
    CANCELLED = "cancelled", "ملغي"
    REFUNDED = "refunded", "مسترجع"


class ShippingStatus(models.TextChoices):
    PENDING = "pending", "قيد الانتظار"
    ACCEPTED = "accepted", "تم القبول"
    DELIVERED = "delivered", "تم التوصيل"
    RETURNED = "returned", "مرتجع"
    CANCELLED = "cancelled", "ملغي"


class PaymentStatus(models.TextChoices):
    PENDING = "pending", "قيد الانتظار"
    COMPLETED = "completed", "مكتمل"
    FAILED = "failed", "فشل"
    CANCELLED = "cancelled", "ملغي"
    REFUNDED = "refunded", "مسترجع"
    WAITING_FOR_VERIFICATION = "waiting_for_verification", "بانتظار التحقق"


class DiscountType(models.TextChoices):
    PERCENTAGE = "percentage", "نسبة مئوية"
    FIXED = "fixed", "مبلغ ثابت"


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class DeliveryMethod(TimestampedModel):
    name = models.CharField("الاسم", max_length=100, unique=True)
    code = models.CharField("الرمز", max_length=50, unique=True)
    description = models.TextField("الوصف", blank=True)
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    # Courier credentials and options. Never serialised to a non-admin client.
    configuration = models.JSONField("الإعدادات", default=dict, blank=True)

    class Meta:
        verbose_name = "طريقة توصيل"
        verbose_name_plural = "طرق التوصيل"
        ordering = ["name"]

    def __str__(self):
        return self.name


class PaymentMethodConfiguration(TimestampedModel):
    method_code = models.CharField("رمز الطريقة", max_length=50, unique=True, db_index=True)
    display_name = models.CharField("الاسم المعروض", max_length=100)
    description = models.TextField("الوصف", blank=True)
    # Gateway secrets live here. The public endpoint returns method_code,
    # display_name, description and sort_order — never this field.
    config_data = models.JSONField("الإعدادات", default=dict, blank=True)
    is_enabled = models.BooleanField("مفعّل", default=False, db_index=True)
    sort_order = models.IntegerField("الترتيب", default=0)

    class Meta:
        verbose_name = "إعداد طريقة دفع"
        verbose_name_plural = "إعدادات طرق الدفع"
        ordering = ["sort_order", "display_name"]

    def __str__(self):
        return self.display_name


class Discount(TimestampedModel):
    code = models.CharField(
        "الرمز", max_length=50, unique=True, null=True, blank=True, db_index=True
    )
    name = models.CharField("الاسم", max_length=100)
    description = models.TextField("الوصف", blank=True)
    type = models.CharField("النوع", max_length=20, choices=DiscountType.choices)
    value = models.DecimalField("القيمة", max_digits=10, decimal_places=2, default=0)
    percentage = models.DecimalField(
        "النسبة", max_digits=10, decimal_places=2, default=0
    )
    products = models.ManyToManyField(
        Product, related_name="discounts", blank=True, verbose_name="المنتجات"
    )
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    start_date = models.DateTimeField("تاريخ البداية", null=True, blank=True, db_index=True)
    end_date = models.DateTimeField("تاريخ النهاية", null=True, blank=True, db_index=True)
    min_order_amount = models.DecimalField(
        "الحد الأدنى للطلب", max_digits=10, decimal_places=2, null=True, blank=True
    )
    max_discount_amount = models.DecimalField(
        "الحد الأقصى للخصم", max_digits=10, decimal_places=2, null=True, blank=True
    )
    usage_limit = models.IntegerField("حد الاستخدام", null=True, blank=True)
    usage_count = models.IntegerField("عدد الاستخدامات", default=0)

    class Meta:
        verbose_name = "خصم"
        verbose_name_plural = "الخصومات"
        ordering = ["-created_at"]

    def __str__(self):
        return self.code or self.name


class Cart(TimestampedModel):
    """A cart may exist without a user — `session_id` carries the guest basket.

    Requiring an account before a customer can add to a basket is the single
    largest conversion tax there is. Auth is required at checkout, not here.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="carts",
        verbose_name="المستخدم",
    )
    session_id = models.CharField("معرّف الجلسة", max_length=255, blank=True, db_index=True)
    expires_at = models.DateTimeField("تنتهي في", null=True, blank=True, db_index=True)

    class Meta:
        verbose_name = "سلة"
        verbose_name_plural = "السلات"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"سلة {self.user.phone_number if self.user else self.session_id or self.id}"


class CartItem(TimestampedModel):
    cart = models.ForeignKey(
        Cart, on_delete=models.CASCADE, related_name="items", verbose_name="السلة"
    )
    # PROTECT: deleting a product must never destroy a basket silently.
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="cart_items", verbose_name="المنتج"
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="cart_items",
        verbose_name="الخيار",
    )
    quantity = models.IntegerField("الكمية", default=1)

    class Meta:
        verbose_name = "عنصر سلة"
        verbose_name_plural = "عناصر السلة"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.name} × {self.quantity}"


class Order(TimestampedModel):
    order_number = models.CharField(
        "رقم الطلب", max_length=50, unique=True, db_index=True
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="العميل",
    )
    status = models.CharField(
        "الحالة", max_length=20, choices=OrderStatus.choices,
        default=OrderStatus.PENDING, db_index=True,
    )
    shipping_status = models.CharField(
        "حالة الشحن", max_length=20, choices=ShippingStatus.choices,
        default=ShippingStatus.PENDING, db_index=True,
    )
    subtotal = models.DecimalField("المجموع الفرعي", max_digits=10, decimal_places=2, default=0)
    discount_total = models.DecimalField("إجمالي الخصم", max_digits=10, decimal_places=2, default=0)
    shipping_total = models.DecimalField("إجمالي الشحن", max_digits=10, decimal_places=2, default=0)
    delivery_discount_amount = models.DecimalField(
        "خصم التوصيل", max_digits=10, decimal_places=2, default=0
    )
    total = models.DecimalField("الإجمالي", max_digits=10, decimal_places=2, default=0)
    payment_method = models.CharField("طريقة الدفع", max_length=50, blank=True)
    delivery_method = models.ForeignKey(
        DeliveryMethod,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="طريقة التوصيل",
    )
    discount = models.ForeignKey(
        Discount,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="الخصم",
    )
    shipping_address = models.TextField("عنوان الشحن", blank=True)
    shipping_region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="منطقة الشحن",
    )
    shipping_city = models.ForeignKey(
        City,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="orders",
        verbose_name="مدينة الشحن",
    )
    billing_address = models.TextField("عنوان الفوترة", blank=True)
    customer_notes = models.TextField("ملاحظات العميل", blank=True)
    tracking_number = models.CharField("رقم التتبع", max_length=100, blank=True)
    tracking_url = models.CharField("رابط التتبع", max_length=255, blank=True)
    reference_id = models.CharField("المرجع", max_length=100, blank=True, db_index=True)

    class Meta:
        verbose_name = "طلب"
        verbose_name_plural = "الطلبات"
        ordering = ["-created_at"]

    def __str__(self):
        return self.order_number


class OrderItem(TimestampedModel):
    """`product_name` and `unit_price` are snapshots taken at purchase time.

    An order is a historical record: renaming or repricing a product must never
    alter what a customer was charged.
    """

    order = models.ForeignKey(
        Order, on_delete=models.CASCADE, related_name="items", verbose_name="الطلب"
    )
    product = models.ForeignKey(
        Product, on_delete=models.PROTECT, related_name="order_items", verbose_name="المنتج"
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="order_items",
        verbose_name="الخيار",
    )
    quantity = models.IntegerField("الكمية", default=1)
    unit_price = models.DecimalField("سعر الوحدة", max_digits=10, decimal_places=2)
    total_price = models.DecimalField("الإجمالي", max_digits=10, decimal_places=2)
    product_name = models.CharField("اسم المنتج", max_length=255)

    class Meta:
        verbose_name = "عنصر طلب"
        verbose_name_plural = "عناصر الطلب"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product_name} × {self.quantity}"
