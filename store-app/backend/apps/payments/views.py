"""Payment endpoints.

Three surfaces, three trust levels:

- `POST /api/payments/` — the customer starting a payment (session + CSRF).
- `POST /api/payments/webhook/<method>/` — the provider calling us. It cannot
  authenticate as a session and carries no CSRF token; its protection is the
  signature check inside every gateway's `handle_webhook`. A plain APIView is
  used deliberately: SessionAuthentication skips CSRF for unauthenticated
  requests, so nothing here can act on a browser session even if one exists.
- `GET /api/payments/redirect/<order_id>/` — the customer back from the
  gateway, polling for the authoritative state.
"""

import logging

from rest_framework import status as http_status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, PaymentStatus
from apps.orders.views import _may_see

from . import services
from .models import Payment

logger = logging.getLogger(__name__)


class PaymentInitiateView(APIView):
    """`POST /api/payments/` — {order_id, method_code, user_input?}."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("order_id") or ""
        method_code = str(request.data.get("method_code") or "").strip()
        order = Order.objects.filter(id=order_id).first() if order_id else None
        if order is None or not _may_see(request.user, order):
            return Response(
                {"message": "الطلب غير موجود"}, status=http_status.HTTP_404_NOT_FOUND
            )

        try:
            result = services.initiate_payment(
                order=order,
                method_code=method_code,
                user_input=request.data.get("user_input") or {},
            )
        except services.PaymentError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)
        except KeyError:
            return Response(
                {"message": "طريقة الدفع غير متاحة حالياً", "errors": {"method_code": ["طريقة الدفع غير متاحة حالياً"]}},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        return Response({"data": result})


class PaymentWebhookView(APIView):
    """`POST /api/payments/webhook/<method_code>/` — provider notifications."""

    permission_classes = [AllowAny]

    def post(self, request, method_code: str):
        # Providers POST arbitrary content types; force parsing to a dict.
        payload = request.data if isinstance(request.data, dict) else {}
        try:
            body, status_code = services.handle_webhook(
                method_code=method_code, payload=payload, headers=dict(request.headers)
            )
        except KeyError:
            return Response(
                {"success": False, "message": "طريقة دفع غير معروفة"},
                status=http_status.HTTP_404_NOT_FOUND,
            )
        except Exception:
            logger.exception("payment webhook crashed: method=%s", method_code)
            return Response(
                {"success": False, "message": "خطأ غير متوقع"},
                status=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(body, status=status_code)


class PaymentRedirectView(APIView):
    """`GET /api/payments/redirect/<order_id>/` — state poll after returning
    from a gateway. Handles arriving before AND after the webhook."""

    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = Order.objects.filter(id=order_id).first()
        if order is None or not _may_see(request.user, order):
            return Response(
                {"message": "الطلب غير موجود"}, status=http_status.HTTP_404_NOT_FOUND
            )
        try:
            result = services.resolve_redirect(order=order)
        except services.PaymentError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)
        except KeyError:
            return Response({"message": "طريقة الدفع غير متاحة"}, status=400)

        order.refresh_from_db()
        from apps.orders.serializers import OrderSerializer

        return Response({
            "data": {
                **result,
                "order_status": order.status,
                "order": OrderSerializer(order, context={"request": request}).data,
            }
        })


class AdminPaymentListView(APIView):
    """`GET /api/admin/payments/` — the operator's payment ledger."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        payments = Payment.objects.select_related("order").order_by("-created_at")[:200]
        return Response({"data": [
            {
                "id": str(p.id),
                "order_number": p.order.order_number,
                "order_id": str(p.order_id),
                "method_code": p.method_code,
                "status": p.status,
                "amount": str(p.amount),
                "reference_id": p.reference_id,
                "verified_at": p.verified_at,
                "created_at": p.created_at,
            }
            for p in payments
        ]})


class AdminPaymentVerifyView(APIView):
    """`POST /api/admin/payments/<payment_id>/verify/` — an operator confirms a
    manual-transfer payment that sits in `waiting_for_verification`.

    The operator's click is treated exactly like a provider webhook: it enters
    the same `_confirm_payment` funnel, so a double-click credits once."""

    permission_classes = [IsAuthenticated]

    def post(self, request, payment_id):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=http_status.HTTP_403_FORBIDDEN)
        payment = Payment.objects.select_related("order").filter(id=payment_id).first()
        if payment is None:
            return Response(
                {"message": "الدفعة غير موجودة"}, status=http_status.HTTP_404_NOT_FOUND
            )
        # Completed passes through: verifying an already-verified payment is a
        # no-op answer ("already credited"), never an error — same philosophy
        # as a duplicate webhook. Only dead states are refused.
        if payment.status in (
            PaymentStatus.FAILED,
            PaymentStatus.CANCELLED,
            PaymentStatus.REFUNDED,
        ):
            return Response(
                {
                    "message": "لا يمكن تأكيد دفعة في هذه الحالة",
                    "errors": {"status": [f"الحالة الحالية: {payment.get_status_display()}"]},
                },
                status=http_status.HTTP_409_CONFLICT,
            )

        result = services.admin_verify(payment=payment)
        payment.refresh_from_db()
        message = "تم تأكيد الدفع" if result["credited"] else "كانت مؤكدة مسبقاً"
        return Response({"data": {**result, "message": message}})
