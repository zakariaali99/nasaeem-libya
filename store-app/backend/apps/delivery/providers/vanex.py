"""Vanex — app.vanex.ly. Bearer token from email/password login.

City/region identifiers ARE our primary keys: `core.City.id` stores the
provider's own id ("synced from the delivery providers and keyed by their
identifiers"), so no mapping table is needed.
"""

from __future__ import annotations

import json as _json
import urllib.request

from .base import Courier, ShipmentResult

DEFAULT_BASE = "https://app.vanex.ly/api/v1/"

_PAY_ON_DELIVERY = {"manual_payment", "bank_cards_on_delivery"}


def _post(url: str, payload: dict, token: str | None = None) -> tuple[int, dict]:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=_json.dumps(payload).encode(),
                                 headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, _json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, _json.loads(exc.read().decode())
        except Exception:
            return exc.code, {}
    except Exception:
        return 0, {}


def authenticate(config: dict) -> str:
    _, body = _post(f"{config.get('baseUrl') or DEFAULT_BASE}authenticate",
                    {"email": config.get("email"), "password": config.get("password")})
    return body.get("data", {}).get("access_token", "")


class VanexCourier(Courier):
    code = "vanex"
    name = "ڤانيكس"

    def create_shipment(self, *, order, config: dict) -> ShipmentResult:
        token = authenticate(config)
        if not token:
            return ShipmentResult(success=False, message="فشل تسجيل الدخول إلى ڤانيكس")

        pay_on_delivery = order.payment_method in _PAY_ON_DELIVERY
        first_item = order.items.select_related("product").first()
        product = first_item.product if first_item else None
        # Vanex keys cities by its own numeric ids; ours are synced from it.
        # A non-numeric id means this row did not come from the sync — refuse
        # loudly instead of shipping the parcel to city 0.
        try:
            city_id = int(order.shipping_region.city_id) if order.shipping_region_id else int(getattr(order, "shipping_city_id", 0) or 0)
            region_id = int(order.shipping_region_id) if order.shipping_region_id else None
        except (TypeError, ValueError, AttributeError):
            return ShipmentResult(
                success=False,
                message="معرّف المدينة غير متوافق مع ڤانيكس — تحقق من مزامنة المدن",
            )
        payload = {
            "type": 1,
            "description": f"Order #{order.id}",
            "qty": sum(item.quantity for item in order.items.all()) or 1,
            "leangh": getattr(product, "length", 0) or 0,
            "width": getattr(product, "width", 0) or 0,
            "height": getattr(product, "height", 0) or 0,
            "breakable": 0,
            "measuring_is_allowed": True,
            "inspection_allowed": True,
            "heat_intolerance": True,
            "casing": False,
            "address": order.shipping_address,
            "reciever": order.user.name if order.user and order.user.name else (order.user.phone_number if order.user else ""),
            "phone": order.user.phone_number if order.user else "",
            "phone_b": order.user.phone_number if order.user else "",
            "city": city_id,
            "address_child": region_id,
            "price": float(order.total),
            "sticker_notes": "",
            # Pay-on-delivery: the customer pays the courier's fee; otherwise we do.
            "paid_by": "customer" if pay_on_delivery else "market",
            "extra_size_by": "customer" if pay_on_delivery else "market",
            "commission_by": "customer" if pay_on_delivery else "market",
            "payment_method": "cash" if pay_on_delivery else "cheque",
            "map": "",
            "package_sub_type": 6,
            "type_id": 1,
        }
        status, body = _post(f"{config.get('baseUrl') or DEFAULT_BASE}customer/package",
                             payload, token=token)
        if body.get("errors") or status != 201:
            return ShipmentResult(success=False,
                                  message=body.get("message") or "خطأ في إنشاء الشحنة")
        return ShipmentResult(success=True,
                              tracking_number=str(body.get("package_code") or ""),
                              message=body.get("message") or "تم إنشاء الشحنة بنجاح")
