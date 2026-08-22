"""Payments — the Phase 6 gate.

The Moamalat vector test is the anchor: change one byte of the param-string
construction and it fails. The webhook tests use **real signed payloads** —
mocking the signature would prove nothing about the verification path.
"""

import json
from decimal import Decimal
from pathlib import Path

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Product
from apps.core.models import Role, User
from apps.orders.models import (
    DeliveryMethod,
    Order,
    OrderStatus,
    PaymentMethodConfiguration,
)
from apps.payments.models import Payment
from apps.payments.providers.base import moamalat_secure_hash

pytestmark = pytest.mark.django_db

PASSWORD = "CorrectHorse9"
VECTOR = json.loads(
    # apps/payments/tests.py → apps → backend → store-app → repo root
    (Path(__file__).resolve().parents[4] / "reference" / "fixtures" / "moamalat" / "synthetic-hash-vector.json")
    .read_text()
)


@pytest.fixture
def buyer(db):
    return User.objects.create_user(
        phone_number="0915555555", password=PASSWORD, name="مشتري الدفع"
    )


@pytest.fixture
def buyer_api(buyer):
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": buyer.phone_number, "password": PASSWORD},
        format="json",
    )
    return client


@pytest.fixture
def admin_api(owner):
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": owner.phone_number, "password": "OwnerPass9x"},
        format="json",
    )
    return client


@pytest.fixture
def courier(db):
    return DeliveryMethod.objects.create(name="فانكس", code="vanex", is_active=True)


@pytest.fixture
def moamalat_config(db):
    return PaymentMethodConfiguration.objects.create(
        method_code="moamalat",
        display_name="معاملات",
        config_data={
            "merchantId": VECTOR["params"]["MerchantId"],
            "terminalId": VECTOR["params"]["TerminalId"],
            "secureKey": VECTOR["secret_key"],
            "sandboxMode": True,
        },
        is_enabled=True,
    )


def _finalised_order(buyer_api, product, region, method_code="moamalat"):
    """A draft → a finalised order carrying `method_code`, via the real API."""
    buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
    draft = buyer_api.post(
        reverse("cart-checkout"), {"region_id": region.id, "address": "شارع التوصيل"},
        format="json",
    ).json()["data"]
    return buyer_api.post(
        reverse("checkout-confirm"),
        {
            "order_id": draft["id"],
            "region_id": region.id,
            "address": "شارع التوصيل",
            "delivery_method_code": "",
            "payment_method": method_code,
        },
        format="json",
    ).json()["data"]


def _signed_webhook(order_number, *, response_code="00", secret=None, tamper=None):
    """A webhook exactly as Moamalat would send it — hash computed over every
    field except the hash itself. `tamper` rewrites a field AFTER signing."""
    payload = {
        "Amount": "500000",
        "DateTimeLocalTrxn": "202608221200",
        "MerchantId": VECTOR["params"]["MerchantId"],
        "MerchantReference": order_number,
        "ResponseCode": response_code,
        "SystemReference": "SYS-123456",
        "TerminalId": VECTOR["params"]["TerminalId"],
        "Message": "Approved",
    }
    payload["SecureHash"] = moamalat_secure_hash(
        {k: v for k, v in payload.items()}, secret or VECTOR["secret_key"]
    )
    if tamper:
        payload[tamper] = payload[tamper] + "0"
    return payload


# --------------------------------------------------------------------------
# Gate: the hash construction is byte-exact against the fixture vector
# --------------------------------------------------------------------------

class TestMoamalatVector:
    def test_moamalat_hash_vector(self):
        assert (
            moamalat_secure_hash(VECTOR["params"], VECTOR["secret_key"])
            == VECTOR["expected_hash"]
        )


# --------------------------------------------------------------------------
# Webhooks: verification, idempotency, stock-on-confirm
# --------------------------------------------------------------------------

