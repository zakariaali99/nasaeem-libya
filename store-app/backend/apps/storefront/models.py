"""The homepage CMS: layouts and the widgets they contain.

The homepage is entirely CMS-driven. No layout means no homepage — which is why
the empty state matters more here than anywhere else in the app.
"""

import uuid

from django.db import models


class WidgetType(models.TextChoices):
    CAROUSEL = "carousel", "سلايدر متحرك"
    TEXT_BLOCK = "text_block", "كتلة نصية"
    IMAGE = "image", "صورة"
    PRODUCT_LIST = "product_list", "قائمة منتجات"
    COLLECTION_SHOWCASE = "collection_showcase", "عرض مجموعة"
    CATEGORY_LIST = "category_list", "قائمة تصنيفات"
    PHOTO_LINK_GRID = "photo_link_grid", "شبكة صور بروابط"
    HERO_CTA = "hero_cta", "بانر رئيسي تفاعلي"
    ANNOUNCEMENT_BAR = "announcement_bar", "شريط الإعلانات"
    SPACER = "spacer", "فاصل مساحي"
    RECENTLY_VIEWED = "recently_viewed", "شوهدت مؤخراً"
    BUY_AGAIN = "buy_again", "إعادة شراء"
    RECOMMENDED_FOR_YOU = "recommended_for_you", "موصى به لك"
    TRENDING_NEAR_YOU = "trending_near_you", "رائج في منطقتك"


class StorefrontLayout(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField("الاسم", max_length=255)
    is_global_active = models.BooleanField("مفعّل عام", default=False, db_index=True)
    active_start_date = models.DateTimeField("يبدأ في", null=True, blank=True)
    active_end_date = models.DateTimeField("ينتهي في", null=True, blank=True)
    active_days = models.JSONField("أيام التفعيل", default=list, blank=True)
    active_start_hour = models.IntegerField("ساعة البداية", null=True, blank=True)
    active_end_hour = models.IntegerField("ساعة النهاية", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "تخطيط المتجر"
        verbose_name_plural = "تخطيطات المتجر"
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name


class Widget(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    layout = models.ForeignKey(
        StorefrontLayout, on_delete=models.CASCADE, related_name="widgets",
        verbose_name="التخطيط",
    )
    type = models.CharField("النوع", max_length=32, choices=WidgetType.choices)
    # Normalised on write by the serializer, so the client never has to guess
    # between imageUrl / image_url / url for the same field.
    data = models.JSONField("البيانات", default=dict, blank=True)
    order = models.IntegerField("الترتيب", default=0, db_index=True)
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    style = models.JSONField("النمط", null=True, blank=True)
    targeting = models.JSONField("الاستهداف", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "عنصر"
        verbose_name_plural = "عناصر الواجهة"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.get_type_display()} [{self.order}]"
