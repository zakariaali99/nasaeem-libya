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
    res = api_client.get(f"/api/products/by-slug/{sample_product.slug}/")
    assert res.status_code == 200
    cache_key = f"store:product:{sample_product.slug}"
    assert cache.get(cache_key) is not None

    # 2. Admin patches product (invalidates cache)
    api_client.force_authenticate(user=admin_user)
    patch_res = api_client.patch(
        f"/api/products/{sample_product.id}/",
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


@pytest.mark.django_db
def test_optimize_media_command(tmp_path, settings):
    import io
    from io import StringIO
    from PIL import Image
    from django.core.management import call_command
    from apps.catalog.models import ProductImage

    settings.MEDIA_ROOT = str(tmp_path)
    banners_dir = tmp_path / "banners"
    banners_dir.mkdir(parents=True, exist_ok=True)
    hero_jpg = banners_dir / "test-hero.jpg"

    img = Image.new("RGB", (1000, 500), (200, 100, 50))
    img.save(hero_jpg, "JPEG")

    out = StringIO()
    call_command("optimize_media", "--dry-run", stdout=out)
    output = out.getvalue()
    assert "DRY RUN" in output

    out_real = StringIO()
    call_command("optimize_media", stdout=out_real)
    assert (banners_dir / "test-hero.webp").exists()
    assert (banners_dir / "test-hero-medium.webp").exists()


@pytest.mark.django_db
def test_spa_bootstrap_and_hero_preload(rf):
    from apps.storefront.spa import render_shell
    request = rf.get("/")
    res = render_shell(request, path="")
    assert res.status_code == 200
    content = res.content.decode("utf-8")
    assert "window.__BOOTSTRAP__ =" in content
    assert "window.__STORE_SETTINGS__ =" in content


@pytest.mark.django_db
def test_media_serving_cache_headers(client, tmp_path, settings):
    from PIL import Image
    settings.MEDIA_ROOT = str(tmp_path)
    banners = tmp_path / "banners"
    banners.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (100, 100), (0, 0, 0)).save(banners / "sample.webp", "WEBP")

    res = client.get("/media/banners/sample.webp", HTTP_HOST="localhost")
    assert res.status_code == 200
    assert "public" in res.headers.get("Cache-Control", "")
    assert "max-age=2592000" in res.headers.get("Cache-Control", "")


