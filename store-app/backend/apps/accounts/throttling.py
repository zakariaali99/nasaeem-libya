"""Throttles keyed on the submitted phone number, not only the IP.

Brute-forcing a password is cheaper than brute-forcing an OTP, so the per-account
limit matters more here, not less. An attacker rotating IPs against one account
is the case an IP-only throttle misses entirely.
"""

from rest_framework.throttling import SimpleRateThrottle

from .phone import normalise_phone


class PhoneScopedThrottle(SimpleRateThrottle):
    """Rate-limits by the phone number in the request body, falling back to the
    client IP when no usable phone was submitted (so a malformed flood is still
    limited)."""

    scope = "login"

    def get_cache_key(self, request, view):
        raw = request.data.get("phone_number") if hasattr(request, "data") else None
        phone = normalise_phone(raw)
        ident = phone or self.get_ident(request)
        return self.cache_format % {"scope": self.scope, "ident": ident}


class LoginThrottle(PhoneScopedThrottle):
    scope = "login"


class RegisterThrottle(PhoneScopedThrottle):
    scope = "register"


class PasswordResetThrottle(PhoneScopedThrottle):
    scope = "password_reset"
