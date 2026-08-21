"""Courier registry — the only place that maps a code to a class."""

from __future__ import annotations

from .base import Courier
from .darb_sabeel import DarbSabeelCourier
from .nawres import NawresCourier
from .vanex import VanexCourier

_REGISTRY: dict[str, Courier] = {
    c.code: c for c in (VanexCourier(), NawresCourier(), DarbSabeelCourier())
}


def get_courier(code: str) -> Courier:
    courier = _REGISTRY.get(code)
    if courier is None:
        raise KeyError(f"لا توجد شركة توصيل مسجّلة بالرمز «{code}»")
    return courier


def known_codes() -> list[str]:
    return sorted(_REGISTRY)
