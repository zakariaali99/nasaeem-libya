"""Bank cards on delivery — a POS terminal at the door; the operator or driver
marks the payment collected."""

from __future__ import annotations

import time

from apps.orders.models import PaymentStatus

from .base import InitiationResult, PaymentGateway


class BankCardsOnDeliveryGateway(PaymentGateway):
    code = "bank_cards_on_delivery"
    name = "بطاقة مصرفية عند الاستلام"

    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        payment_id = f"BANKCARD_{int(time.time() * 1000)}_{order.id}"
        payment_data = {
            "customerNote": user_input.get("customerNote") or "",
            "amount": str(order.total),
            "instructionsAr": config.get("instructionsAr") or "",
        }
        return InitiationResult(
            success=True,
            next_step=PaymentStatus.PENDING,
            message="تم اختيار الدفع بالبطاقة المصرفية عند الاستلام. سيتم الدفع وقت التسليم.",
            payment_id=payment_id,
            transaction_id=f"TX_BANKCARD_{int(time.time() * 1000)}",
            data=payment_data,
        )
