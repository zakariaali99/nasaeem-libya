from decimal import Decimal
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.catalog.models import Category, Product, ProductBundle
from apps.core.models import City, Region
from apps.orders.models import Cart, CartItem, Order, DeliveryMethod
from apps.orders import services

User = get_user_model()


@pytest.mark.django_db
def test_product_bundles_and_gifting_checkout():
    # 1. Setup user & products
    user = User.objects.create_user(
        phone_number="0912223344",
        name="طارق المجريسي",
        role="customer",
    )
    cat = Category.objects.create(name="عطور فاخرة", slug="luxury-perfumes")
    main_p = Product.objects.create(
        name="عطر رويال عود",
        slug="royal-oud-luxury",
        price=Decimal("250.00"),
        compare_at_price=Decimal("300.00"),
        stock=20,
        track_quantity=True,
    )
    addon_p1 = Product.objects.create(
        name="معطر شعر عود ملكي",
        slug="royal-oud-hair-mist",
        price=Decimal("80.00"),
        stock=15,
        track_quantity=True,
    )
    addon_p2 = Product.objects.create(
        name="عينة بخاخ فاخر 10 مل",
        slug="royal-oud-travel-spray",
        price=Decimal("45.00"),
        stock=30,
        track_quantity=True,
    )

    # 2. Create ProductBundle
    bundle = ProductBundle.objects.create(
        name="حزمة العناية الملكية الشاملة",
        slug="royal-oud-care-bundle",
        description="العطر الأساسي مع معطر الشعر وبخاخ السفر بسعر توفيري خاص",
        main_product=main_p,
        bundle_price=Decimal("310.00"),
        original_price=Decimal("375.00"),
        badge_text="وفر 65.00 د.ل فوراً",
        is_active=True,
    )
    bundle.included_products.add(addon_p1, addon_p2)

    assert bundle.savings_amount == Decimal("65.00")

    # 3. Setup Delivery & Cart
    city = City.objects.create(id="tripoli", name="طرابلس", code="TIP", delivery_fee=Decimal("15.00"))
    region = Region.objects.create(id="nawfaleen", city=city, name="النوفليين", delivery_fee=Decimal("15.00"))
    delivery = DeliveryMethod.objects.create(name="مندوب نسائم السريع", code="nasaim_express")

    cart = Cart.objects.create(user=user)
    CartItem.objects.create(cart=cart, product=main_p, quantity=1)

    # 4. Execute Checkout with Luxury Gifting Suite
    order = services.checkout(
        cart=cart,
        user=user,
        region_id=str(region.id),
        address="شارع النوفليين، قرب مدرسة الفداء",
        delivery_method_code="nasaim_express",
        payment_method="moamalat",
        is_gift=True,
        gift_wrap_type="ROYAL_VELVET",
        gift_sender_name="طارق المجريسي",
        gift_recipient_name="م. فرج الورفلي",
        gift_message="ألف مبارك الترقية الجديدة، عطر يلق بمقامك الرفيع.",
        hide_invoice_prices=True,
    )

    assert order.is_gift is True
    assert order.gift_wrap_type == "ROYAL_VELVET"
    assert order.gift_wrap_fee == Decimal("15.00")
    assert order.gift_sender_name == "طارق المجريسي"
    assert order.gift_recipient_name == "م. فرج الورفلي"
    assert order.hide_invoice_prices is True
    # Subtotal (250) + Shipping (15) + Velvet Gift Wrap (15) = 280 LYD
    assert order.total == Decimal("280.00")


@pytest.mark.django_db
def test_product_detail_api_bundles_payload():
    client = APIClient()
    main_p = Product.objects.create(
        name="سوفاج ديور",
        slug="sauvage-dior",
        price=Decimal("380.00"),
        stock=10,
    )
    addon = Product.objects.create(
        name="جل استحمام سوفاج",
        slug="sauvage-shower-gel",
        price=Decimal("110.00"),
        stock=10,
    )

    bundle = ProductBundle.objects.create(
        name="طقم سوفاج الكامل",
        slug="sauvage-full-set",
        main_product=main_p,
        bundle_price=Decimal("420.00"),
        original_price=Decimal("490.00"),
        badge_text="وفر 70 د.ل",
    )
    bundle.included_products.add(addon)

    res = client.get(f"/api/products/{main_p.slug}/")
    assert res.status_code == 200
    data = res.json()["data"]
    assert "bundles" in data
    assert len(data["bundles"]) >= 1
    first_bundle = data["bundles"][0]
    assert first_bundle["bundle_price"] == "420.00"
    assert len(first_bundle["included_products"]) == 1
