from decimal import Decimal
import pytest
from rest_framework.test import APIClient
from apps.core.models import User, Role
from apps.catalog.models import Product, VariantOption, VariantValue, ProductVariant, InventoryLog

@pytest.fixture
def admin_client(db):
    client = APIClient()
    admin = User.objects.create_user(
        phone_number="0918887766",
        role=Role.ADMIN,
        password="strongpassword123",
    )
    client.force_authenticate(user=admin)
    return client

@pytest.mark.django_db
def test_create_product_with_sizes(admin_client):
    payload = {
        "name": "عطر رويال عود فاخر",
        "price": "350.00",
        "sku": "ROYAL-OUD",
        "description": "عطر شرقي نيش",
        "sizes": [
            {"size": "50 مل", "price": "350.00", "compare_at_price": "420.00", "stock": 15, "sku": "OUD-50ML"},
            {"size": "100 مل", "price": "550.00", "compare_at_price": "650.00", "stock": 10, "sku": "OUD-100ML"},
        ]
    }
    res = admin_client.post("/api/products/", payload, format="json")
    assert res.status_code == 201, res.data
    slug = res.data["data"]["slug"]

    product = Product.objects.get(slug=slug)
    assert product.has_variants is True
    assert product.stock == 25
    assert product.price == Decimal("350.00")
    assert product.variants.count() == 2

    # Check inventory logs were automatically recorded
    logs = InventoryLog.objects.filter(product=product)
    assert logs.count() == 2
    assert sum(log.change for log in logs) == 25

@pytest.mark.django_db
def test_sizes_manage_endpoint_get_and_post(admin_client):
    product = Product.objects.create(
        name="عطر ليبر إنتنس",
        slug="libre-intense-test",
        price=Decimal("400.00"),
        sku="LIB-INT",
    )

    # 1. Add size via sizes endpoint
    res = admin_client.post(
        f"/api/products/{product.slug}/sizes/",
        {
            "action": "add_size",
            "size": "90 مل",
            "price": "480.00",
            "compare_at_price": "550.00",
            "stock": 12,
            "sku": "LIB-90ML",
        },
        format="json",
    )
    assert res.status_code == 201

    # 2. Get sizes
    res_get = admin_client.get(f"/api/products/{product.slug}/sizes/")
    assert res_get.status_code == 200
    assert len(res_get.data["data"]) == 1
    variant_id = res_get.data["data"][0]["id"]
    assert res_get.data["data"][0]["size"] == "90 مل"
    assert res_get.data["data"][0]["stock"] == 12

    # 3. Batch adjust stock
    res_adj = admin_client.post(
        f"/api/products/{product.slug}/sizes/",
        {
            "action": "batch_adjust",
            "adjustments": [
                {"variant_id": variant_id, "change": 8, "reason": "restock", "note": "شحنة إضافية"}
            ]
        },
        format="json",
    )
    assert res_adj.status_code == 200

    product.refresh_from_db()
    assert product.stock == 20
