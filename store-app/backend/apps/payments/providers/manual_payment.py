"""Manual payment — bank transfer or cash, verified by an operator."""

from __future__ import annotations

import time

from apps.orders.models import PaymentStatus

from .base import InitiationResult, PaymentGateway


class ManualPaymentGateway(PaymentGateway):
    code = "manual_payment"
    name = "الدفع اليدوي"

    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        payment_id = f"MANUAL_{int(time.time() * 1000)}_{order.id}"
        payment_data = {
            "transferReceipt": user_input.get("transferReceipt") or None,
            "transferDate": user_input.get("transferDate"),
            "transferNote": user_input.get("transferNote") or "",
            "amount": str(order.total),
            "instructionsAr": config.get("instructionsAr") or "",
        }
        return InitiationResult(
            success=True,
            next_step=PaymentStatus.WAITING_FOR_VERIFICATION,
            message="تم تسجيل طلب الدفع اليدوي بنجاح. سيتم مراجعة الدفع من قبل فريق الإدارة.",
            payment_id=payment_id,
            transaction_id=f"TX_MANUAL_{int(time.time() * 1000)}",
            data=payment_data,
        )
