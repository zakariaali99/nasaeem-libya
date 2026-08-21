"""Marsol OTP — used for password reset ONLY.

There is no OTP login in this project. `08-features.md`: phone + password only.
Marsol is retained solely so a forgotten password does not require manual admin
intervention.

Request shape ported from the reference (`src/lib/marsol.ts`):

    POST https://api.marsol.ly/public/otp/initiate
      x-auth-token: <MARSOL_API_TOKEN>
      {phoneNumber, length: 6, expiration: 300, operation, senderId}
    -> {success, requestId, resendToken, status: "PENDING"}

    POST https://api.marsol.ly/public/otp/verify
      x-auth-token: <MARSOL_API_TOKEN>
      {code, requestId, operation}
    -> {status: "SUCCESS", recipient: "<phone>"}

**Two bypasses in the reference are deliberately NOT ported:**

1. `const PHONE_NUMBER = "0920010991"` with `VERIFICATION = "111111"` short-
   circuited both calls, so one hardcoded number could reset any password
   without an OTP ever being sent.
2. On verify, `phoneNumber = verificationResult.recipient ?? PHONE_NUMBER` fell
   back to that same number whenever the provider omitted `recipient`.

No test number, no fixed code, no `if DEBUG` shortcut exists here. Tests use
`DummyOtpProvider` through dependency injection instead.
"""

import logging
import secrets

from django.core.cache import cache
from decouple import config

logger = logging.getLogger(__name__)

OTP_TTL_SECONDS = 300
RESET_TTL_SECONDS = 600
CACHE_PREFIX = "pwreset"


class OtpError(Exception):
    """Provider failure. The view converts this into a generic Arabic message."""


class MarsolOtpProvider:
    """Live provider. Refuses to run without credentials rather than pretending
    to succeed."""

    INITIATE_URL = "https://api.marsol.ly/public/otp/initiate"
    VERIFY_URL = "https://api.marsol.ly/public/otp/verify"

    def __init__(self):
        self.token = config("MARSOL_API_TOKEN", default="")
        self.sender_id = config("MARSOL_SENDER_ID", default="")

    @property
    def is_configured(self):
        return bool(self.token and self.sender_id)

    def _post(self, url, payload):
        import json
        import urllib.error
        import urllib.request

        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json", "x-auth-token": self.token},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                return json.loads(response.read().decode())
        except urllib.error.URLError as exc:
            logger.warning("marsol request failed url=%s error=%s", url, exc)
            raise OtpError("تعذّر إرسال رمز التحقق") from exc

    def send(self, phone_number, operation="password_reset"):
        if not self.is_configured:
            raise OtpError("خدمة الرسائل غير مهيّأة")
        data = self._post(self.INITIATE_URL, {
            "phoneNumber": phone_number,
            "length": 6,
            "expiration": OTP_TTL_SECONDS,
            "operation": operation,
            "senderId": self.sender_id,
        })
        request_id = data.get("requestId")
        if not request_id:
            raise OtpError("تعذّر إرسال رمز التحقق")
        return request_id

    def verify(self, request_id, code, operation="password_reset"):
        if not self.is_configured:
            raise OtpError("خدمة الرسائل غير مهيّأة")
        data = self._post(self.VERIFY_URL, {
            "code": code, "requestId": request_id, "operation": operation,
        })
        if data.get("status") != "SUCCESS":
            return None
        # No fallback phone. If the provider does not say whose number this was,
        # the verification is not usable.
        return data.get("recipient")


class DummyOtpProvider:
    """Test double. Never selected by settings — injected explicitly by tests.

    It is a fixture, not a bypass: it exists only inside the test process and no
    request path can reach it.
    """

    def __init__(self):
        self.sent = []

    @property
    def is_configured(self):
        return True

    def send(self, phone_number, operation="password_reset"):
        request_id = secrets.token_urlsafe(12)
        code = f"{secrets.randbelow(1_000_000):06d}"
        self.sent.append({"phone": phone_number, "request_id": request_id, "code": code})
        cache.set(f"dummyotp:{request_id}", {"phone": phone_number, "code": code}, OTP_TTL_SECONDS)
        return request_id

    def verify(self, request_id, code, operation="password_reset"):
        entry = cache.get(f"dummyotp:{request_id}")
        if not entry or not secrets.compare_digest(entry["code"], code):
            return None
        return entry["phone"]


def get_provider():
    return MarsolOtpProvider()


def remember_reset(request_id, phone_number):
    cache.set(f"{CACHE_PREFIX}:{request_id}", phone_number, RESET_TTL_SECONDS)


def recall_reset(request_id):
    return cache.get(f"{CACHE_PREFIX}:{request_id}")


def forget_reset(request_id):
    cache.delete(f"{CACHE_PREFIX}:{request_id}")
