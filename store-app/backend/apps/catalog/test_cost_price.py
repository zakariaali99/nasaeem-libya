"""Cost prices: staff can set and see them, customers never see them, and a
sale records the cost of the moment so later changes never rewrite profit."""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.orders import services
from apps.orders.models import Cart, CartItem

pytestmark = pytest.mark.django_db


def test_customers_never_see_the_cost_price(api, product):
    product.cost_price = Decimal("300.00")
    product.save()
    body = api.get(reverse("product-detail", kwargs={"pk": product.id})).json()["data"]
    assert body["cost_price"] is None


def test_staff_set_and_see_the_cost_price(owner, product):
    client = APIClient()
    client.force_authenticate(user=owner)
    url = reverse("product-detail", kwargs={"pk": product.id})
    response = client.patch(url, {"cost_price": "310.00"}, format="json")
    assert response.status_code == 200, response.json()
    assert client.get(url).json()["data"]["cost_price"] == "310.00"


def test_a_sale_keeps_the_cost_of_its_moment(customer, product, region):
    product.cost_price = Decimal("300.00")
    product.save()
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=product, quantity=1)
    order = services.checkout(cart=cart, user=customer, region_id=region.id, address="شارع 1")

    product.cost_price = Decimal("999.00")
    product.save()
    assert order.items.get().unit_cost == Decimal("300.00")


def test_cost_is_optional_everywhere(owner, customer, region):
    """A product is created, sized, cleared of its cost and sold without one."""
    client = APIClient()
    client.force_authenticate(user=owner)
    created = client.post(reverse("product-list"), {
        "name": "بلا تكلفة", "price": "120.00", "track_quantity": True, "stock": 5,
        "sizes": [{"size": "50 مل", "price": "120.00", "cost_price": "", "stock": 5}],
    }, format="json")
    assert created.status_code in (200, 201), created.json()
    product_id = created.json()["data"]["id"]
    url = reverse("product-detail", kwargs={"pk": product_id})
    assert client.get(url).json()["data"]["cost_price"] is None
    assert client.patch(url, {"cost_price": None}, format="json").status_code == 200

    from apps.catalog.models import Product

    product = Product.objects.get(pk=product_id)
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=product, variant=product.variants.first(), quantity=1)
    order = services.checkout(cart=cart, user=customer, region_id=region.id, address="شارع 1")
    assert order.items.get().unit_cost is None
    assert client.get(reverse("admin-analytics-executive")).status_code == 200
