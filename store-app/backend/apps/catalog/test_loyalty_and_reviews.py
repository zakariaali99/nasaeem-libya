from decimal import Decimal
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product, ProductReview
from apps.core.models import Role, User, LoyaltyTransaction
from apps.orders.models import Cart, CartItem, Order, OrderItem, OrderStatus


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        phone_number="0912345678",
        name="أحمد الفرجاني",
        role=Role.CUSTOMER,
        password="secretpassword123",
    )


@pytest.fixture
def admin_user(db):
    return User.objects.create_superuser(
        phone_number="0919999999",
        name="المدير العام",
        role=Role.ADMIN,
        password="secretpassword123",
    )


@pytest.fixture
def sample_product(db):
    cat = Category.objects.create(name="عطور فاخرة", slug="luxury-perfumes")
    prod = Product.objects.create(
        name="عطر الروح الملكي",
        slug="royal-spirit",
        sku="RS-001",
        price=Decimal("250.00"),
        stock=20,
        is_active=True,
    )
    prod.categories.add(cat)
    return prod


@pytest.mark.django_db
def test_product_review_submission_and_loyalty_bonus(api_client, customer_user, sample_product):
    # Customer has not bought yet
    api_client.force_authenticate(user=customer_user)
    initial_points = customer_user.loyalty_points

    response = api_client.post(
        f"/api/products/{sample_product.slug}/reviews/",
        {
            "rating": 5,
            "title": "عطر رائع جداً وثباته ممتاز",
            "comment": "عطر نفاث ورائحته تدوم لساعات طويلة، شكراً نسائم ليبيا!",
            "photo_url": "https://example.com/bottle-photo.jpg",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["bonus_points"] == 50

    # Verify user received 50 points
    customer_user.refresh_from_db()
    assert customer_user.loyalty_points == initial_points + 50

    # Verify LoyaltyTransaction created
    tx = LoyaltyTransaction.objects.filter(user=customer_user, transaction_type="REVIEW_BONUS").first()
    assert tx is not None
    assert tx.points_change == 50

    # Verify Review record
    rev = ProductReview.objects.filter(product=sample_product, user=customer_user).first()
    assert rev is not None
    assert rev.rating == 5
    assert rev.is_verified_buyer is False

    # Get Reviews list
    get_res = api_client.get(f"/api/products/{sample_product.slug}/reviews/")
    assert get_res.status_code == 200
    assert get_res.data["data"]["total_reviews"] == 1
    assert get_res.data["data"]["average_rating"] == 5.0


@pytest.mark.django_db
def test_vip_loyalty_summary_and_tier_recalculation(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)

    # Initial Silver Tier
    res = api_client.get("/api/loyalty/me/")
    assert res.status_code == 200
    assert res.data["data"]["vip_tier"] == "SILVER"
    assert res.data["data"]["next_tier"] == "GOLD"

    # Upgrade to Gold Tier by increasing spend
    customer_user.lifetime_spend = Decimal("1500.00")
    customer_user.recalculate_vip_tier()
    customer_user.save()

    res_gold = api_client.get("/api/loyalty/me/")
    assert res_gold.data["data"]["vip_tier"] == "GOLD"
    assert res_gold.data["data"]["next_tier"] == "DIAMOND"

    # Upgrade to Diamond Tier
    customer_user.lifetime_spend = Decimal("3000.00")
    customer_user.recalculate_vip_tier()
    customer_user.save()

    res_diamond = api_client.get("/api/loyalty/me/")
    assert res_diamond.data["data"]["vip_tier"] == "DIAMOND"
    assert res_diamond.data["data"]["next_tier"] is None


@pytest.mark.django_db
def test_abandoned_cart_recovery_admin_flow(api_client, admin_user, customer_user, sample_product):
    api_client.force_authenticate(user=admin_user)

    # Create an abandoned cart
    cart = Cart.objects.create(
        user=customer_user,
        phone_number="0912345678",
        customer_name="أحمد الفرجاني",
    )
    Cart.objects.filter(id=cart.id).update(updated_at=timezone.now() - timezone.timedelta(minutes=45))
    CartItem.objects.create(cart=cart, product=sample_product, quantity=2)

    # List Abandoned Carts
    res = api_client.get("/api/admin/marketing/abandoned-carts/")
    assert res.status_code == 200
    assert res.data["data"]["stats"]["abandoned_count"] >= 1

    # Trigger Send WhatsApp Reminder
    wa_res = api_client.post(f"/api/admin/marketing/abandoned-carts/{cart.id}/send-whatsapp/")
    assert wa_res.status_code == 200
    assert "https://wa.me/218" in wa_res.data["whatsapp_link"]

    # Mark as Recovered
    rec_res = api_client.post(f"/api/admin/marketing/abandoned-carts/{cart.id}/mark-recovered/")
    assert rec_res.status_code == 200

    cart.refresh_from_db()
    assert cart.is_recovered is True
