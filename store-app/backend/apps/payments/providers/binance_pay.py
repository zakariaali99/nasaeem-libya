"""Binance Pay — ported from the reference's binancePayFactory.

Request signing is HMAC-SHA512 over `timestamp\nnonce\nbody\n` with an
uppercase hex digest. Webhook verification is RSA-SHA256 against a certificate
fetched from Binance by serial number — the fetch is isolated so tests can
inject a fixed public key.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
from decimal import Decimal

from apps.orders.models import PaymentStatus

from .base import InitiationResult, PaymentGateway, WebhookResult

DEFAULT_HOST = "https://bpay.binanceapi.com"

_STATUS_MAP = {
    "PAY_SUCCESS": PaymentStatus.COMPLETED,
    "PAID": PaymentStatus.COMPLETED,
    "PAY_CLOSED": PaymentStatus.FAILED,
    "PAY_FAIL": PaymentStatus.FAILED,
    "PAY_REFUND": PaymentStatus.REFUNDED,
}


def _nonce(length: int = 32) -> str:
    alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _sign(api_secret: str, timestamp: str, nonce: str, body: str) -> str:
    content = f"{timestamp}\n{nonce}\n{body}\n"
    return hmac.new(api_secret.encode(), content.encode(), "sha512").hexdigest().upper()


class BinancePayGateway(PaymentGateway):
    code = "binance_pay"
    name = "بينانس باي"

    def _request(self, *, config: dict, path: str, body: str, method: str = "POST") -> tuple[int, dict]:
        import json as _json
        import urllib.request

        host = config.get("host") or DEFAULT_HOST
        timestamp = str(int(__import__("time").time() * 1000))
        nonce = _nonce()
        headers = {
            "Content-Type": "application/json",
            "BinancePay-Timestamp": timestamp,
            "BinancePay-Nonce": nonce,
            "BinancePay-Certificate-SN": config.get("apiKey", ""),
            "BinancePay-Signature": _sign(config.get("apiSecret", ""), timestamp, nonce, body),
        }
        req = urllib.request.Request(f"{host}{path}", data=None if method == "GET" else body.encode(),
                                     headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, _json.loads(resp.read().decode())

    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        multiplier = Decimal(str(config.get("multiplier") or 1))
        usdt_amount = (Decimal(order.total) * multiplier).quantize(Decimal("0.01"))
        payload: dict = {
            "merchantId": config.get("merchantId"),
            "merchantTradeNo": order.order_number,
            "amount": f"{usdt_amount}",
            "currency": "USDT",
        }
        if config.get("returnUrl"):
            payload["returnUrl"] = config["returnUrl"]
        if config.get("notifyUrl"):
            payload["notifyUrl"] = config["notifyUrl"]

        try:
            status, result = self._request(
                config=config, path="/binancepay/openapi/v3/order",
                body=json.dumps(payload),
            )
        except Exception:
            return InitiationResult(success=False,
                                    message="فشل في بدء عملية الدفع. يرجى المحاولة مرة أخرى.")
        if status >= 400:
            return InitiationResult(success=False,
                                    message=result.get("errorMessage") or result.get("message") or "API Error")
        data = result.get("data") or {}
        return InitiationResult(
            success=True,
            next_step=PaymentStatus.PENDING,
            message="تم بدء عملية الدفع بنجاح",
            payment_id=str(data.get("prepayId") or ""),
            transaction_id=str(data.get("prepayId") or ""),
            redirect_url=data.get("checkoutUrl"),
            data={"prepayId": data.get("prepayId"), "checkoutUrl": data.get("checkoutUrl")},
        )

    def verify_remotely(self, *, payment, config: dict) -> WebhookResult | None:
        query = f"merchantTradeNo={payment.order.order_number}&merchantId={config.get('merchantId')}"
        try:
            status, result = self._request(
                config=config, path=f"/binancepay/openapi/v3/query?{query}", body="", method="GET",
            )
        except Exception:
            return None
        if status >= 400:
            return None
        status_str = (result.get("data") or {}).get("status")
        mapped = _STATUS_MAP.get(status_str, PaymentStatus.PENDING)
        return WebhookResult(
            success=mapped == PaymentStatus.COMPLETED,
            order_number=payment.order.order_number,
            transaction_id=(result.get("data") or {}).get("transactionId"),
            status=mapped,
            message="تم التحقق من الدفع بنجاح",
        )

    def _fetch_certificate(self, serial: str, config: dict) -> str:
        """Public-key PEM for a certificate serial. Isolated for test injection."""
        _, result = self._request(
            config=config, path="/binancepay/openapi/certificates",
            body=json.dumps({"certSerial": serial}),
        )
        return (result.get("data") or {}).get("certPublic", "")

    def handle_webhook(self, payload: dict, headers: dict, config: dict) -> WebhookResult:
        from cryptography.exceptions import InvalidSignature
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding
        from cryptography.hazmat.primitives.serialization import load_pem_public_key

        ts = headers.get("binancepay-timestamp")
        nonce = headers.get("binancepay-nonce")
        sn = headers.get("binancepay-certificate-sn")
        sig = headers.get("binancepay-signature")
        if not ts or not nonce or not sn or not sig:
            return WebhookResult(success=False, signature_valid=False,
                                 message="Missing webhook signature headers")

        raw_body = json.dumps(payload)
        sign_content = f"{ts}\n{nonce}\n{raw_body}\n".encode()
        try:
            pem = self._fetch_certificate(sn, config)
            pubkey = load_pem_public_key(pem.encode())
            pubkey.verify(base64.b64decode(sig), sign_content,
                          padding.PKCS1v15(), hashes.SHA256())
            valid = True
        except (InvalidSignature, Exception):
            valid = False
        if not valid:
            return WebhookResult(success=False, signature_valid=False,
                                 message="Invalid webhook signature", raw=payload)

        status_raw = payload.get("status")
        mapped = _STATUS_MAP.get(status_raw, PaymentStatus.PENDING)
        return WebhookResult(
            success=mapped == PaymentStatus.COMPLETED,
            order_number=str(payload.get("merchantTradeNo") or ""),
            transaction_id=payload.get("transactionId") or payload.get("prepayId"),
            status=mapped,
            amount=_maybe_decimal(payload.get("amount")),
            message="تم معالجة إشعار الدفع بنجاح",
            raw=payload,
        )


def _maybe_decimal(value) -> Decimal | None:
    try:
        return Decimal(str(value))
    except Exception:
        return None


