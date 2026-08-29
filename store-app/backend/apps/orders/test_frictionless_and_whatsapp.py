import pytest
from decimal import Decimal
from django.urls import reverse
from rest_framework.test import APIClient
from apps.core.models import User, City, Region
from apps.catalog.models import Product
from apps.orders.models import Order, OrderStatus
from apps.orders.notifications import (
    format_bank_transfer_whatsapp_message,
    format_cod_order_whatsapp_message,
    format_new_account_welcome_whatsapp_message,
)


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def sample_product(db):
    return Product.objects.create(
        name="عطر نسائم الملكي",
        price=Decimal("250.00"),
        is_active=True,
        stock=50,
    )


@pytest.fixture
def sample_location(db):
    city = City.objects.create(name="طرابلس", delivery_fee=Decimal("15.00"), is_active=True)
    region = Region.objects.create(name="النوفليين", city=city, delivery_fee=Decimal("15.00"), is_active=True)
    return city, region


@pytest.mark.django_db
class TestFrictionlessCheckoutAndWhatsApp:
    def test_whatsapp_message_formatters(self, sample_product, sample_location):
        city, region = sample_location
        order = Order.objects.create(
            order_number="202608BNK0001",
            subtotal=Decimal("250.00"),
            shipping_total=Decimal("15.00"),
            total=Decimal("265.00"),
            payment_method="bank_transfer",
            shipping_city=city,
            shipping_region=region,
            shipping_address="شارع بن عاشور قرب مدرسة طرابلس",
        )

        msg_bank = format_bank_transfer_whatsapp_message(order)
        assert "نسائم ليبيا" in msg_bank
        assert "#202608BNK0001" in msg_bank
        assert "0123456789" in msg_bank
        assert "LY88 0001 0123 4567 8901 2345" in msg_bank
        assert "265" in msg_bank

        msg_cod = format_cod_order_whatsapp_message(order)
        assert "#202608BNK0001" in msg_cod
        assert "265" in msg_cod

        welcome_msg = format_new_account_welcome_whatsapp_message(
            user_name="محمد الطرابلسي",
            phone_number="0912223344",
            temp_password="000000",
        )
        assert "محمد الطرابلسي" in welcome_msg
        assert "0912223344" in welcome_msg
        assert "000000" in welcome_msg
        assert "تغيير كلمة المرور" in welcome_msg

    def test_admin_reset_customer_password(self, api):
        admin = User.objects.create_superuser(phone_number="0919999999", password="AdminPassword123")
        customer = User.objects.create_user(phone_number="0925556677", name="خالد بن علي", password="OldPassword123")

        api.force_authenticate(user=admin)
        url = reverse("admin-user-reset-password", args=[customer.id])
        
        # 1. Reset to default (no password provided -> 000000)
        res = api.post(url, {})
        assert res.status_code == 200
        assert res.data["password"] == "000000"
        customer.refresh_from_db()
        assert customer.check_password("000000")

        # 2. Reset to custom password
        res2 = api.post(url, {"password": "NewSecretPass789"})
        assert res2.status_code == 200
        customer.refresh_from_db()
        assert customer.check_password("NewSecretPass789")

    def test_customer_change_password(self, api):
        customer = User.objects.create_user(phone_number="0917778899", name="سالم", password="000000")
        api.force_authenticate(user=customer)

        url = reverse("me-change-password")

        # Wrong current password
        res_fail = api.post(url, {"current_password": "wrong", "new_password": "NewStrongPass999"})
        assert res_fail.status_code == 400

        # Successful change
        res_ok = api.post(url, {"current_password": "000000", "new_password": "NewStrongPass999"})
        assert res_ok.status_code == 200
        customer.refresh_from_db()
        assert customer.check_password("NewStrongPass999")
