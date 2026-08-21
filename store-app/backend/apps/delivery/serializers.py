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
