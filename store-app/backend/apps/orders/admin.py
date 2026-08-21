from django.contrib import admin

from .models import (
    Cart,
    CartItem,
    DeliveryMethod,
    Discount,
    Order,
    OrderItem,
    PaymentMethodConfiguration,
)


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    # Snapshotted values: an order is a historical record.
    readonly_fields = ("product", "variant", "product_name", "quantity", "unit_price", "total_price")
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "user", "status", "shipping_status", "total", "created_at")
    list_filter = ("status", "shipping_status", "payment_method", "created_at")
    search_fields = ("order_number", "user__phone_number", "reference_id", "tracking_number")
    readonly_fields = ("id", "order_number", "subtotal", "discount_total", "shipping_total", "total", "created_at", "updated_at")
    inlines = [OrderItemInline]
    autocomplete_fields = ("user", "delivery_method", "discount", "shipping_city", "shipping_region")


class CartItemInline(admin.TabularInline):
    model = CartItem
    extra = 0
    autocomplete_fields = ("product", "variant")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "session_id", "expires_at", "updated_at")
    search_fields = ("user__phone_number", "session_id")
    inlines = [CartItemInline]


@admin.register(Discount)
class DiscountAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "type", "value", "percentage", "is_active", "usage_count", "usage_limit")
    list_filter = ("type", "is_active")
    search_fields = ("code", "name")
    filter_horizontal = ("products",)
    readonly_fields = ("usage_count",)


@admin.register(DeliveryMethod)
class DeliveryMethodAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code")


@admin.register(PaymentMethodConfiguration)
class PaymentMethodConfigurationAdmin(admin.ModelAdmin):
    """`config_data` holds gateway secrets. Visible to Django superusers here
    and nowhere else — the public API never serialises it."""

    list_display = ("display_name", "method_code", "is_enabled", "sort_order")
    list_filter = ("is_enabled",)
    search_fields = ("method_code", "display_name")
