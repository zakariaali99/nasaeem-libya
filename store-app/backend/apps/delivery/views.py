"""Cities, regions and courier methods — all public reads.

> **The empty-city failure.** In the reference, the city list came only from a
> live courier API, and it was empty. Checkout rendered an empty dropdown with
> no explanation and the customer could not proceed.

Two things follow, and both are implemented here: cities are **seeded** so the
store works before any courier is configured, and when the list really is empty
the response says so in Arabic instead of returning a bare `[]` for the client
to render as an empty `<select>`.
"""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import City, Region
from apps.orders.models import DeliveryMethod
from apps.orders.serializers import DeliveryMethodSerializer

from .serializers import CitySerializer, RegionSerializer

EMPTY_CITIES = "لا توجد مدن توصيل مُعرّفة في المتجر حالياً، يرجى التواصل معنا لإتمام الطلب"
EMPTY_REGIONS = "لا توجد مناطق توصيل مُعرّفة لهذه المدينة حالياً"


class DeliveryMethodListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        methods = DeliveryMethod.objects.filter(is_active=True).order_by("name")
        return Response({"data": DeliveryMethodSerializer(methods, many=True).data})


class CityListView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cities = City.objects.filter(is_active=True).order_by("name")
        body = {"data": CitySerializer(cities, many=True).data}
        if not cities:
            body["message"] = EMPTY_CITIES
        return Response(body)


class CityDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, city_id):
        city = City.objects.filter(pk=city_id, is_active=True).first()
        if city is None:
            return Response({"message": "المدينة غير موجودة"}, status=404)
        return Response({"data": CitySerializer(city).data})


class CityRegionsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, city_id):
        city = City.objects.filter(pk=city_id, is_active=True).first()
        if city is None:
            return Response({"message": "المدينة غير موجودة"}, status=404)
        regions = city.regions.filter(is_active=True).order_by("name")
        body = {"data": RegionSerializer(regions, many=True).data}
        if not regions:
            body["message"] = EMPTY_REGIONS
        return Response(body)


class RegionDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, region_id):
        region = Region.objects.select_related("city").filter(pk=region_id).first()
        if region is None:
            return Response({"message": "المنطقة غير موجودة"}, status=404)
        return Response({"data": RegionSerializer(region).data})


class GeoView(APIView):
    """`GET /api/geo/` — the visitor's remembered delivery region, if any.

    **No IP geolocation.** The reference guessed from a header; this returns
    only what the customer has already told us — their default saved address —
    so nothing is inferred about where somebody is.
    """

    permission_classes = [AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"data": {"region": None, "city": None}})
        address = (
            request.user.addresses.select_related("region__city")
            .order_by("-is_default", "-created_at")
            .first()
        )
        if address is None:
            return Response({"data": {"region": None, "city": None}})
        return Response({"data": {
            "region": RegionSerializer(address.region).data,
            "city": CitySerializer(address.region.city).data,
        }})
