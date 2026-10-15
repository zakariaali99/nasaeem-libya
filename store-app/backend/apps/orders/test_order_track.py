"""Public order tracking: phone, order number, or both — and nothing private."""

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import User
from apps.orders import services
from apps.orders.models import Cart, CartItem


def _place(user, product, region):
    cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=cart, product=product, quantity=1)
    return services.checkout(cart=cart, user=user, region_id=region.id, address="شارع سري 9")


@pytest.mark.django_db
class TestOrderTrack:
    @pytest.fixture
    def orders(self, customer, product, region):
        other = User.objects.create_user(phone_number="0925550002", name="آخر", password="Other-pass-9")
        return _place(customer, product, region), _place(customer, product, region), _place(other, product, region)

    def _get(self, **params):
        return APIClient().post(reverse("order-track"), params, format="json")

    def test_phone_alone_lists_that_phones_orders(self, orders, customer):
        mine_a, mine_b, _ = orders
        numbers = [o["order_number"] for o in self._get(phone="+218 91-111-1111").json()["data"]]
        assert sorted(numbers) == sorted([mine_a.order_number, mine_b.order_number])

    def test_number_alone_finds_that_order(self, orders):
        target = orders[2]
        rows = self._get(number=f"#{target.order_number.lower()}").json()["data"]
        assert [o["order_number"] for o in rows] == [target.order_number]
        assert rows[0]["stage"] and rows[0]["items"][0]["quantity"] == 1

    def test_both_must_belong_together(self, orders):
        assert self._get(phone="0911111111", number=orders[2].order_number).json()["data"] == []
        assert len(self._get(phone="0911111111", number=orders[0].order_number).json()["data"]) == 1

    def test_nothing_private_is_returned(self, orders):
        body = str(self._get(phone="0911111111").json())
        for secret in ("شارع سري", "0911111111", "عميل", "shipping_address", "customer_notes", "admin_notes"):
            assert secret not in body

    def test_empty_or_bad_input_is_refused(self, db):
        assert self._get().status_code == 400
        assert self._get(phone="123").status_code == 400

    def test_a_phone_with_no_orders_finds_nothing(self, orders):
        assert self._get(phone="0937770000").json()["data"] == []
