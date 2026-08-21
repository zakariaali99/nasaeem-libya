"""Cart and order serializers.

Money is **never** accepted from the client. Every price, discount and total in
these responses is computed in `services.py` from database rows; the request
body carries only ids, quantities and a discount code.
"""

from rest_framework import serializers

from apps.catalog.serializers import ProductImageSerializer

from .models import (
    Cart,
    CartItem,
    DeliveryMethod,
    Discount,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ShippingStatus,
)


class CartItemSerializer(serializers.Serializer):
    """Built from the `cart_summary()` rows, so the line total on screen is the
    same number the server would charge."""

    id = serializers.UUIDField(source="line.id")
    product_id = serializers.UUIDField(source="line.product_id")
    variant_id = serializers.UUIDField(source="line.variant_id", allow_null=True)
    name = serializers.CharField(source="line.product.name")
    slug = serializers.CharField(source="line.product.slug")
    quantity = serializers.IntegerField(source="line.quantity")
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    total_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    variant_label = serializers.SerializerMethodField()
    available_stock = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    def get_variant_label(self, item):
        variant = item["line"].variant
        return " / ".join(value.value for value in variant.values.all()) if variant else ""

    def get_available_stock(self, item):
        from . import services

        return services.available_stock(item["line"].product, item["line"].variant)

    def get_image(self, item):
        image = item["line"].product.images.first()
        return ProductImageSerializer(image, context=self.context).data if image else None


class CartSerializer(serializers.Serializer):
    id = serializers.UUIDField(allow_null=True)
    items = CartItemSerializer(many=True)
    item_count = serializers.IntegerField()
    subtotal = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    shipping_total = serializers.DecimalField(max_digits=10, decimal_places=2)
    total = serializers.DecimalField(max_digits=10, decimal_places=2)
    discount_code = serializers.CharField(allow_blank=True)
    discount_error = serializers.CharField(allow_null=True)
    region_id = serializers.CharField(allow_null=True)


class CartAddSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=999, default=1)


class CartUpdateSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1, max_value=999)


class CartDetailsSerializer(serializers.Serializer):
    """Checkout inputs held between screens.

    `02-data-model.md`'s `Cart` has no fields for an address or a note, and
    Phase 1's recorded decision is spec-normative models only — so these live in
    the session rather than in a column added on the quiet.
    """

    region_id = serializers.CharField(required=False, allow_blank=True)
    address = serializers.CharField(required=False, allow_blank=True, max_length=500)
    customer_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    delivery_method_code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    payment_method = serializers.CharField(required=False, allow_blank=True, max_length=50)
    discount_code = serializers.CharField(required=False, allow_blank=True, max_length=50)


class CheckoutSerializer(serializers.Serializer):
    region_id = serializers.CharField(allow_blank=True, required=False)
    address = serializers.CharField(max_length=500, allow_blank=True, required=False)
    delivery_method_code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    payment_method = serializers.CharField(required=False, allow_blank=True, max_length=50)
    discount_code = serializers.CharField(required=False, allow_blank=True, max_length=50)
    customer_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    billing_address = serializers.CharField(required=False, allow_blank=True, max_length=500)
    # There is deliberately no `total` field. The reference accepted one.


class OrderItemSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(source="product.slug", read_only=True)
    image = serializers.SerializerMethodField()
    variant_label = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = [
            "id", "product", "slug", "variant", "variant_label", "quantity",
            "unit_price", "total_price", "product_name", "image",
        ]

    def get_image(self, item):
        image = item.product.images.first()
        return ProductImageSerializer(image, context=self.context).data if image else None

    def get_variant_label(self, item):
        return " / ".join(value.value for value in item.variant.values.all()) if item.variant else ""


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    shipping_status_label = serializers.CharField(
        source="get_shipping_status_display", read_only=True
    )
    city_name = serializers.CharField(source="shipping_city.name", read_only=True, default="")
    region_name = serializers.CharField(source="shipping_region.name", read_only=True, default="")
    delivery_method_name = serializers.CharField(
        source="delivery_method.name", read_only=True, default=""
    )
    payment_status = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "status_label",
            "shipping_status", "shipping_status_label",
            "subtotal", "discount_total", "shipping_total", "delivery_discount_amount", "total",
            "payment_method", "payment_status", "delivery_method", "delivery_method_name",
            "shipping_address", "shipping_region", "region_name", "shipping_city", "city_name",
            "billing_address", "customer_notes", "tracking_number", "tracking_url",
            "items", "created_at",
        ]

    def get_payment_status(self, order):
        payment = order.payments.order_by("-created_at").first()
        return payment.status if payment else None


class DiscountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = [
            "id", "code", "name", "description", "type", "value", "percentage",
            "is_active", "start_date", "end_date", "min_order_amount",
            "max_discount_amount", "usage_limit", "usage_count",
        ]


class DeliveryMethodSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryMethod
        # `configuration` holds courier credentials and is never public.
        fields = ["id", "name", "code", "description", "is_active"]


ORDER_STATUS_CHOICES = OrderStatus.choices
SHIPPING_STATUS_CHOICES = ShippingStatus.choices
PAYMENT_STATUS_CHOICES = PaymentStatus.choices
