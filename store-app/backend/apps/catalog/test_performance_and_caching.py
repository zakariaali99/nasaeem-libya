from decimal import Decimal
import pytest
from django.core.cache import cache
from rest_framework.test import APIClient

from apps.catalog.images import process_fragrance_image
from apps.catalog.models import Category, Product
from apps.core.models import Role, User
from apps.orders.models import CartPromotion


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        phone_number="0919999111",
        role=Role.ADMIN,
        password="secretpassword123",
    )


@pytest.fixture
def sample_product(db):
    cat = Category.objects.create(name="عطور مسك فاخرة", slug="royal-musk")
    prod = Product.objects.create(
        name="مسك الطهارة الملكي",
        slug="royal-tahara-musk",
        sku="MUSK-001",
        price=Decimal("180.00"),
        stock=15,
        is_active=True,
    )
    prod.categories.add(cat)
    return prod


@pytest.mark.django_db
def test_category_tree_caching_and_invalidation(api_client, admin_user):
    cache.clear()

    # 1. Fetch categories as guest (populates cache)
    res1 = api_client.get("/api/categories/")
    assert res1.status_code == 200
    assert cache.get("store:categories:tree") is not None

    # 2. Admin creates a new category (invalidates cache)
    api_client.force_authenticate(user=admin_user)
    create_res = api_client.post(
        "/api/categories/",
        {"name": "عطور صيفية منعشة", "slug": "summer-fragrances"},
        format="json",
    )
    assert create_res.status_code == 201
    assert cache.get("store:categories:tree") is None


@pytest.mark.django_db
def test_product_detail_caching_and_invalidation(api_client, admin_user, sample_product):
    cache.clear()

    # 1. Fetch product as guest (populates cache)
    res = api_client.get(f"/api/products/{sample_product.slug}/")
    assert res.status_code == 200
    cache_key = f"store:product:{sample_product.slug}"
    assert cache.get(cache_key) is not None

    # 2. Admin patches product (invalidates cache)
    api_client.force_authenticate(user=admin_user)
    patch_res = api_client.patch(
        f"/api/products/{sample_product.slug}/",
        {"price": "195.00"},
        format="json",
    )
    assert patch_res.status_code == 200
    assert cache.get(cache_key) is None


@pytest.mark.django_db
def test_active_cart_promotion_caching_and_invalidation(api_client, admin_user):
    cache.clear()

    promo = CartPromotion.objects.create(
        title="توصيل مجاني لكافة المدن",
        message="أضف 200 د.ل",
        success_message="مبروك التوصيل المجاني",
        min_order_amount=Decimal("200.00"),
        is_active=True,
    )

    # 1. Fetch promo as public (populates cache)
    res = api_client.get("/api/cart/promotions/active/")
    assert res.status_code == 200
    assert cache.get("store:promotions:active") is not None

    # 2. Admin updates promo settings (invalidates cache)
    api_client.force_authenticate(user=admin_user)
    put_res = api_client.put(
        "/api/admin/cart-promotions/",
        {"min_order_amount": "250.00"},
        format="json",
    )
    assert put_res.status_code == 200
    assert cache.get("store:promotions:active") is None


def test_image_pipeline_derivatives_generation():
    # Test derivative generator with mock bytes
    mock_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\r\xef\x05f\x00\x00\x00\x00IEND\xaeB`\x82"
    derivatives = process_fragrance_image(mock_bytes)
    assert "thumb" in derivatives
    assert "card" in derivatives
    assert "hero" in derivatives
