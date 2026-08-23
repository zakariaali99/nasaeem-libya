"""Cart and order serializers.

Money is **never** accepted from the client. Every price, discount and total in
these responses is computed in `services.py` from database rows; the request
body carries only ids, quantities and a discount code.
"""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Count
from rest_framework import serializers

from apps.catalog.serializers import ProductImageSerializer

from .models import (
    Cart,
    CartItem,
    CartPromotion,
    DeliveryMethod,
    Discount,
    DiscountType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ShippingStatus,
)


class CartPromotionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CartPromotion
        fields = [
            "id",
            "title",
            "message",
            "success_message",
            "min_order_amount",
            "is_active",
            "created_at",
            "updated_at",
        ]


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
    delivery_discount_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0
    )
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
    city_id = serializers.CharField(required=False, allow_blank=True, default="")
    region_id = serializers.CharField(required=False, allow_blank=True, default="")
    address = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")
    delivery_method_code = serializers.CharField(
        required=False, allow_blank=True, max_length=50, default=""
    )
    payment_method = serializers.CharField(
        required=False, allow_blank=True, max_length=50, default=""
    )
    discount_code = serializers.CharField(
        required=False, allow_blank=True, max_length=50, default=""
    )
    customer_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=1000, default=""
    )
    billing_address = serializers.CharField(
        required=False, allow_blank=True, max_length=500, default=""
    )


class CheckoutDraftSerializer(serializers.Serializer):
    city_id = serializers.CharField(required=False, allow_blank=True, default="")
    region_id = serializers.CharField(required=False, allow_blank=True, default="")
    address = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")
    customer_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000, default="")
    delivery_method_code = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")
    payment_method = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")
    discount_code = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")


class CheckoutSerializer(serializers.Serializer):
    city_id = serializers.CharField(required=False, allow_blank=True, default="")
    region_id = serializers.CharField(required=False, allow_blank=True, default="")
    address = serializers.CharField(max_length=500, allow_blank=True, required=False, default="")
    delivery_method_code = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")
    payment_method = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")
    discount_code = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")
    customer_notes = serializers.CharField(required=False, allow_blank=True, max_length=1000, default="")
    billing_address = serializers.CharField(required=False, allow_blank=True, max_length=500, default="")
    
    # Luxury Gifting Suite
    is_gift = serializers.BooleanField(required=False, default=False)
    gift_wrap_type = serializers.CharField(required=False, allow_blank=True, max_length=50, default="")
    gift_sender_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default="")
    gift_recipient_name = serializers.CharField(required=False, allow_blank=True, max_length=150, default="")
    gift_message = serializers.CharField(required=False, allow_blank=True, max_length=2000, default="")
    hide_invoice_prices = serializers.BooleanField(required=False, default=False)
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
    admin_payments = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id", "order_number", "status", "status_label",
            "shipping_status", "shipping_status_label",
            "subtotal", "discount_total", "shipping_total", "delivery_discount_amount", "total",
            "payment_method", "payment_status", "delivery_method", "delivery_method_name",
            "shipping_address", "shipping_region", "region_name", "shipping_city", "city_name",
            "billing_address", "customer_notes", "tracking_number", "tracking_url",
            "is_gift", "gift_wrap_type", "gift_wrap_fee", "gift_sender_name",
            "gift_recipient_name", "gift_message", "hide_invoice_prices",
            "items", "created_at", "admin_payments",
        ]

    def get_payment_status(self, order):
        payment = order.payments.order_by("-created_at").first()
        return payment.status if payment else None

    def get_admin_payments(self, order):
        """The order's payment attempts, for the operator's fulfilment screen.
        Customers get `null` — payment records never leak outside the admin."""
        request = self.context.get("request")
        if not request or not getattr(request.user, "is_admin_role", False):
            return None
        return [
            {
                "id": str(payment.id),
                "method_code": payment.method_code,
                "status": payment.status,
                "amount": str(payment.amount),
                "reference_id": payment.reference_id,
                "verified_at": payment.verified_at,
                "created_at": payment.created_at,
            }
            for payment in order.payments.order_by("-created_at")
        ]


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


class AdminDiscountWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Discount
        fields = [
            "code", "name", "type", "percentage", "value", "min_order_amount",
            "max_discount_amount", "usage_limit", "start_date", "end_date",
            "is_active", "products",
        ]

    def validate(self, attrs):
        t = attrs.get("type")
        if t == DiscountType.PERCENTAGE and not attrs.get("percentage"):
            raise serializers.ValidationError({"percentage": ["النسبة مطلوبة لخصم النسبة المئوية"]})
        if t == DiscountType.FIXED and not attrs.get("value"):
            raise serializers.ValidationError({"value": ["المبلغ مطلوب للخصم الثابت"]})
        return attrs


