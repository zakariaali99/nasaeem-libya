"""Catalogue: categories, collections, products, variants, images, inventory.

Available stock is always `stock - reserved_stock`. Nothing in this app may sell
against `stock` alone.
"""

import uuid

from django.conf import settings
from django.db import models


class TimestampedModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Category(TimestampedModel):
    name = models.CharField("الاسم", max_length=100, unique=True)
    # allow_unicode is required on every slug in this project: Arabic slugs must work.
    slug = models.SlugField(
        "المعرّف", max_length=100, unique=True, allow_unicode=True, db_index=True
    )
    description = models.TextField("الوصف", blank=True)
    image_url = models.CharField("الصورة", max_length=255, blank=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="التصنيف الأب",
    )
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    is_system = models.BooleanField("تصنيف نظامي", default=False)

    class Meta:
        verbose_name = "تصنيف"
        verbose_name_plural = "التصنيفات"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Collection(TimestampedModel):
    name = models.CharField("الاسم", max_length=100, unique=True)
    slug = models.SlugField(
        "المعرّف", max_length=100, unique=True, allow_unicode=True, db_index=True
    )
    description = models.TextField("الوصف", blank=True)
    is_active = models.BooleanField("نشط", default=True, db_index=True)

    class Meta:
        verbose_name = "مجموعة"
        verbose_name_plural = "المجموعات"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Product(TimestampedModel):
    name = models.CharField("الاسم", max_length=100, db_index=True)
    slug = models.SlugField(
        "المعرّف", max_length=100, unique=True, allow_unicode=True, db_index=True
    )
    description = models.TextField("الوصف", blank=True)
    price = models.DecimalField(
        "السعر", max_digits=10, decimal_places=2, null=True, blank=True, db_index=True
    )
    compare_at_price = models.DecimalField(
        "السعر قبل الخصم", max_digits=10, decimal_places=2, null=True, blank=True
    )
    sku = models.CharField("رمز المنتج", max_length=50, blank=True, db_index=True)
    barcode = models.CharField("الباركود", max_length=50, blank=True)
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    has_variants = models.BooleanField("يحتوي على خيارات", default=False)
    track_quantity = models.BooleanField("تتبّع الكمية", default=False)
    stock = models.IntegerField("المخزون", default=0)
    reserved_stock = models.IntegerField("المخزون المحجوز", default=0)
    meta_title = models.CharField("عنوان SEO", max_length=255, blank=True)
    meta_description = models.TextField("وصف SEO", blank=True)
    width = models.IntegerField("العرض", null=True, blank=True)
    length = models.IntegerField("الطول", null=True, blank=True)
    height = models.IntegerField("الارتفاع", null=True, blank=True)
    weight = models.DecimalField(
        "الوزن", max_digits=10, decimal_places=2, null=True, blank=True
    )
    categories = models.ManyToManyField(
        Category, through="ProductCategory", related_name="products", blank=True
    )
    collections = models.ManyToManyField(
        Collection, through="ProductCollection", related_name="products", blank=True
    )

    class Meta:
        verbose_name = "منتج"
        verbose_name_plural = "المنتجات"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name

    @property
    def available_stock(self):
        """Never sell against `stock` alone."""
        return self.stock - self.reserved_stock

    @property
    def is_in_stock(self):
        return not self.track_quantity or self.available_stock > 0


class ProductCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.CASCADE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "تصنيف منتج"
        verbose_name_plural = "تصنيفات المنتجات"
        constraints = [
            models.UniqueConstraint(
                fields=["product", "category"], name="unique_product_category"
            )
        ]


class ProductCollection(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    collection = models.ForeignKey(Collection, on_delete=models.CASCADE, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "مجموعة منتج"
        verbose_name_plural = "مجموعات المنتجات"
        constraints = [
            models.UniqueConstraint(
                fields=["product", "collection"], name="unique_product_collection"
            )
        ]


class VariantOption(TimestampedModel):
    """An option axis — الحجم, اللون."""

    name = models.CharField("اسم الخيار", max_length=100)

    class Meta:
        verbose_name = "خيار"
        verbose_name_plural = "الخيارات"
        ordering = ["name"]

    def __str__(self):
        return self.name


class VariantValue(TimestampedModel):
    option = models.ForeignKey(
        VariantOption, on_delete=models.CASCADE, related_name="values", verbose_name="الخيار"
    )
    value = models.CharField("القيمة", max_length=100)

    class Meta:
        verbose_name = "قيمة خيار"
        verbose_name_plural = "قيم الخيارات"
        ordering = ["option__name", "value"]

    def __str__(self):
        return f"{self.option.name}: {self.value}"


class ProductVariant(TimestampedModel):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="variants", verbose_name="المنتج"
    )
    sku = models.CharField("رمز المنتج", max_length=50, blank=True, db_index=True)
    price = models.DecimalField(
        "السعر", max_digits=10, decimal_places=2, null=True, blank=True
    )
    compare_at_price = models.DecimalField(
        "السعر قبل الخصم", max_digits=10, decimal_places=2, null=True, blank=True
    )
    stock = models.IntegerField("المخزون", default=0)
    reserved_stock = models.IntegerField("المخزون المحجوز", default=0)
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    values = models.ManyToManyField(
        VariantValue, related_name="variants", verbose_name="القيم", blank=True
    )

    class Meta:
        verbose_name = "خيار منتج"
        verbose_name_plural = "خيارات المنتجات"
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.product.name} ({self.sku or self.id})"

    @property
    def available_stock(self):
        return self.stock - self.reserved_stock


class ProductImage(TimestampedModel):
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="images", verbose_name="المنتج"
    )
    url = models.CharField("الرابط", max_length=255)
    alt_text = models.CharField("النص البديل", max_length=255, blank=True)
    sort_order = models.IntegerField("الترتيب", default=0)

    class Meta:
        verbose_name = "صورة منتج"
        verbose_name_plural = "صور المنتجات"
        ordering = ["sort_order", "created_at"]

    def __str__(self):
        return f"{self.product.name} [{self.sort_order}]"


class InventoryLog(models.Model):
    """Append-only. Never update or delete a row in this table."""

    class Reason(models.TextChoices):
        MANUAL = "manual", "تعديل يدوي"
        SALE = "sale", "بيع"
        RESERVATION = "reservation", "حجز"
        RELEASE = "release", "إلغاء حجز"
        RESTOCK = "restock", "إعادة تخزين"
        RETURN = "return", "مرتجع"
        CORRECTION = "correction", "تصحيح"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, on_delete=models.CASCADE, related_name="inventory_logs", verbose_name="المنتج"
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="inventory_logs",
        verbose_name="الخيار",
    )
    change = models.IntegerField("التغيير")
    reason = models.CharField("السبب", max_length=32, choices=Reason.choices)
    note = models.TextField("ملاحظة", blank=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_logs",
        verbose_name="المستخدم",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = "سجل مخزون"
        verbose_name_plural = "سجلات المخزون"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.product.name} {self.change:+d} ({self.get_reason_display()})"

    def save(self, *args, **kwargs):
        if self.pk is not None and not self._state.adding:
            raise ValueError("سجل المخزون للقراءة فقط ولا يمكن تعديله")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValueError("سجل المخزون لا يمكن حذفه")