class TestWebhooks:
    def test_stock_decrements_only_on_confirmation(
        self, buyer_api, product, region, moamalat_config
    ):
        order = _finalised_order(buyer_api, product, region)
        product.refresh_from_db()
        assert product.reserved_stock == 1
        assert product.stock == 10  # initiating a payment touches nothing

        response = buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "moamalat"},
            format="json",
        )
        assert response.status_code == 200, response.json()
        product.refresh_from_db()
        assert product.reserved_stock == 1 and product.stock == 10

        webhook = APIClient()  # anonymous: providers have no session
        response = webhook.post(
            reverse("payment-webhook", args=["moamalat"]),
            _signed_webhook(order["order_number"]),
            format="json",
        )
        assert response.status_code == 200, response.json()

        product.refresh_from_db()
        # The reservation converts into a sale: both move together, once.
        assert product.reserved_stock == 0
        assert product.stock == 9
        order_row = Order.objects.get(id=order["id"])
        assert order_row.status == OrderStatus.PROCESSING
        assert Payment.objects.filter(order_id=order["id"]).first().status == "completed"

    def test_webhook_bad_signature_rejected(self, buyer_api, product, region, moamalat_config):
        order = _finalised_order(buyer_api, product, region)
        buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "moamalat"},
            format="json",
        )
        forged = _signed_webhook(order["order_number"], tamper="Amount")

        response = APIClient().post(
            reverse("payment-webhook", args=["moamalat"]), forged, format="json"
        )

        assert response.status_code == 400
        product.refresh_from_db()
        assert product.stock == 10 and product.reserved_stock == 1
        assert Order.objects.get(id=order["id"]).status == OrderStatus.PENDING

    def test_the_same_webhook_delivered_twice_credits_once(
        self, buyer_api, product, region, moamalat_config
    ):
        order = _finalised_order(buyer_api, product, region)
        buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "moamalat"},
            format="json",
        )
        payload = _signed_webhook(order["order_number"])
        webhook = APIClient()

        first = webhook.post(reverse("payment-webhook", args=["moamalat"]), payload, format="json")
        second = webhook.post(reverse("payment-webhook", args=["moamalat"]), payload, format="json")

        assert first.status_code == 200 and second.status_code == 200
        assert first.json()["credited"] is True
        assert second.json()["credited"] is False
        assert second.json()["message"] == "الدفع مؤكد مسبقاً"

        product.refresh_from_db()
        assert product.stock == 9  # decremented once, not twice
        assert Order.objects.get(id=order["id"]).status == OrderStatus.PROCESSING

    def test_a_webhook_for_an_unknown_order_is_acknowledged_not_processed(self, moamalat_config):
        response = APIClient().post(
            reverse("payment-webhook", args=["moamalat"]),
            _signed_webhook("209901XXX99999"),
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["success"] is False


# --------------------------------------------------------------------------
# /checkout/redirect — arriving before AND after the webhook
# --------------------------------------------------------------------------

class TestCheckoutRedirect:
    def test_arriving_before_the_webhook_shows_pending_then_after_it_confirms(
        self, buyer_api, buyer, product, region, moamalat_config
    ):
        order = _finalised_order(buyer_api, product, region)
        buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "moamalat"},
            format="json",
        )
        redirect_url = reverse("payment-redirect", args=[order["id"]])

        # Before: the gateway has no server-to-server answer for this stub, so
        # the poll reports the stored state — not confirmed, no crash.
        before = buyer_api.get(redirect_url)
        assert before.status_code == 200
        assert before.json()["data"]["confirmed"] is False

        # The webhook lands while the customer is on the redirect screen.
        response = APIClient().post(
            reverse("payment-webhook", args=["moamalat"]),
            _signed_webhook(order["order_number"]),
            format="json",
        )
        assert response.json()["success"] is True

        after = buyer_api.get(redirect_url).json()["data"]
        assert after["confirmed"] is True
        assert after["order_status"] == OrderStatus.PROCESSING

    def test_another_customer_cannot_poll_your_order(
        self, api, buyer_api, buyer, product, region, moamalat_config, db
    ):
        order = _finalised_order(buyer_api, product, region)
        stranger = User.objects.create_user(
            phone_number="0916666666", password=PASSWORD, name="غريب"
        )
        client = APIClient()
        client.post(
            reverse("auth-login"),
            {"phone_number": stranger.phone_number, "password": PASSWORD},
            format="json",
        )
        response = client.get(reverse("payment-redirect", args=[order["id"]]))
        assert response.status_code == 404


# --------------------------------------------------------------------------
# Manual payment: proof → waiting_for_verification → operator verifies
# --------------------------------------------------------------------------

