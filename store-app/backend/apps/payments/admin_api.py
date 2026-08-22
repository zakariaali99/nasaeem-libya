"""Admin endpoints for payment gateway configurations."""

from rest_framework import status as http_status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import PaymentMethodConfiguration

from .serializers import AdminPaymentMethodSerializer


class AdminPaymentMethodListView(APIView):
    """`GET /api/admin/payment_methods/` — list all payment method configurations."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        methods = PaymentMethodConfiguration.objects.all().order_by("sort_order", "display_name")
        return Response({"data": AdminPaymentMethodSerializer(methods, many=True).data})


class AdminPaymentMethodDetailView(APIView):
    """`GET/PATCH /api/admin/payment_methods/<method_code>/` — get or update a gateway config."""

    permission_classes = [IsAuthenticated]

    def get(self, request, method_code: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        method = PaymentMethodConfiguration.objects.filter(method_code=method_code).first()
        if method is None:
            return Response({"message": "طريقة الدفع غير موجودة"}, status=http_status.HTTP_404_NOT_FOUND)
        return Response({"data": AdminPaymentMethodSerializer(method).data})

    def patch(self, request, method_code: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        method = PaymentMethodConfiguration.objects.filter(method_code=method_code).first()
        if method is None:
            return Response({"message": "طريقة الدفع غير موجودة"}, status=http_status.HTTP_404_NOT_FOUND)

        serializer = AdminPaymentMethodSerializer(method, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({"message": "بيانات غير صحيحة", "errors": serializer.errors}, status=http_status.HTTP_400_BAD_REQUEST)

        serializer.save()
        return Response({"data": serializer.data, "message": "تم حفظ الإعدادات بنجاح"})
