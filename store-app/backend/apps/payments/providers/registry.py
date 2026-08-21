"""Gateway registry — the ONLY place that maps a method code to a class."""

from __future__ import annotations

from .bank_cards_on_delivery import BankCardsOnDeliveryGateway
from .base import PaymentGateway
from .binance_pay import BinancePayGateway
from .manual_payment import ManualPaymentGateway
from .moamalat import MoamalatGateway
from .plutu import (
    PlutuEdFaliGateway,
    PlutuLocalCardsGateway,
    PlutuMpgsGateway,
    PlutuSadadGateway,
    PlutuTlyncGateway,
)
from .sadad_pay import SadadPayGateway

_REGISTRY: dict[str, type[PaymentGateway]] = {
    g.code: g
    for g in (
        MoamalatGateway(),
        SadadPayGateway(),
        BinancePayGateway(),
        ManualPaymentGateway(),
        BankCardsOnDeliveryGateway(),
        PlutuSadadGateway(),
        PlutuEdFaliGateway(),
        PlutuMpgsGateway(),
        PlutuTlyncGateway(),
        PlutuLocalCardsGateway(),
    )
}


def get_gateway(method_code: str) -> PaymentGateway:
    gateway = _REGISTRY.get(method_code)
    if gateway is None:
        raise KeyError(f"لا توجد بوابة دفع مسجّلة بالرمز «{method_code}»")
    return gateway


def known_codes() -> list[str]:
    return sorted(_REGISTRY)
