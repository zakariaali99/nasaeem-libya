"""Courier contract. One courier = one file under `providers/`."""

from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ShipmentResult:
    success: bool
    tracking_number: str | None = None
    message: str = ""
    raw: dict[str, Any] = field(default_factory=dict)


class Courier(abc.ABC):
    code: str = ""
    name: str = ""

    @abc.abstractmethod
    def create_shipment(self, *, order, config: dict) -> ShipmentResult:
        """Create the shipment with the provider and return its tracking number.

        `order` carries shipping_city/shipping_region (our rows), the customer's
        address, order_number, items, total, and payment_method — pay-on-delivery
        methods change who pays the courier's fee.
        """
