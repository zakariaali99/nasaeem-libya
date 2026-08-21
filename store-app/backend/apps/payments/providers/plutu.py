"""Plutu — the Libyan payment aggregator.

One integration, several rails (sadadapi, edfali, mpgs, tlync, localbankcards).
Callback-hash verification is ported from the reference's verifyPlutuHash,
which follows the field sets of Plutu's official PHP SDK in exact order:
base string = url-encoded `k=v` pairs of the known callback fields that are
present, HMAC-SHA256 with the plain secret key, uppercase hex. A raw
(non-encoded) variant is tried as a fallback, exactly as the reference did.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from urllib.parse import quote

from apps.orders.models import PaymentStatus

from .base import InitiationResult, PaymentGateway, WebhookResult

DEFAULT_BASE = "https://api.plutus.ly/api/v1"

# Known callback parameters per gateway, in the PHP SDK's exact order.
CALLBACK_FIELDS: dict[str, list[str]] = {
    "localbankcards": ["gateway", "approved", "canceled", "invoice_no", "amount", "transaction_id"],
    "mpgs": ["gateway", "approved", "canceled", "amount", "currency", "invoice_no", "transaction_id"],
    "tlync_callback": ["gateway", "approved", "invoice_no", "amount", "transaction_id", "payment_method"],
    "tlync_return": ["approved", "invoice_no"],
}


def verify_plutu_hash(secret_key: str | None, data: dict, fields: list[str]) -> bool:
    if not secret_key:
        return True
    received = str(data.get("hashed") or data.get("hash") or data.get("Hashed") or "").upper()
    if not received:
        return True

    included = [(k, str(data[k])) for k in fields if data.get(k) not in (None, "",)]
    encoded = "&".join(f"{quote(k)}={quote(v)}" for k, v in included)
    computed = hmac.new(secret_key.encode(), encoded.encode(), hashlib.sha256).hexdigest().upper()
    if hmac.compare_digest(computed, received):
        return True
    raw = "&".join(f"{k}={v}" for k, v in included)
    raw_computed = hmac.new(secret_key.encode(), raw.encode(), hashlib.sha256).hexdigest().upper()
    return hmac.compare_digest(raw_computed, received)


def _plutu_request(*, config: dict, gateway: str, endpoint: str, payload: dict) -> tuple[int, dict]:
    import json as _json
    import urllib.request

    base = config.get("apiBaseUrl") or DEFAULT_BASE
    url = f"{base}/transaction/{gateway}/{endpoint}"
    body = _json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "X-API-KEY": config.get("apiKey", ""),
        "Authorization": f"Bearer {config.get('accessToken', '')}",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, _json.loads(resp.read().decode())
    except Exception:
        return 500, {}


class BasePlutuGateway(PaymentGateway):
    """Redirect/OTP rails share this; subclasses name their gateway."""

    gateway: str = ""
    channel_flag: str = ""
    needs_otp = False

    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        if not config.get(self.channel_flag):
            return InitiationResult(
                success=False,
                message="القناة غير مفعلة في إعدادات بلوتو. يرجى تفعيلها أولاً من لوحة التحكم.",
            )
        payload: dict = {
            "order_id": order.order_number,
            "invoice_no": order.order_number,
            "amount": str(order.total),
            "return_url": user_input.get("returnUrl"),
            "checkout_page": user_input.get("checkoutPage"),
            "customer_ip": user_input.get("customerIp"),
            "lang": user_input.get("lang") or "ar",
        }
        if self.needs_otp:
            mobile = user_input.get("mobile_number")
            birth_year = user_input.get("birth_year")
            if not mobile or not birth_year:
                return InitiationResult(
                    success=False,
                    message="يرجى إدخال رقم الهاتف وسنة الميلاد لإرسال رمز التحقق.",
                )
            payload = {
                "order_id": order.order_number,
                "amount": str(order.total),
                "mobile_number": mobile,
                "birth_year": birth_year,
            }
            status, body = _plutu_request(config=config, gateway=self.gateway,
                                          endpoint="verify", payload=payload)
            if status == 200 and body.get("result", {}).get("process_id"):
                return InitiationResult(
                    success=True,
                    next_step=PaymentStatus.WAITING_FOR_VERIFICATION,
                    message="تم إرسال رمز التحقق إلى هاتفك. أدخل الرمز لإتمام الدفع.",
                    data={"processId": body["result"]["process_id"]},
                )
            error = body.get("error", {}).get("message")
            return InitiationResult(success=False,
                                    message=error or "فشل إرسال رمز التحقق. حاول مرة أخرى.")

        if self.gateway == "tlync":
            if not user_input.get("mobile_number"):
                return InitiationResult(success=False, message="رقم الهاتف مطلوب لقناة Tlync.")
            payload["mobile_number"] = user_input["mobile_number"]
            payload["email"] = user_input.get("email")
            payload["callback_url"] = user_input.get("callbackUrl") or user_input.get("returnUrl")

        status, body = _plutu_request(config=config, gateway=self.gateway,
                                      endpoint="confirm", payload=payload)
        redirect_url = body.get("result", {}).get("redirect_url")
        if status == 200 and redirect_url:
            return InitiationResult(
                success=True,
                next_step=PaymentStatus.PENDING,
                message="سيتم تحويلك لإتمام الدفع عبر بلوتو.",
                transaction_id=str(body["result"].get("transaction_id") or ""),
                redirect_url=redirect_url,
                data={"redirectUrl": redirect_url},
            )
        error = body.get("error", {}).get("message")
        return InitiationResult(success=False, message=error or "فشل بدء عملية الدفع عبر بلوتو.")

    def confirm_otp(self, *, payment, otp: str, process_id: str, config: dict) -> WebhookResult:
        payload = {"code": otp, "process_id": process_id}
        status, body = _plutu_request(config=config, gateway=self.gateway,
                                      endpoint="confirm", payload=payload)
        if status == 200:
            return WebhookResult(
                success=True,
                order_number=payment.order.order_number,
                transaction_id=str(body.get("result", {}).get("transaction_id") or f"TX_{time.time()}"),
                status=PaymentStatus.COMPLETED,
                message="تم التحقق من الدفع عبر بلوتو.",
            )
        error = body.get("error", {}).get("message")
        return WebhookResult(success=False, message=error or "فشل تأكيد الدفع. تأكد من رمز OTP وحاول مرة أخرى.")


class PlutuSadadGateway(BasePlutuGateway):
    code = "plutu_sadad"
    name = "سداد (عبر بلوتو)"
    gateway = "sadadapi"
    channel_flag = "enableSadadApi"
    needs_otp = True


class PlutuEdFaliGateway(BasePlutuGateway):
    code = "plutu_edfali"
    name = "إدفعلي (عبر بلوتو)"
    gateway = "edfali"
    channel_flag = "enableEdFali"
    needs_otp = True


class PlutuMpgsGateway(BasePlutuGateway):
    code = "plutu_mpgs"
    name = "MPGS (عبر بلوتو)"
    gateway = "mpgs"
    channel_flag = "enableMpgs"


class PlutuTlyncGateway(BasePlutuGateway):
    code = "plutu_tlync"
    name = "Tlync (عبر بلوتو)"
    gateway = "tlync"
    channel_flag = "enableTlync"

    def callback_fields_for(self, data: dict) -> list[str]:
        return CALLBACK_FIELDS["tlync_callback" if data.get("gateway") else "tlync_return"]


class PlutuLocalCardsGateway(BasePlutuGateway):
    code = "plutu_local_cards"
    name = "بطاقات محلية (عبر بلوتو)"
    gateway = "localbankcards"
    channel_flag = "enableLocalCards"
