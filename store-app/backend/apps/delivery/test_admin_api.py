import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import User
from apps.orders.models import DeliveryMethod

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        phone_number="0911234567",
        password="OwnerPass9x",
        name="مالك المتجر",
        role="owner",
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
def vanex(db):
    return DeliveryMethod.objects.create(
        name="ڤانيكس",
        code="vanex",
        description="توصيل سريع",
        is_active=True,
        configuration={"email": "vanex@store.ly", "password": "pass"},
    )


def test_admin_delivery_methods_list_and_patch(admin_api, vanex):
    res = admin_api.get(reverse("admin-delivery-methods"))
    assert res.status_code == 200
    assert len(res.json()["data"]) >= 1

    detail_url = reverse("admin-delivery-method-detail", args=["vanex"])
    patch_res = admin_api.patch(
        detail_url,
        {"description": "توصيل لجميع المدن الليبية", "is_active": False},
        format="json",
    )
    assert patch_res.status_code == 200
    vanex.refresh_from_db()
    assert vanex.description == "توصيل لجميع المدن الليبية"
    assert vanex.is_active is False
