"""Shared fixtures. No fixture may create a security bypass — if a test needs
one, the test is wrong.
"""

from decimal import Decimal

import pytest
from django.core.cache import cache

from apps.catalog.models import Category, Product, ProductVariant, VariantOption, VariantValue
from apps.core.models import City, Region, Role, User


@pytest.fixture(autouse=True)
def clear_cache():
    """Throttle counters and cached layouts live in Redis, which is shared across
    the whole test session. Without this, the sixth test that logs in as the same
    phone number is throttled into anonymity and every assertion after it is
    measuring the wrong thing."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        phone_number="0911111111", password="CorrectHorse9", name="عميل"
    )


@pytest.fixture
def owner(db):
    return User.objects.create_superuser(
        phone_number="0910000000", password="OwnerPass9x", name="مالك", role=Role.OWNER
    )


@pytest.fixture
def city(db):
    return City.objects.create(
        id="tripoli", name="طرابلس", code="TIP", delivery_fee=Decimal("15.00")
    )


@pytest.fixture
def region(city):
    return Region.objects.create(
        id="gargaresh", name="قرقارش", city=city, delivery_fee=Decimal("5.00"),
        estimated_delivery_days=2,
    )


@pytest.fixture
def region_without_fee(city):
    """A region that inherits the city's fee — the fallback path."""
    return Region.objects.create(
        id="tajoura", name="تاجوراء", city=city, delivery_fee=Decimal("0.00")
    )


@pytest.fixture
def category(db):
    return Category.objects.create(name="عطور", slug="عطور")


@pytest.fixture
def product(db):
    return Product.objects.create(
        name="عود ملكي", slug="عود-ملكي", price=Decimal("450.00"),
        compare_at_price=Decimal("560.00"), sku="NL-OUD", track_quantity=True, stock=10,
    )


@pytest.fixture
def variant(product):
    option = VariantOption.objects.create(name="الحجم")
    value = VariantValue.objects.create(option=option, value="50 مل")
    variant = ProductVariant.objects.create(
        product=product, sku="NL-OUD-2", price=Decimal("450.00"), stock=5
    )
    variant.values.set([value])
    return variant


@pytest.fixture
def api():
    """An anonymous API client. Shared because several apps need one, and a
    per-file copy drifts."""
    from rest_framework.test import APIClient

    return APIClient()
