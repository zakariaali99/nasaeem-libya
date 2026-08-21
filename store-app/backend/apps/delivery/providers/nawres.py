"""Nawres — backoffice.nawris.algoriza.com/external-api.

Cities and areas are sent by NAME (looked up from the provider's own lists),
the phone must be normalised to +218…, and the tracking number arrives as
`code` or `bar_code`.
"""

from __future__ import annotations

import json as _json
import urllib.request

from .base import Courier, ShipmentResult

DEFAULT_BASE = "https://backoffice.nawris.algoriza.com/external-api/"

_PAY_ON_DELIVERY = {"manual_payment", "bank_cards_on_delivery"}


def normalise_libyan_phone(phone: str) -> str:
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if digits.startswith("00218"):
        return f"+{digits}"
    if digits.startswith("218"):
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+218{digits[1:]}"
    return f"+218{digits}" if len(digits) == 9 else (phone or "")


def _get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json",
                                               "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return _json.loads(resp.read().decode())
    except Exception:
        return {}


def _post(url: str, payload: dict) -> tuple[int, dict]:
    req = urllib.request.Request(url, data=_json.dumps(payload).encode(), method="POST",
                                 headers={"Accept": "application/json",
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            text = resp.read().decode()
            return resp.status, (_json.loads(text) if text else {})
    except urllib.error.HTTPError as exc:
        body = exc.read().decode()
        try:
            return exc.code, _json.loads(body)
        except Exception:
            return exc.code, {}
    except Exception:
        return 0, {}


class NawresCourier(Courier):
    code = "nawres"
    name = "نورس"

    def create_shipment(self, *, order, config: dict) -> ShipmentResult:
        base = config.get("baseUrl") or DEFAULT_BASE
        auth = config.get("authentication_key") or ""
        client_code = config.get("main_client_code") or ""

        city_name = ""
        area_name = ""
        cities = _get(f"{base}get-government?{urllib.parse.urlencode({'authentication_key': auth})}")
        for entry in cities.get("feed", []):
            if str(entry.get("id")) == str(order.shipping_city_id):
                city_name = entry.get("name", "")
                break
        if city_name and order.shipping_region_id:
            areas = _get(f"{base}get-area/{order.shipping_city_id}?{urllib.parse.urlencode({'authentication_key': auth})}")
            for entry in areas.get("feed", []):
                if str(entry.get("id")) == str(order.shipping_region_id):
                    area_name = entry.get("name", "")
                    break

        pay_on_delivery = order.payment_method in _PAY_ON_DELIVERY
        payload = {
            "authentication_key": auth,
            "main_client_code": client_code,
            "remote_order_id": order.order_number,
            "second_client": "",
            "receiver": order.user.name if order.user and order.user.name else "",
            "phone1": normalise_libyan_phone(order.user.phone_number if order.user else ""),
            "government": city_name,
            "area": area_name,
            "address": order.shipping_address,
            "notes": f"Address #{order.shipping_address}",
            "invoice_number": order.order_number,
            "order_summary": f"Order #{order.order_number}",
            "amount_to_be_collected": float(order.total) if pay_on_delivery else 0,
            "return_amount": 0,
            "is_order": 0,
            "return_summary": "",
            "is_office_given": 0,
            "shipment_on_sender": 0 if pay_on_delivery else 1,
            "extra_cost_payer": 0 if pay_on_delivery else 1,
            "is_fragile": 0,
            "can_open": 1,
            "is_measurable": 1,
            "is_bank_payment": 1 if order.payment_method == "bank_cards_on_delivery" else 0,
            "payment_commission_payer": 1,
            "pieces_count": sum(item.quantity for item in order.items.all()) or 1,
        }

        status, body = _post(f"{base}add-order", payload)
        code = body.get("code") if body.get("code") is not None else body.get("result", {}).get("code")
        bar_code = body.get("bar_code") if body.get("bar_code") is not None else body.get("result", {}).get("bar_code")
        tracking = str(code or bar_code or "")
        if not tracking:
            return ShipmentResult(success=False,
                                  message="استجابة غير صالحة من شركة التوصيل")
        return ShipmentResult(success=True, tracking_number=tracking,
                              message="تم إنشاء الشحنة بنجاح")