class TestManualPayment:
    def test_upload_proof_waits_then_operator_verification_advances_the_order(
        self, buyer_api, admin_api, product, region, db
    ):
        PaymentMethodConfiguration.objects.create(
            method_code="manual_payment", display_name="تحويل بنكي",
            config_data={"instructionsAr": "حوّل إلى الحساب التالي"}, is_enabled=True,
        )
        order = _finalised_order(buyer_api, product, region, method_code="manual_payment")

        response = buyer_api.post(
            reverse("payment-initiate"),
            {
                "order_id": order["id"],
                "method_code": "manual_payment",
                "user_input": {"transferReceipt": "REC-889", "transferDate": "2026-08-22"},
            },
            format="json",
        )
        assert response.status_code == 200, response.json()
        assert response.json()["data"]["next_step"] == "waiting_for_verification"

        product.refresh_from_db()
        assert product.stock == 10  # waiting is not paid

        payment = Payment.objects.filter(order_id=order["id"]).first()

        verified = admin_api.post(
            reverse("admin-payment-verify", args=[payment.id]), format="json"
        )
        assert verified.status_code == 200, verified.json()

        product.refresh_from_db()
        assert product.stock == 9 and product.reserved_stock == 0
        assert Order.objects.get(id=order["id"]).status == OrderStatus.PROCESSING

    def test_verifying_twice_credits_once(self, buyer_api, admin_api, product, region, db):
        PaymentMethodConfiguration.objects.create(
            method_code="manual_payment", display_name="تحويل بنكي", is_enabled=True,
        )
        order = _finalised_order(buyer_api, product, region, method_code="manual_payment")
        buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "manual_payment",
             "user_input": {"transferReceipt": "REC-7"}},
            format="json",
        )
        payment = Payment.objects.filter(order_id=order["id"]).first()

        first = admin_api.post(reverse("admin-payment-verify", args=[payment.id]), format="json")
        second = admin_api.post(reverse("admin-payment-verify", args=[payment.id]), format="json")

        assert first.json()["data"]["credited"] is True
        assert second.status_code == 200
        product.refresh_from_db()
        assert product.stock == 9

    def test_an_operator_cannot_verify_a_nonexistent_payment(self, admin_api):
        import uuid

        response = admin_api.post(
            reverse("admin-payment-verify", args=[uuid.uuid4()]), format="json"
        )
        assert response.status_code == 404

    def test_a_customer_cannot_reach_the_admin_verify_endpoint(self, buyer_api):
        import uuid

        response = buyer_api.post(
            reverse("admin-payment-verify", args=[uuid.uuid4()]), format="json"
        )
        assert response.status_code in (403, 404)


# --------------------------------------------------------------------------
# Guard rails around initiation
# --------------------------------------------------------------------------

class TestInitiationGuards:
    def test_paying_twice_is_refused_after_confirmation(
        self, buyer_api, product, region, moamalat_config
    ):
        order = _finalised_order(buyer_api, product, region)
        buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "moamalat"},
            format="json",
        )
        APIClient().post(
            reverse("payment-webhook", args=["moamalat"]),
            _signed_webhook(order["order_number"]),
            format="json",
        )

        response = buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "moamalat"},
            format="json",
        )
        assert response.status_code == 409
        assert response.json()["message"] == "تم دفع هذا الطلب مسبقاً"

    def test_a_disabled_method_is_unavailable(self, buyer_api, product, region, db):
        PaymentMethodConfiguration.objects.create(
            method_code="binance_pay", display_name="بينانس", is_enabled=False,
        )
        order = _finalised_order(buyer_api, product, region, method_code="binance_pay")
        response = buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "binance_pay"},
            format="json",
        )
        assert response.status_code == 400

    def test_an_unknown_method_is_refused(self, buyer_api, product, region):
        order = _finalised_order(buyer_api, product, region)
        response = buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": order["id"], "method_code": "no_such_gateway"},
            format="json",
        )
        assert response.status_code == 400

    def test_initiating_without_finalising_is_refused(
        self, buyer_api, product, region, moamalat_config
    ):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(
            reverse("cart-checkout"), {"region_id": region.id, "address": "شارع"},
            format="json",
        ).json()["data"]

        response = buyer_api.post(
            reverse("payment-initiate"),
            {"order_id": draft["id"], "method_code": "moamalat"},
            format="json",
        )
        assert response.status_code == 409
