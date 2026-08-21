"""Operator API for cities and regions — fees, activation, region creation."""

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.core.models import City, Region


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["id", "name", "city", "delivery_fee", "estimated_delivery_days", "is_active"]


class CitySerializer(serializers.ModelSerializer):
    regions = RegionSerializer(many=True, read_only=True)

    class Meta:
        model = City
        fields = ["id", "name", "code", "delivery_fee", "is_active", "regions"]


class AdminCityListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        cities = City.objects.prefetch_related("regions").order_by("name")
        return Response({"data": CitySerializer(cities, many=True).data})


class AdminCityDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, city_id):
        city = City.objects.filter(id=city_id).first()
        if city is None:
            return Response({"message": "المدينة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        allowed = {"delivery_fee", "is_active"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for field, value in data.items():
            setattr(city, field, value)
        city.save(update_fields=[*data.keys(), "updated_at"])
        return Response({"data": CitySerializer(city).data, "message": "تم تحديث المدينة"})


class AdminRegionCreateView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        serializer = RegionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if Region.objects.filter(
                name__iexact=serializer.validated_data["name"],
                city_id=serializer.validated_data["city"].id,
            ).exists():
                return Response({"message": "توجد منطقة بهذا الاسم في هذه المدينة"},
                                status=status.HTTP_400_BAD_REQUEST)
            region = serializer.save()
        return Response({"data": RegionSerializer(region).data,
                         "message": "تم إنشاء المنطقة"}, status=status.HTTP_201_CREATED)


class AdminRegionDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get_object(self, region_id):
        return Region.objects.filter(id=region_id).first()

    def patch(self, request, region_id):
        region = self.get_object(region_id)
        if region is None:
            return Response({"message": "المنطقة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        allowed = {"delivery_fee", "is_active", "estimated_delivery_days"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for field, value in data.items():
            setattr(region, field, value)
        region.save(update_fields=[*data.keys(), "updated_at"])
        return Response({"data": RegionSerializer(region).data, "message": "تم تحديث المنطقة"})