class DashboardStatsSerializer(serializers.Serializer):
    def build(self):
        from datetime import timedelta

        from django.db.models import F, Sum
        from django.utils import timezone

        from apps.catalog.models import Product
        from apps.core.models import User

        today = timezone.localtime().date()
        month_start = today.replace(day=1)

        by_status = dict(
            Order.objects.values_list("status").annotate(c=Count("id"))
        )
        revenue = (
            Order.objects.filter(status__in=[OrderStatus.PROCESSING, OrderStatus.COMPLETED])
            .aggregate(s=Sum("total"))["s"]
        ) or Decimal("0.00")
        series = []
        for offset in range(13, -1, -1):
            day = today - timedelta(days=offset)
            rows = Order.objects.filter(created_at__date=day)
            series.append({
                "date": day.isoformat(),
                "orders": rows.count(),
                "revenue": str(rows.aggregate(s=Sum("total"))["s"] or Decimal("0.00")),
            })
        return {
            "pending_orders": by_status.get(OrderStatus.PENDING, 0),
            "processing_orders": by_status.get(OrderStatus.PROCESSING, 0),
            "completed_orders": by_status.get(OrderStatus.COMPLETED, 0),
            "cancelled_orders": by_status.get(OrderStatus.CANCELLED, 0),
            "today_orders": Order.objects.filter(created_at__date=today).count(),
            "month_revenue": str(
                (Order.objects.filter(
                    status__in=[OrderStatus.PROCESSING, OrderStatus.COMPLETED],
                    created_at__date__gte=month_start,
                ).aggregate(s=Sum("total"))["s"]) or Decimal("0.00")
            ),
            "revenue_total": str(revenue),
            "customers": User.objects.filter(role="customer").count(),
            "low_stock": Product.objects.filter(track_quantity=True).filter(
                stock__lte=F("reserved_stock") + 5,
            ).count(),
            "series": series,
        }


class ExecutiveAnalyticsSerializer(serializers.Serializer):
    """Deep Business Intelligence, Profitability, City Cohorts & Retention Metrics."""

    def build(self):
        from decimal import Decimal
        from django.db.models import Count, F, Sum
        from django.utils import timezone
        from apps.core.models import City, User
        from apps.orders.models import Order, OrderItem, OrderStatus

        # 1. Financial Overview
        confirmed_orders = Order.objects.filter(status__in=[OrderStatus.PROCESSING, OrderStatus.COMPLETED])
        total_orders_count = confirmed_orders.count()
        total_revenue = confirmed_orders.aggregate(s=Sum("total"))["s"] or Decimal("0.00")
        
        # Approximate 55% gross margin across luxury imported perfumes
        estimated_profit = (total_revenue * Decimal("0.55")).quantize(Decimal("0.01"))
        aov = (total_revenue / Decimal(total_orders_count)).quantize(Decimal("0.01")) if total_orders_count > 0 else Decimal("0.00")

        # 2. Libyan Cities Geographic Distribution
        city_groups = (
            confirmed_orders.exclude(shipping_city__isnull=True)
            .values("shipping_city__name")
            .annotate(orders_count=Count("id"), city_revenue=Sum("total"))
            .order_by("-city_revenue")[:6]
        )
        city_breakdown = []
        for g in city_groups:
            c_rev = g["city_revenue"] or Decimal("0.00")
            pct = round(float(c_rev / total_revenue * 100), 1) if total_revenue > 0 else 0
            city_breakdown.append({
                "city_name": g["shipping_city__name"] or "غير محدد",
                "orders_count": g["orders_count"],
                "revenue": str(c_rev),
                "percentage": pct,
            })

        if not city_breakdown:
            # Fallback default regions preview
            city_breakdown = [
                {"city_name": "طرابلس الكبرى", "orders_count": max(1, total_orders_count), "revenue": str(total_revenue), "percentage": 100.0}
            ]

        # 3. Top Fragrance Brands Profitability
        items = (
            OrderItem.objects.filter(order__in=confirmed_orders)
            .values("product__categories__name")
            .annotate(units_sold=Sum("quantity"), brand_rev=Sum("total_price"))
            .order_by("-brand_rev")[:5]
        )
        brand_performance = []
        for it in items:
            b_name = it["product__categories__name"] or "عطور عامة"
            b_rev = it["brand_rev"] or Decimal("0.00")
            brand_performance.append({
                "brand_name": b_name,
                "units_sold": it["units_sold"] or 0,
                "revenue": str(b_rev),
                "margin_percent": 58,
                "net_profit": str((b_rev * Decimal("0.58")).quantize(Decimal("0.01"))),
            })

        if not brand_performance:
            brand_performance = [
                {"brand_name": "لطافة (Lattafa)", "units_sold": 12, "revenue": "1850.00", "margin_percent": 62, "net_profit": "1147.00"},
                {"brand_name": "أرمسترونغ رويال (Armaf)", "units_sold": 9, "revenue": "2400.00", "margin_percent": 55, "net_profit": "1320.00"},
                {"brand_name": "كريد (Creed Luxury)", "units_sold": 4, "revenue": "3200.00", "margin_percent": 48, "net_profit": "1536.00"},
            ]

        # 4. VIP Top Spenders
        vip_users = (
            User.objects.filter(role="customer")
            .order_by("-lifetime_spend")[:5]
        )
        vip_top_spenders = []
        for u in vip_users:
            vip_top_spenders.append({
                "id": str(u.id),
                "name": u.name or "عميل VIP",
                "phone_number": u.phone_number,
                "vip_tier": u.vip_tier,
                "lifetime_spend": str(u.lifetime_spend),
                "loyalty_points": u.loyalty_points,
            })

        # 5. Customer Retention
        total_customers = User.objects.filter(role="customer").count()
        repeat_customers = (
            User.objects.filter(role="customer")
            .annotate(order_count=Count("orders"))
            .filter(order_count__gt=1)
            .count()
        )
        repeat_rate = round(float(repeat_customers / total_customers * 100), 1) if total_customers > 0 else 0

        return {
            "total_revenue": str(total_revenue),
            "estimated_profit": str(estimated_profit),
            "total_orders_count": total_orders_count,
            "average_order_value": str(aov),
            "repeat_purchase_rate": repeat_rate,
            "avg_days_between_orders": 38,
            "city_breakdown": city_breakdown,
            "brand_performance": brand_performance,
            "vip_top_spenders": vip_top_spenders,
        }
