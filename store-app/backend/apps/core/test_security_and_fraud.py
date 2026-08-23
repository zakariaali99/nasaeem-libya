from decimal import Decimal
import pytest
from rest_framework.test import APIClient

from apps.accounts.permissions import IsAdminOrOwner, IsManagerOrAbove, IsStaffOrAbove, IsSupportOrAbove
from apps.catalog.models import Category, Product
from apps.core.models import City, Region, Role, User
from apps.orders.models import Order, OrderItem, OrderStatus
from apps.orders.services import CheckoutError, finalise_order


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def blacklisted_customer(db):
    return User.objects.create_user(
        phone_number="0913334455",
        name="عميل متهرب من الاستلام",
        role=Role.CUSTOMER,
        password="secretpassword123",
        is_cod_blacklisted=True,
        cod_blacklist_reason="رفض متكرر للاستلام عند الباب",
    )


@pytest.fixture
def normal_customer(db):
    return User.objects.create_user(
        phone_number="0915556677",
        name="عميل ملتزم",
        role=Role.CUSTOMER,
        password="secretpassword123",
    )


@pytest.fixture
def sample_order(db, blacklisted_customer):
    city = City.objects.create(id="tripoli", name="طرابلس", code="TIP", is_active=True)
    region = Region.objects.create(id="noufleen", city=city, name="النوفليين", delivery_fee=Decimal("15.00"), is_active=True)
    prod = Product.objects.create(
        name="عطر الروح الملكي",
        slug="royal-spirit-sec",
        sku="SEC-001",
        price=Decimal("200.00"),
        stock=10,
        is_active=True,
    )
    order = Order.objects.create(
        user=blacklisted_customer,
        order_number="ORD-SEC-001",
        subtotal=Decimal("200.00"),
        total=Decimal("215.00"),
        status=OrderStatus.PENDING,
        shipping_region=region,
        shipping_city=city,
        shipping_address="شارع النوفليين الرئيسي",
    )
    OrderItem.objects.create(
        order=order,
        product=prod,
        product_name=prod.name,
        quantity=1,
        unit_price=prod.price,
        total_price=prod.price,
    )
    return order, region


@pytest.mark.django_db
def test_cod_blacklisted_customer_blocked_from_cash_on_delivery(sample_order):
    order, region = sample_order

    # Attempting to finalise with COD must raise CheckoutError with 403 status
    with pytest.raises(CheckoutError) as exc_info:
        finalise_order(
            order,
            region_id=str(region.id),
            address="شارع النوفليين الرئيسي",
            payment_method="cod",
        )
    assert exc_info.value.status == 403
    assert "الدفع الإلكتروني" in str(exc_info.value.message)


@pytest.mark.django_db
def test_granular_rbac_permission_matrix(db):
    support = User.objects.create_user(phone_number="0910000001", role=Role.SUPPORT, password="pass")
    staff = User.objects.create_user(phone_number="0910000002", role=Role.STAFF, password="pass")
    manager = User.objects.create_user(phone_number="0910000003", role=Role.MANAGER, password="pass")
    admin = User.objects.create_user(phone_number="0910000004", role=Role.ADMIN, password="pass")
    owner = User.objects.create_user(phone_number="0910000005", role=Role.OWNER, password="pass")
    cust = User.objects.create_user(phone_number="0910000006", role=Role.CUSTOMER, password="pass")

    class DummyRequest:
        def __init__(self, u):
            self.user = u

    # IsAdminOrOwner: only ADMIN and OWNER
    assert IsAdminOrOwner().has_permission(DummyRequest(owner), None) is True
    assert IsAdminOrOwner().has_permission(DummyRequest(admin), None) is True
    assert IsAdminOrOwner().has_permission(DummyRequest(manager), None) is False
    assert IsAdminOrOwner().has_permission(DummyRequest(staff), None) is False
    assert IsAdminOrOwner().has_permission(DummyRequest(support), None) is False
    assert IsAdminOrOwner().has_permission(DummyRequest(cust), None) is False

    # IsManagerOrAbove: MANAGER, ADMIN, OWNER
    assert IsManagerOrAbove().has_permission(DummyRequest(manager), None) is True
    assert IsManagerOrAbove().has_permission(DummyRequest(staff), None) is False

    # IsStaffOrAbove: STAFF, MANAGER, ADMIN, OWNER
    assert IsStaffOrAbove().has_permission(DummyRequest(staff), None) is True
    assert IsStaffOrAbove().has_permission(DummyRequest(support), None) is False

    # IsSupportOrAbove: SUPPORT, STAFF, MANAGER, ADMIN, OWNER
    assert IsSupportOrAbove().has_permission(DummyRequest(support), None) is True
    assert IsSupportOrAbove().has_permission(DummyRequest(cust), None) is False


@pytest.mark.django_db
def test_admin_user_update_cod_blacklist_status(api_client, blacklisted_customer):
    admin = User.objects.create_superuser(
        phone_number="0919999888",
        role=Role.ADMIN,
        password="supersecretpass",
    )
    api_client.force_authenticate(user=admin)

    # Admin unbans customer from COD
    res = api_client.patch(
        f"/api/admin/users/{blacklisted_customer.id}/",
        {"is_cod_blacklisted": False, "cod_blacklist_reason": ""},
        format="json",
    )
    assert res.status_code == 200
    blacklisted_customer.refresh_from_db()
    assert blacklisted_customer.is_cod_blacklisted is False
