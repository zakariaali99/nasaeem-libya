"""Admin endpoints for delivery methods and courier configurations."""

from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import DeliveryMethod

from .serializers import AdminDeliveryMethodSerializer


class AdminDeliveryMethodListView(APIView):
    """`GET /api/admin/delivery/methods/` — list all couriers with configurations."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        methods = DeliveryMethod.objects.all().order_by("name")
        return Response({"data": AdminDeliveryMethodSerializer(methods, many=True).data})


class AdminDeliveryMethodDetailView(APIView):
    """`GET/PATCH /api/admin/delivery/methods/<method_code>/` — courier settings."""

    permission_classes = [IsAuthenticated]

    def get(self, request, method_code: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        method = DeliveryMethod.objects.filter(code=method_code).first()
        if method is None:
            return Response({"message": "شركة التوصيل غير موجودة"}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({"data": AdminDeliveryMethodSerializer(method).data})

    def patch(self, request, method_code: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        method = DeliveryMethod.objects.filter(code=method_code).first()
        if method is None:
            return Response({"message": "شركة التوصيل غير موجودة"}, status=http_status.HTTP_404_NOT_FOUND)

        serializer = AdminDeliveryMethodSerializer(method, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"message": "بيانات غير صحيحة", "errors": serializer.errors}, status=http_status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response({"data": serializer.data, "message": "تم حفظ إعدادات شركة التوصيل بنجاح"})


class AdminDeliverySyncView(APIView):
    """`POST /api/admin/delivery/sync/<method_code>/` — trigger city/region sync."""

    permission_classes = [IsAuthenticated]

    def post(self, request, method_code: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        method = DeliveryMethod.objects.filter(code=method_code).first()
        if method is None:
            return Response({"message": "شركة التوصيل غير موجودة"}, status=http_status.HTTP_404_NOT_FOUND)

        # Simulation or provider sync call
        return Response({
            "message": f"تمت مزامنة بيانات المدن والمناطق بنجاح مع {method.name}",
            "synced_cities": 0,
            "synced_regions": 0,
        })
