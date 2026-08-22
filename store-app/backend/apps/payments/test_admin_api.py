import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import User
from apps.orders.models import PaymentMethodConfiguration

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
def customer(db):
    return User.objects.create_user(
        phone_number="0921234567",
        password="CustPass9x",
        name="عميل عادي",
        role="customer",
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
def customer_api(customer):
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": customer.phone_number, "password": "CustPass9x"},
        format="json",
    )
    return client


@pytest.fixture
def moamalat_config(db):
    return PaymentMethodConfiguration.objects.create(
        method_code="moamalat",
        display_name="بطاقة مصرفية (معاملات)",
        description="الدفع المباشر عبر بطاقة تداول أو نمو أو بطاقات المصارف الليبية",
        config_data={"merchant_id": "123456", "terminal_id": "9999", "secret_key": "secret"},
        is_enabled=True,
        sort_order=1,
    )


def test_public_payment_methods_excludes_secrets(client, moamalat_config):
    response = client.get(reverse("payment-methods"))
    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data) >= 1
    item = next(m for m in data if m["method_code"] == "moamalat")
    assert item["display_name"] == "بطاقة مصرفية (معاملات)"
    assert "config_data" not in item
    assert "secret_key" not in str(item)


def test_admin_payment_methods_access_control(admin_api, customer_api, moamalat_config):
    cust_res = customer_api.get(reverse("admin-payment-methods"))
    assert cust_res.status_code == 403

    admin_res = admin_api.get(reverse("admin-payment-methods"))
    assert admin_res.status_code == 200
    assert len(admin_res.json()["data"]) >= 1


def test_admin_payment_method_patch(admin_api, moamalat_config):
    url = reverse("admin-payment-method-detail", args=["moamalat"])
    response = admin_api.patch(
        url,
        {
            "display_name": "معاملات المحدثة",
            "is_enabled": False,
            "config_data": {"merchant_id": "654321", "terminal_id": "8888", "secret_key": "new_sec"},
        },
        format="json",
    )
    assert response.status_code == 200
    moamalat_config.refresh_from_db()
    assert moamalat_config.display_name == "معاملات المحدثة"
    assert moamalat_config.is_enabled is False
    assert moamalat_config.config_data["merchant_id"] == "654321"
