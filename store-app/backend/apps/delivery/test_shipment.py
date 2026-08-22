"""Shipments — the Phase 6 delivery gate: creation returns a tracking number.

The courier's HTTP layer is stubbed at its transport function, so the test
asserts the REAL payload construction — path, token usage, and the
pay-on-delivery money rules — against exactly what Vanex would receive.
"""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import Role, User
from apps.delivery import services as delivery_services
from apps.orders.models import (
    DeliveryMethod,
    Order,
    OrderStatus,
)

pytestmark = pytest.mark.django_db

PASSWORD = "CorrectHorse9"


@pytest.fixture
def buyer(db):
    return User.objects.create_user(
        phone_number="0917777777", password=PASSWORD, name="مشتري الشحن"
    )


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
def vanex_method(db):
    return DeliveryMethod.objects.create(
        name="ڤانيكس", code="vanex", is_active=True,
        configuration={"email": "ops@store.ly", "password": "secret"},
    )


@pytest.fixture
def pickup_method(db):
    """A non-courier method: no shipment can exist for it."""
    return DeliveryMethod.objects.create(
        name="استلام من المتجر", code="store_pickup", is_active=True,
    )


@pytest.fixture
def finalised_order(buyer, product, region, vanex_method):
    """A finalised PENDING order, built through the real service layer."""
    from apps.orders import services as order_services

    cart = order_services.get_or_create_cart(_FakeRequest(buyer))
    from apps.orders.models import CartItem

    CartItem.objects.create(cart=cart, product=product, quantity=1)
    order = order_services.checkout(cart=cart)
    return order_services.finalise_order(
        order,
        region_id=region.id,
        address="شارع الشحن، مبنى 4",
        delivery_method_code=vanex_method.code,
        payment_method="manual_payment",
    )


class _FakeRequest:
    def __init__(self, user):
        self.user = user


class TestShipmentCreation:
    def test_creating_a_shipment_returns_and_persists_a_tracking_number(
        self, finalised_order, monkeypatch
    ):
        calls = []

        def fake_post(url, payload, token=None):
            calls.append({"url": url, "payload": payload, "token": token})
            return 201, {"package_code": "VX-TEST-0042"}

        monkeypatch.setattr(
            "apps.delivery.providers.vanex.authenticate", lambda config: "token-123"
        )
        monkeypatch.setattr("apps.delivery.providers.vanex._post", fake_post)

        result = delivery_services.start_delivery(order=finalised_order)

        assert result["success"] is True
        assert result["tracking_number"] == "VX-TEST-0042"
        finalised_order.refresh_from_db()
        assert finalised_order.tracking_number == "VX-TEST-0042"

        # The wire contract: the packages endpoint, bearer-authenticated.
        assert calls[0]["url"].endswith("/customer/package")
        assert calls[0]["token"] == "token-123"

    def test_the_customer_pays_the_courier_on_pay_on_delivery_methods(
        self, buyer, product, region, vanex_method, monkeypatch
    ):
        from apps.orders import services as order_services
        from apps.orders.models import CartItem

        cart = order_services.get_or_create_cart(_FakeRequest(buyer))
        CartItem.objects.create(cart=cart, product=product, quantity=2)
        order = order_services.checkout(cart=cart)
        order = order_services.finalise_order(
            order,
            region_id=region.id,
            address="شارع آخر",
            delivery_method_code=vanex_method.code,
            payment_method="bank_cards_on_delivery",
        )

        seen = {}

        def fake_post(url, payload, token=None):
            seen.update(payload)
            return 201, {"package_code": "VX-POD"}

        monkeypatch.setattr(
            "apps.delivery.providers.vanex.authenticate", lambda config: "t"
        )
        monkeypatch.setattr("apps.delivery.providers.vanex._post", fake_post)

        result = delivery_services.start_delivery(order=order)
        assert result["success"] is True
        assert seen["paid_by"] == "customer"
        assert seen["qty"] == 2

    def test_shipping_twice_reuses_the_number_until_forced(self, finalised_order, monkeypatch):
        responses = iter([(201, {"package_code": "VX-FIRST"}), (201, {"package_code": "VX-SECOND"})])
        monkeypatch.setattr(
            "apps.delivery.providers.vanex.authenticate", lambda config: "t"
        )
        monkeypatch.setattr(
            "apps.delivery.providers.vanex._post",
            lambda url, payload, token=None: next(responses),
        )

        first = delivery_services.start_delivery(order=finalised_order)
        again = delivery_services.start_delivery(order=finalised_order)
        forced = delivery_services.start_delivery(order=finalised_order, force=True)

        assert first["tracking_number"] == "VX-FIRST"
        assert again["reused"] is True and again["tracking_number"] == "VX-FIRST"
        assert forced["tracking_number"] == "VX-SECOND"
        finalised_order.refresh_from_db()
        assert finalised_order.tracking_number == "VX-SECOND"

    def test_an_unfinalised_order_cannot_ship(self, buyer, product, region, vanex_method):
        from apps.orders import services as order_services
        from apps.orders.models import CartItem

        cart = order_services.get_or_create_cart(_FakeRequest(buyer))
        CartItem.objects.create(cart=cart, product=product, quantity=1)
        draft = order_services.checkout(cart=cart)

        with pytest.raises(delivery_services.DeliveryError):
            delivery_services.start_delivery(order=draft)

    def test_store_pickup_has_no_shipment(
        self, buyer, product, region, pickup_method
    ):
        from apps.orders import services as order_services
        from apps.orders.models import CartItem

        cart = order_services.get_or_create_cart(_FakeRequest(buyer))
        CartItem.objects.create(cart=cart, product=product, quantity=1)
        order = order_services.checkout(cart=cart)
        order = order_services.finalise_order(
            order, region_id=region.id, address="العنوان",
            delivery_method_code=pickup_method.code, payment_method="manual_payment",
        )
        with pytest.raises(delivery_services.DeliveryError) as excinfo:
            delivery_services.start_delivery(order=order)
        assert excinfo.value.status == 400


# --------------------------------------------------------------------------
# The operator endpoint
# --------------------------------------------------------------------------

class TestAdminShipmentEndpoint:
    def test_an_operator_ships_through_the_api(self, admin_api, finalised_order, monkeypatch):
        monkeypatch.setattr(
            "apps.delivery.providers.vanex.authenticate", lambda config: "t"
        )
        monkeypatch.setattr(
            "apps.delivery.providers.vanex._post",
            lambda url, payload, token=None: (201, {"package_code": "VX-API-9"}),
        )
        response = admin_api.post(
            reverse("admin-shipment-create", args=[finalised_order.id]), format="json"
        )
        assert response.status_code == 200, response.json()
        assert response.json()["data"]["tracking_number"] == "VX-API-9"

    def test_a_customer_cannot_ship_orders(self, buyer, finalised_order):
        client = APIClient()
        client.post(
            reverse("auth-login"),
            {"phone_number": buyer.phone_number, "password": PASSWORD},
            format="json",
        )
        response = client.post(
            reverse("admin-shipment-create", args=[finalised_order.id]), format="json"
        )
        assert response.status_code == 403
