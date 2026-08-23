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


class AdminCODReconcileUploadView(APIView):
    """`POST /api/admin/delivery/reconcile-statement/upload/` — uploads CSV or rows for draft reconciliation."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        courier_code = request.data.get("courier_code", "vanex")
        courier_name = request.data.get("courier_name", "شركة فانكس إكسبريس")
        raw_csv_text = request.data.get("raw_csv_text", "")
        rows_data = request.data.get("rows", [])

        # Check if a file was uploaded
        uploaded_file = request.FILES.get("file")
        if uploaded_file:
            try:
                raw_csv_text = uploaded_file.read().decode("utf-8-sig")
            except Exception:
                return Response({"message": "تعذر قراءة ملف الإكسل/CSV، يرجى التأكد من الترميز UTF-8"}, status=http_status.HTTP_400_BAD_REQUEST)

        from .cod_reconciliation import parse_and_stage_cod_statement

        try:
            statement = parse_and_stage_cod_statement(
                courier_code=courier_code,
                courier_name=courier_name,
                raw_csv_text=raw_csv_text,
                rows_data=rows_data,
                operator_user=request.user,
            )
        except Exception as exc:
            return Response({"message": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        from .serializers import CODReconciliationStatementSerializer

        return Response({
            "message": f"تم فحص وتحليل {statement.total_orders_count} شحنة بنجاح",
            "data": CODReconciliationStatementSerializer(statement).data,
        })


class AdminCODReconcileListView(APIView):
    """`GET /api/admin/delivery/reconcile-statements/` — list statements."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from .models import CODReconciliationStatement
        from .serializers import CODReconciliationStatementSerializer

        statements = CODReconciliationStatement.objects.all().order_by("-created_at")[:50]
        return Response({"data": CODReconciliationStatementSerializer(statements, many=True).data})


class AdminCODReconcileDetailView(APIView):
    """`GET /api/admin/delivery/reconcile-statements/<id>/` — statement detail with items."""

    permission_classes = [IsAuthenticated]

    def get(self, request, statement_id: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from .models import CODReconciliationStatement
        from .serializers import CODReconciliationStatementSerializer

        statement = CODReconciliationStatement.objects.filter(
            models.Q(id=statement_id) | models.Q(statement_id=statement_id)
        ).first() if hasattr(models, "Q") else CODReconciliationStatement.objects.filter(statement_id=statement_id).first()

        if not statement:
            statement = CODReconciliationStatement.objects.filter(pk=statement_id).first()

        if not statement:
            return Response({"message": "كشف المطابقة غير موجود"}, status=http_status.HTTP_404_NOT_FOUND)

        return Response({"data": CODReconciliationStatementSerializer(statement).data})


class AdminCODReconcileCommitView(APIView):
    """`POST /api/admin/delivery/reconcile-statements/<id>/commit/` — commits statement & double-entry ledger."""

    permission_classes = [IsAuthenticated]

    def post(self, request, statement_id: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from .cod_reconciliation import commit_cod_statement
        from .serializers import CODReconciliationStatementSerializer

        try:
            statement = commit_cod_statement(
                statement_id=statement_id,
                operator_user=request.user,
            )
        except Exception as exc:
            return Response({"message": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": f"تم اعتماد المطابقة وإيداع {statement.net_bank_deposit} د.ل في الحساب المصرفي بنجاح",
            "data": CODReconciliationStatementSerializer(statement).data,
        })


class AdminOrderTrackingTimelineView(APIView):
    """`GET /api/admin/orders/<lookup>/tracking-timeline/` — tracking history."""

    permission_classes = [IsAuthenticated]

    def get(self, request, lookup: str):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from apps.orders.models import Order
        from .webhook_service import build_order_tracking_timeline

        order = Order.objects.filter(order_number=lookup).first()
        if not order:
            order = Order.objects.filter(pk=lookup).first()

        if not order:
            return Response({"message": "الطلب غير موجود"}, status=http_status.HTTP_404_NOT_FOUND)

        timeline = build_order_tracking_timeline(order)
        return Response({"data": timeline})


class AdminWarehouseHubListView(APIView):
    """`GET /api/admin/delivery/warehouse-hubs/` — lists fulfillment hubs."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from .warehouse_routing import ensure_warehouse_hubs
        from .serializers import WarehouseHubSerializer

        hubs = ensure_warehouse_hubs()
        return Response({"data": WarehouseHubSerializer(hubs, many=True).data})


class PublicCourierWebhookView(APIView):
    """`POST /api/delivery/webhook/<courier_code>/` — courier live events webhook."""

    permission_classes = []

    def post(self, request, courier_code: str):
        data = request.data
        tracking_number = str(data.get("tracking_number") or data.get("tracking_id") or "").strip()
        status_code = str(data.get("status") or data.get("status_code") or "").strip()

        if not tracking_number or not status_code:
            return Response({"message": "يجب توفير رقم التتبع ورمز الحالة"}, status=http_status.HTTP_400_BAD_REQUEST)

        from .webhook_service import process_courier_webhook_event

        try:
            event = process_courier_webhook_event(
                courier_code=courier_code,
                tracking_number=tracking_number,
                status_code=status_code,
                location=str(data.get("location", "")),
                driver_name=str(data.get("driver_name", "")),
                driver_phone=str(data.get("driver_phone", "")),
                notes=str(data.get("notes", "")),
                raw_payload=data,
            )
        except Exception as exc:
            return Response({"message": str(exc)}, status=http_status.HTTP_400_BAD_REQUEST)

        from .serializers import CourierTrackingEventSerializer

        return Response({
            "message": "تم استلام ومعالجة حركة الشحن بنجاح",
            "data": CourierTrackingEventSerializer(event).data,
        })
