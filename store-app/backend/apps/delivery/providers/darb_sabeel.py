"""Darb Sabeel (Sabil) — v2.sabil.ly. Tracking comes back as `reference`."""

from __future__ import annotations

import json as _json
import urllib.request

from .base import Courier, ShipmentResult

DEFAULT_BASE = "https://v2.sabil.ly"

_PAY_ON_DELIVERY = {"manual_payment", "bank_cards_on_delivery"}


def _request(base: str, path: str, payload: dict, token: str) -> tuple[int, dict]:
    req = urllib.request.Request(
        f"{base}{path}", data=_json.dumps(payload).encode(), method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {token}"},
    )
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


class DarbSabeelCourier(Courier):
    code = "darb_sabeel"
    name = "درب السبيل"

    def create_shipment(self, *, order, config: dict) -> ShipmentResult:
        base = config.get("baseUrl") or DEFAULT_BASE
        token = config.get("apiToken") or ""

        pay_on_delivery = order.payment_method in _PAY_ON_DELIVERY
        products = []
        for item in order.items.select_related("product", "variant"):
            product = item.product
            products.append({
                "title": item.product_name or product.name,
                "quantity": item.quantity,
                "widthCM": getattr(product, "width", None) or 40,
                "heightCM": getattr(product, "height", None) or 40,
                "lengthCM": getattr(product, "length", None) or 50,
                "amount": float(item.total_price),
                "isChargeable": pay_on_delivery,
            })
        if not products:
            products.append({
                "title": f"طلب #{order.order_number}",
                "quantity": 1,
                "widthCM": 40, "heightCM": 40, "lengthCM": 50,
                "amount": float(order.total),
                "isChargeable": pay_on_delivery,
            })

        payload = {
            "notes": f"طلب {order.order_number}",
            "contacts": [],
            "products": products,
            "allowSplitting": False,
            "paymentBy": "receiver" if pay_on_delivery else "sender",
            "to": {
                "countryCode": "lby",
                "city": str(order.shipping_city_id or ""),
                "area": str(order.shipping_region_id or ""),
                "address": order.shipping_address,
            },
            "allowCardPayment": order.payment_method == "bank_cards_on_delivery",
            "metadata": {"orderId": str(order.id), "orderNumber": order.order_number},
        }

        status, body = _request(base, "/api/local/shipments", payload, token)
        data = body.get("data") or {}
        tracking = str(data.get("reference") or data.get("_id") or "")
        if not body.get("status") and not tracking:
            return ShipmentResult(success=False,
                                  message=body.get("message") or "خطأ في إنشاء الشحنة")
        return ShipmentResult(success=True, tracking_number=tracking,
                              message="تم إنشاء الشحنة بنجاح")
