"""Moamalat — the Libyan national payment network.

Hashing, the lightbox payload, and webhook verification are ported exactly from
the reference (`src/modules/payments/factories/moamalatFactory.ts`). The
synthetic vector in `reference/fixtures/moamalat/synthetic-hash-vector.json`
anchors `moamalat_secure_hash` byte for byte.
"""

from __future__ import annotations

from decimal import Decimal

from django.utils import timezone

from apps.orders.models import PaymentStatus

from .base import InitiationResult, PaymentGateway, WebhookResult, moamalat_secure_hash

TEST_FILTER_URL = "https://tnpg.moamalat.net/cube/paylink.svc/api/FilterTransactions"
LIVE_FILTER_URL = "https://npg.moamalat.net/cube/paylink.svc/api/FilterTransactions"


class MoamalatGateway(PaymentGateway):
    code = "moamalat"
    name = "معاملات (Moamalat)"

    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        merchant_id = config.get("merchantId")
        terminal_id = config.get("terminalId")
        secure_key = config.get("secureKey")
        if not merchant_id or not terminal_id or not secure_key:
            return InitiationResult(
                success=False,
                message="إعدادات معاملات Moamalat غير مكتملة. يرجى التحقق من terminalId, merchantId, و secureKey.",
            )

        # Amount in the smallest unit the network expects: 1 LYD = 1000.
        amount_minor = int((Decimal(order.total) * 1000).to_integral_value())
        date_time_local_trxn = timezone.localtime().strftime("%Y%m%d%H%M")

        hash_params = {
            "Amount": amount_minor,
            "DateTimeLocalTrxn": date_time_local_trxn,
            "MerchantId": merchant_id,
            "MerchantReference": order.order_number,
            "TerminalId": terminal_id,
        }
        secure_hash = moamalat_secure_hash(hash_params, secure_key)

        lightbox_config = {
            "MID": merchant_id,
            "TID": terminal_id,
            "AmountTrxn": amount_minor,
            "MerchantReference": order.order_number,
            "TrxDateTime": date_time_local_trxn,
            "SecureHash": secure_hash,
            "OrderID": str(order.id),
            "paymentMethodFromLightBox": "card",
            "paymentId": str(order.id),
            "sandboxMode": bool(config.get("sandboxMode")),
        }
        return InitiationResult(
            success=True,
            next_step=PaymentStatus.PENDING,
            message="جاري تهيئة بوابة الدفع.",
            payment_id=str(order.id),
            data={"lightboxConfig": lightbox_config},
        )

    def handle_webhook(self, payload: dict, headers: dict, config: dict) -> WebhookResult:
        received = payload.get("SecureHash")
        if not received:
            return WebhookResult(
                success=False, signature_valid=False,
                message="فشل التحقق من توقيع الإشعار.", raw=payload,
            )
        params_to_hash = {k: v for k, v in payload.items() if k != "SecureHash"}
        calculated = moamalat_secure_hash(params_to_hash, config.get("secureKey", ""))
        if calculated != received:
            return WebhookResult(
                success=False, signature_valid=False,
                message="فشل التحقق من توقيع الإشعار.", raw=payload,
            )

        approved = payload.get("ResponseCode") == "00"
        return WebhookResult(
            success=approved,
            order_number=str(payload.get("MerchantReference") or ""),
            transaction_id=str(payload.get("SystemReference") or ""),
            status=PaymentStatus.COMPLETED if approved else PaymentStatus.FAILED,
            message=payload.get("Message", ""),
            raw=payload,
        )
