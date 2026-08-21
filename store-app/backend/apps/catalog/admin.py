from django.contrib import admin

from .models import (
    Category,
    Collection,
    InventoryLog,
    Product,
    ProductCategory,
    ProductCollection,
    ProductImage,
    ProductVariant,
    VariantOption,
    VariantValue,
)


class ProductImageInline(admin.TabularInline):
    model = ProductImage
    extra = 0
    fields = ("url", "alt_text", "sort_order")


class ProductVariantInline(admin.TabularInline):
    model = ProductVariant
    extra = 0
    fields = ("sku", "price", "compare_at_price", "stock", "reserved_stock", "is_active")


class ProductCategoryInline(admin.TabularInline):
    model = ProductCategory
    extra = 0
    autocomplete_fields = ("category",)


class ProductCollectionInline(admin.TabularInline):
    model = ProductCollection
    extra = 0
    autocomplete_fields = ("collection",)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "price", "stock", "reserved_stock", "available", "is_active")
    list_filter = ("is_active", "has_variants", "track_quantity")
    search_fields = ("name", "sku", "slug", "barcode")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [ProductImageInline, ProductVariantInline, ProductCategoryInline, ProductCollectionInline]
    readonly_fields = ("id", "created_at", "updated_at")

    @admin.display(description="المتاح")
    def available(self, obj):
        return obj.available_stock


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "parent", "is_active", "is_system")
    list_filter = ("is_active", "is_system")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    autocomplete_fields = ("parent",)


@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


class VariantValueInline(admin.TabularInline):
    model = VariantValue
    extra = 0


@admin.register(VariantOption)
class VariantOptionAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)
    inlines = [VariantValueInline]


@admin.register(VariantValue)
class VariantValueAdmin(admin.ModelAdmin):
    list_display = ("option", "value")
    list_filter = ("option",)
    search_fields = ("value", "option__name")


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("product", "sku", "price", "stock", "reserved_stock", "is_active")
    list_filter = ("is_active",)
    search_fields = ("sku", "product__name")
    autocomplete_fields = ("product",)
    filter_horizontal = ("values",)


@admin.register(InventoryLog)
class InventoryLogAdmin(admin.ModelAdmin):
    """Append-only: the admin may read this table, never write it."""

    list_display = ("created_at", "product", "variant", "change", "reason", "user")
    list_filter = ("reason", "created_at")
    search_fields = ("product__name", "note")
    readonly_fields = tuple(f.name for f in InventoryLog._meta.fields)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
