"""SADAD Pay — ported from the reference's sadadPayFactory.

The reference implementation is itself a stand-in (no credentials exist), so
this port preserves its observable behaviour: the payment-id format, the
redirect shape, the WAITING_FOR_VERIFICATION step, and the webhook status
mapping. The HTTP call site is isolated in `_create_remote_payment` so tests
stub it.
"""

from __future__ import annotations

import time

from apps.orders.models import PaymentStatus

from .base import InitiationResult, PaymentGateway, WebhookResult

_STATUS_MAP = {
    "SUCCESS": PaymentStatus.COMPLETED,
    "PAID": PaymentStatus.COMPLETED,
    "FAILED": PaymentStatus.FAILED,
    "REJECTED": PaymentStatus.FAILED,
    "REFUNDED": PaymentStatus.REFUNDED,
}


class SadadPayGateway(PaymentGateway):
    code = "sadad_pay"
    name = "سداد باي"

    def _create_remote_payment(self, order_id: str) -> tuple[str, str]:
        """Returns (payment_id, redirect_url). The reference built these
        deterministically without a network call; so does this."""
        payment_id = f"SADAD_{int(time.time() * 1000)}_{order_id}"
        redirect_url = f"https://example.com/sadad-payment?paymentId={payment_id}&orderId={order_id}"
        return payment_id, redirect_url

    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        payment_id, redirect_url = self._create_remote_payment(str(order.id))
        return InitiationResult(
            success=True,
            next_step=PaymentStatus.WAITING_FOR_VERIFICATION,
            message="تم بدء عملية الدفع بنجاح. سيتم تحويلك إلى بوابة سداد لإكمال الدفع.",
            payment_id=payment_id,
            transaction_id=f"TX_SADAD_{int(time.time() * 1000)}",
            redirect_url=redirect_url,
            data={"paymentId": payment_id},
        )

    def handle_webhook(self, payload: dict, headers: dict, config: dict) -> WebhookResult:
        status_raw = str(payload.get("status", "")).upper()
        status = _STATUS_MAP.get(status_raw, PaymentStatus.PENDING)
        return WebhookResult(
            success=status == PaymentStatus.COMPLETED,
            order_number=str(payload.get("orderId") or ""),
            transaction_id=str(payload.get("paymentId") or ""),
            status=status,
            message="تم معالجة إشعار الدفع بنجاح" if status != PaymentStatus.PENDING else "حالة غير معروفة",
            raw=payload,
        )
