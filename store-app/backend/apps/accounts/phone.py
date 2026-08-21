"""Libyan phone number normalisation and validation.

One place decides what a valid Libyan mobile number is. Everything that accepts
a phone — register, login, password reset, the admin — goes through here, so a
number always reaches the database in a single canonical form.
"""

import re

from django.core.exceptions import ValidationError

# Libyan mobiles are 09X XXX XXXX. Live prefixes: 091/092 (Libyana),
# 093/094 (Al-Madar), 095 (Hatef Libya / LibyaPhone).
LIBYAN_MOBILE = re.compile(r"^09[1-5]\d{7}$")

INVALID_PHONE = "رقم الهاتف غير صحيح، يجب أن يبدأ بـ 09 ويتكوّن من 10 أرقام"


def normalise_phone(raw):
    """`+218 91-234 5678`, `0021891...`, `21891...` and `091...` all become
    `0912345678`. Returns None when the input cannot be a Libyan mobile."""
    if not raw:
        return None

    digits = re.sub(r"[^\d+]", "", str(raw))
    for prefix, replacement in (("+218", "0"), ("00218", "0"), ("218", "0")):
        if digits.startswith(prefix):
            digits = replacement + digits[len(prefix):]
            break

    # A bare 9-digit number missing its leading zero: 912345678 -> 0912345678
    if len(digits) == 9 and digits.startswith("9"):
        digits = "0" + digits

    return digits if LIBYAN_MOBILE.match(digits) else None


def validate_phone(raw):
    """Django-style validator: returns the canonical form or raises."""
    phone = normalise_phone(raw)
    if phone is None:
        raise ValidationError(INVALID_PHONE)
    return phone
