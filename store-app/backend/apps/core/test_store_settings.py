import uuid
import pytest
from decimal import Decimal
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.core.models import BankAccount, Role, StoreSettings, User
from apps.core.store_settings import (
    CACHE_KEY,
    get_public_store_settings,
    get_store_settings,
    invalidate_store_settings,
)
from apps.orders.models import Order
from apps.orders.notifications import format_bank_transfer_whatsapp_message
from apps.orders.services import build_order_invoice_data
from apps.storefront.spa import render_shell


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        phone_number="0919999000",
        role=Role.ADMIN,
        password="secretpassword123",
    )


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        phone_number="0921112233",
        role=Role.CUSTOMER,
        password="customerpassword123",
    )


@pytest.fixture
def sample_order(db, customer_user):
    return Order.objects.create(
        order_number="ORD-2026-9999",
        user=customer_user,
        subtotal=Decimal("350.00"),
        shipping_total=Decimal("15.00"),
        total=Decimal("365.00"),
        payment_method="bank_transfer",
        shipping_address="شارع الجمهورية، طرابلس",
    )


@pytest.mark.django_db
def test_public_store_settings_api_returns_active_accounts_only(api_client):
    cache.clear()
    StoreSettings.objects.update_or_create(
        pk=1,
        defaults={
            "store_name": "نسائم ليبيا تيست",
            "phone": "0912223344",
            "whatsapp": "0915556677",
            "address": "طرابلس",
        },
    )
    BankAccount.objects.all().delete()
    acc_active = BankAccount.objects.create(
        id=uuid.uuid4(),
        bank_name="مصرف الجمهورية",
        account_holder="شركة نسائم",
        account_number="123456",
        is_active=True,
        sort_order=1,
    )
    acc_inactive = BankAccount.objects.create(
        id=uuid.uuid4(),
        bank_name="مصرف الأمان",
        account_holder="شركة نسائم",
        account_number="999999",
        is_active=False,
        sort_order=2,
    )

    res = api_client.get("/api/store-settings/")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["store_name"] == "نسائم ليبيا تيست"
    assert data["phone"] == "0912223344"
    assert data["whatsapp"] == "0915556677"
    
    returned_acc_ids = [a["id"] for a in data["bank_accounts"]]
    assert str(acc_active.id) in returned_acc_ids
    assert str(acc_inactive.id) not in returned_acc_ids


@pytest.mark.django_db
def test_store_settings_caching_and_invalidation(api_client, admin_user):
    cache.clear()
    api_client.force_authenticate(user=admin_user)

    # 1. Update settings
    res = api_client.put(
        "/api/admin/store-settings/",
        {"phone": "0913334455", "store_name": "نسائم ليبيا المحدثة"},
        format="json",
    )
    assert res.status_code == 200

    # 2. Public API receives updated value
    public_res = api_client.get("/api/store-settings/")
    assert public_res.status_code == 200
    assert public_res.json()["data"]["phone"] == "0913334455"
    assert public_res.json()["data"]["store_name"] == "نسائم ليبيا المحدثة"


@pytest.mark.django_db
def test_permissions_gate_for_settings(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)
    assert api_client.get("/api/admin/store-settings/").status_code == 403
    assert api_client.put("/api/admin/store-settings/", {"store_name": "قرصنة"}).status_code == 403
    assert api_client.get("/api/admin/bank-accounts/").status_code == 403
    assert api_client.post("/api/admin/bank-accounts/", {}).status_code == 403


@pytest.mark.django_db
def test_validation_iban_and_phone(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    # Invalid phone
    res = api_client.put("/api/admin/store-settings/", {"phone": "1234"}, format="json")
    assert res.status_code == 400

    # Invalid IBAN (not starting with LY or wrong length)
    res = api_client.post(
        "/api/admin/bank-accounts/",
        {
            "bank_name": "مصرف الصحارى",
            "account_holder": "نسائم",
            "account_number": "12345",
            "iban": "GB1234",
        },
        format="json",
    )
    assert res.status_code == 400

    # Valid IBAN and account
    res = api_client.post(
        "/api/admin/bank-accounts/",
        {
            "bank_name": "مصرف الصحارى",
            "account_holder": "نسائم",
            "account_number": "12345",
            "iban": "LY88000100000000012345678",
        },
        format="json",
    )
    assert res.status_code == 201


@pytest.mark.django_db
def test_notifications_and_invoice_dynamic_sync(sample_order):
    cache.clear()
    StoreSettings.objects.update_or_create(
        pk=1,
        defaults={
            "store_name": "نسائم ليبيا الفاخرة",
            "legal_name": "شركة نسائم العالمية ش.م.م",
            "phone": "0917778899",
            "whatsapp": "0917778899",
            "site_url": "https://custom-nasaeem.ly",
            "bank_transfer_note": "يرجى إرسال الإشعار بعد التحويل",
        },
    )
    BankAccount.objects.all().delete()
    BankAccount.objects.create(
        id=uuid.uuid4(),
        bank_name="مصرف الوحدة",
        account_holder="شركة نسائم العالمية ش.م.م",
        account_number="9876543210",
        iban="LY88000200000000098765432",
        is_active=True,
    )

    # WhatsApp bank transfer message
    msg = format_bank_transfer_whatsapp_message(sample_order)
    assert "مصرف الوحدة" in msg
    assert "9876543210" in msg
    assert "LY88000200000000098765432" in msg
    assert "يرجى إرسال الإشعار بعد التحويل" in msg

    # Invoice Data
    invoice = build_order_invoice_data(sample_order)
    assert invoice["company"]["name"] == "شركة نسائم العالمية ش.م.م"
    assert invoice["company"]["phone"] == "0917778899"
    assert invoice["verification_url"].startswith("https://custom-nasaeem.ly/track?order=")


@pytest.mark.django_db
def test_spa_render_shell_injects_store_settings(rf):
    request = rf.get("/")
    response = render_shell(request, path="")
    assert response.status_code == 200
    content = response.content.decode("utf-8")
    assert "window.__STORE_SETTINGS__ =" in content
