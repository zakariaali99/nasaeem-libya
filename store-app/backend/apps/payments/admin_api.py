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


class AdminPaymentRefundView(APIView):
    """`POST /api/admin/payments/<uuid:payment_id>/refund/` — 1-Click Gateway/Manual Refund."""

    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from decimal import Decimal, InvalidOperation
        from apps.payments.models import Payment
        from apps.payments.refund_service import process_payment_refund
        from apps.payments.serializers import PaymentRefundSerializer

        payment = Payment.objects.filter(id=payment_id).first()
        if not payment:
            return Response({"message": "سجل الدفعة غير موجود"}, status=http_status.HTTP_404_NOT_FOUND)

        try:
            amount = Decimal(str(request.data.get("amount") or payment.amount))
        except (InvalidOperation, ValueError):
            return Response({"message": "مبلغ الاسترداد غير صالح"}, status=http_status.HTTP_400_BAD_REQUEST)

        reason = str(request.data.get("reason") or "").strip()

        try:
            refund = process_payment_refund(
                payment_id=str(payment.id),
                amount=amount,
                reason=reason,
                operator_user=request.user,
            )
            return Response({
                "data": PaymentRefundSerializer(refund).data,
                "message": f"تم استرداد {refund.amount} د.ل بنجاح",
            })
        except Exception as e:
            return Response({"message": str(e)}, status=http_status.HTTP_400_BAD_REQUEST)


class AdminPaymentReconcileView(APIView):
    """`POST /api/admin/payments/reconcile/` — On-demand payment reconciliation daemon trigger."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from apps.payments.reconciliation_service import reconcile_pending_payments

        min_age = int(request.data.get("min_age") or 3)
        max_age = int(request.data.get("max_age") or 1440)

        result = reconcile_pending_payments(min_age_minutes=min_age, max_age_minutes=max_age)
        return Response({"data": result, "message": result["message"]})


class AdminLedgerSummaryView(APIView):
    """`GET /api/admin/ledger/summary/` — Financial balance positions & net profits."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from apps.payments.ledger_service import get_ledger_summary

        summary = get_ledger_summary()
        return Response({"data": summary})


class AdminLedgerTransactionsView(APIView):
    """`GET /api/admin/ledger/transactions/` — Double-entry audit trail log."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from apps.payments.models import LedgerTransaction
        from apps.payments.serializers import LedgerTransactionSerializer

        txns = LedgerTransaction.objects.prefetch_related("entries__account").order_by("-created_at")[:100]
        return Response({"data": LedgerTransactionSerializer(txns, many=True).data})


class AdminCourierSettlementView(APIView):
    """`POST /api/admin/ledger/settle-courier/` — Settle courier collected COD cash."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)

        from decimal import Decimal, InvalidOperation
        from apps.payments.ledger_service import record_courier_settlement

        courier_name = str(request.data.get("courier_name") or "").strip()
        if not courier_name:
            return Response({"message": "اسم شركة الشحن / المندوب مطلوب"}, status=http_status.HTTP_400_BAD_REQUEST)

        try:
            collected_amount = Decimal(str(request.data.get("collected_amount") or "0"))
            delivery_fee = Decimal(str(request.data.get("delivery_fee") or "0"))
            bank_deposit = Decimal(str(request.data.get("bank_deposit") or "0"))
        except (InvalidOperation, ValueError):
            return Response({"message": "المبالغ المدخلة غير صحيحة"}, status=http_status.HTTP_400_BAD_REQUEST)

        if collected_amount != (delivery_fee + bank_deposit):
            return Response(
                {"message": f"المبالغ غير متطابقة: المبلغ المحصل ({collected_amount}) يجب أن يساوي الإيداع البنكي ({bank_deposit}) + عمولة الشحن ({delivery_fee})"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        reference_id = str(request.data.get("reference_id") or "").strip()

        try:
            txn = record_courier_settlement(
                courier_name=courier_name,
                collected_amount=collected_amount,
                delivery_fee=delivery_fee,
                bank_deposit=bank_deposit,
                reference_id=reference_id,
            )
            return Response({"data": {"transaction_id": str(txn.id)}, "message": "تم تسجيل تسوية المندوب وترحيل القيود بنجاح"})
        except Exception as e:
            return Response({"message": str(e)}, status=http_status.HTTP_400_BAD_REQUEST)
