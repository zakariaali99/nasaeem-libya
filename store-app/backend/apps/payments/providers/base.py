"""Payment gateway contract.

Every gateway owns exactly one file under `providers/` and conforms to this
interface. The registry (`registry.py`) maps method codes to classes; nothing
else in the app imports a gateway directly.

Rules the implementations must keep:

- **Never invent a hash.** Signature and hashing algorithms are ported from the
  reference byte for byte; the Moamalat vector test anchors the construction.
- **Never trust the callback.** Every webhook passes through signature
  verification before it may touch an order.
- Money enters as a `Decimal` and leaves in the unit the provider demands;
  conversions live here, visibly, not scattered through callers.
"""

from __future__ import annotations

import abc
import hmac
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from apps.orders.models import PaymentStatus


@dataclass
class InitiationResult:
    """What `POST /api/payments/` returns to the SPA."""

    success: bool
    next_step: str = PaymentStatus.PENDING
    message: str = ""
    redirect_url: str | None = None
    payment_id: str | None = None
    transaction_id: str | None = None
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class WebhookResult:
    """The parsed outcome of a provider notification, BEFORE any state change.

    `order_number` is the merchant reference — our order number. A result with
    `signature_valid=False` must never be processed further.
    """

    success: bool
    signature_valid: bool = True
    order_number: str | None = None
    transaction_id: str | None = None
    status: str = PaymentStatus.FAILED
    message: str = ""
    amount: Decimal | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class PaymentGateway(abc.ABC):
    """One payment method code → one class."""

    code: str = ""
    name: str = ""

    @abc.abstractmethod
    def initiate(self, *, order, config: dict, user_input: dict) -> InitiationResult:
        """Start a payment for `order`. No database writes here."""

    def handle_webhook(self, payload: dict, headers: dict, config: dict) -> WebhookResult:
        raise NotImplementedError(f"{self.code} has no webhook")

    def verify_remotely(self, *, payment, config: dict) -> WebhookResult | None:
        """Server-to-server status query for `/checkout/redirect`, or None if
        the gateway cannot answer."""
        return None


def moamalat_secure_hash(params: dict, secret_key: str, *, sort: bool = True, filter_empty: bool = True) -> str:
    """The Moamalat SecureHash: HMAC-SHA256 over sorted non-empty `k=v` pairs
    joined by `&`, keyed by the HEX-DECODED secret, uppercase hex out.

    Ported line-for-line from the reference's generateSecureHash; the synthetic
    vector in reference/fixtures/moamalat pins it.
    """
    keys = list(params.keys())
    if filter_empty:
        keys = [k for k in keys if params[k] is not None and params[k] != ""]
    if sort:
        keys = sorted(keys)
    param_string = "&".join(f"{k}={params[k]}" for k in keys)
    if not isinstance(secret_key, str) or not secret_key:
        raise ValueError("المفتاح السري غير صالح أو مفقود لإنشاء SecureHash")
    key_bytes = bytes.fromhex(secret_key)
    digest = hmac.new(key_bytes, param_string.encode(), "sha256").hexdigest().upper()
    return digest
