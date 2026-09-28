"""`variant_choices` lets a product card offer its sizes as buttons."""
from decimal import Decimal

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Product, ProductVariant, VariantOption, VariantValue


def _sized_product(name, sizes, *, option=None):
    option = option or VariantOption.objects.get_or_create(name="الحجم")[0]
    product = Product.objects.create(
        name=name, slug=name, price=Decimal("100.00"), is_active=True,
        track_quantity=True, has_variants=True,
    )
    for label, price, stock, active in sizes:
        value = VariantValue.objects.get_or_create(option=option, value=label)[0]
        variant = ProductVariant.objects.create(
            product=product, price=price, stock=stock, is_active=active, sku=f"{name}-{label}",
        )
        variant.values.add(value)
    return product


def _listed(slug):
    data = APIClient().get(reverse("product-list")).json()["data"]
    return next(item for item in data if item["slug"] == slug)


@pytest.mark.django_db
def test_active_sizes_are_listed_with_their_own_price_and_stock():
    _sized_product("عود", [
        ("60 مل", Decimal("150.00"), 3, True),
        ("100 مل", Decimal("220.00"), 0, True),
        ("200 مل", Decimal("300.00"), 5, False),
    ])

    choices = {c["label"]: c for c in _listed("عود")["variant_choices"]}

    assert set(choices) == {"60 مل", "100 مل"}  # the inactive size is not on sale
    assert choices["60 مل"]["price"] == "150.00"
    assert choices["60 مل"]["in_stock"] is True
    assert choices["100 مل"]["in_stock"] is False


@pytest.mark.django_db
def test_a_product_without_sizes_has_no_choices():
    Product.objects.create(name="بسيط", slug="بسيط", price=Decimal("50.00"), is_active=True)
    assert _listed("بسيط")["variant_choices"] == []


@pytest.mark.django_db
def test_sized_products_add_no_query_per_product():
    _sized_product("أ", [("60 مل", Decimal("100.00"), 1, True)])
    client = APIClient()
    client.get(reverse("product-list"))

    with CaptureQueriesContext(connection) as small:
        client.get(reverse("product-list"))
    for index in range(8):
        _sized_product(f"ب{index}", [
            ("60 مل", Decimal("100.00"), 1, True), ("100 مل", Decimal("150.00"), 1, True),
        ])
    with CaptureQueriesContext(connection) as large:
        client.get(reverse("product-list"))

    assert len(large) == len(small)
