from rest_framework import serializers

from apps.core.models import City, Region


class RegionSerializer(serializers.ModelSerializer):
    city_name = serializers.CharField(source="city.name", read_only=True)
    delivery_fee = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = [
            "id", "name", "city", "city_name", "delivery_fee",
            "estimated_delivery_days", "is_active",
        ]

    def get_delivery_fee(self, region):
        """The fee the customer will actually be charged: the region's own, or
        the city's when the region does not set one. Returning the raw 0.00
        would show "توصيل مجاني" on a region that simply inherits."""
        from apps.orders.services import delivery_fee

        return delivery_fee(region)


class CitySerializer(serializers.ModelSerializer):
    region_count = serializers.SerializerMethodField()

    class Meta:
        model = City
        fields = ["id", "name", "code", "delivery_fee", "is_active", "region_count"]

    def get_region_count(self, city):
        return city.regions.filter(is_active=True).count()


class AdminDeliveryMethodSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.orders.models import DeliveryMethod

        model = DeliveryMethod
        fields = ["id", "name", "code", "description", "is_active", "configuration", "created_at", "updated_at"]
        read_only_fields = ["id", "code", "created_at", "updated_at"]


class CourierTrackingEventSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import CourierTrackingEvent

        model = CourierTrackingEvent
        fields = [
            "id",
            "courier_code",
            "status_code",
            "status_label_ar",
            "location",
            "driver_name",
            "driver_phone",
            "notes",
            "occurred_at",
            "created_at",
        ]


class CODReconciliationItemSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import CODReconciliationItem

        model = CODReconciliationItem
        fields = [
            "id",
            "order",
            "tracking_number",
            "order_number",
            "recipient_name",
            "expected_amount",
            "collected_amount",
            "delivery_fee",
            "discrepancy_amount",
            "match_status",
            "status_note",
            "is_approved",
        ]


class CODReconciliationStatementSerializer(serializers.ModelSerializer):
    items = CODReconciliationItemSerializer(many=True, read_only=True)
    operator_name = serializers.CharField(source="operator_user.name", read_only=True, default="")

    class Meta:
        from .models import CODReconciliationStatement

        model = CODReconciliationStatement
        fields = [
            "id",
            "statement_id",
            "courier_code",
            "courier_name",
            "period_start",
            "period_end",
            "total_orders_count",
            "matched_orders_count",
            "discrepancies_count",
            "total_collected_expected",
            "total_collected_actual",
            "total_delivery_fees",
            "net_bank_deposit",
            "status",
            "operator_name",
            "items",
            "created_at",
            "updated_at",
        ]


class WarehouseHubSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import WarehouseHub

        model = WarehouseHub
        fields = [
            "id",
            "code",
            "name_ar",
            "city_coverage",
            "address",
            "manager_phone",
            "is_active",
        ]

