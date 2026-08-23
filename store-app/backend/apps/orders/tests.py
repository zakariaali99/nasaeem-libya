"""Order-domain invariants that are structural rather than behavioural.

The checkout transaction itself is Phase 5; these guard the shapes it relies on.
"""

from decimal import Decimal

import pytest

from apps.orders.models import (
    Cart,
    CartItem,
    DiscountType,
    Order,
    OrderItem,
    OrderStatus,
    PaymentStatus,
    ShippingStatus,
)

pytestmark = pytest.mark.django_db


class TestGuestCart:
    def test_a_cart_may_exist_without_a_user(self):
        """Requiring an account before add-to-cart is the largest conversion tax
        there is. The model must permit a guest basket."""
        cart = Cart.objects.create(session_id="anon-session-abc")
        assert cart.user is None
        assert cart.pk

    def test_a_guest_cart_holds_items(self, product):
        cart = Cart.objects.create(session_id="anon-session-abc")
        CartItem.objects.create(cart=cart, product=product, quantity=2)
        assert cart.items.count() == 1


class TestOrderSnapshots:
    def test_renaming_a_product_does_not_alter_a_past_order(self, product, customer):
        order = Order.objects.create(order_number="202608MOA0002", user=customer)
        item = OrderItem.objects.create(
            order=order, product=product, quantity=1,
            unit_price=Decimal("450.00"), total_price=Decimal("450.00"),
            product_name=product.name,
        )
        product.name = "اسم جديد تماماً"
        product.price = Decimal("999.00")
        product.save()

        item.refresh_from_db()
        assert item.product_name == "عود ملكي"
        assert item.unit_price == Decimal("450.00")

    def test_order_number_is_unique(self, customer):
        Order.objects.create(order_number="202608MOA0003", user=customer)
        from django.db import IntegrityError

        with pytest.raises(IntegrityError):
            Order.objects.create(order_number="202608MOA0003")

    def test_an_order_survives_its_customer_being_deleted(self, product, customer):
        order = Order.objects.create(order_number="202608MOA0004", user=customer)
        customer.delete()
        order.refresh_from_db()
        assert order.user is None


class TestEnumsMatchTheSpecification:
    """The stored value is an API contract and the label is user-visible Arabic.
    Renaming either is a breaking change, so both are pinned here."""

    def test_order_status_values_and_labels(self):
        assert dict(OrderStatus.choices) == {
            "pending": "قيد الانتظار",
            "processing": "قيد المعالجة",
            "completed": "مكتمل",
            "cancelled": "ملغي",
            "refunded": "مسترجع",
        }

    def test_shipping_status_values_and_labels(self):
        assert dict(ShippingStatus.choices) == {
            "pending": "قيد الانتظار",
            "accepted": "تم القبول",
            "delivered": "تم التوصيل",
            "returned": "مرتجع",
            "cancelled": "ملغي",
        }

    def test_payment_status_values_and_labels(self):
        assert dict(PaymentStatus.choices) == {
            "pending": "قيد الانتظار",
            "completed": "مكتمل",
            "failed": "فشل",
            "cancelled": "ملغي",
            "refunded": "مسترجع",
            "waiting_for_verification": "بانتظار التحقق",
        }

    def test_discount_type_values_and_labels(self):
        assert dict(DiscountType.choices) == {
            "percentage": "نسبة مئوية",
            "fixed": "مبلغ ثابت",
        }


class TestCartPromotionEngine:
    def test_delivery_fee_below_threshold(self, db):
        from apps.core.models import City, Region
        from apps.orders.models import CartPromotion
        from apps.orders.services import delivery_fee

        city = City.objects.create(name="طرابلس", code="TIP", delivery_fee=Decimal("15.00"))
        region = Region.objects.create(city=city, name="وسط المدينة", delivery_fee=Decimal("15.00"))

        CartPromotion.objects.all().delete()
        CartPromotion.objects.create(
            title="توصيل مجاني",
            min_order_amount=Decimal("200.00"),
            is_active=True,
        )

        fee, discount = delivery_fee(region, subtotal=Decimal("150.00"))
        assert fee == Decimal("15.00")
        assert discount == Decimal("0.00")

    def test_delivery_fee_at_or_above_threshold(self, db):
        from apps.core.models import City, Region
        from apps.orders.models import CartPromotion
        from apps.orders.services import delivery_fee

        city = City.objects.create(name="بنغازي", code="BEN", delivery_fee=Decimal("25.00"))
        region = Region.objects.create(city=city, name="وسط المدينة", delivery_fee=Decimal("25.00"))

        CartPromotion.objects.all().delete()
        CartPromotion.objects.create(
            title="توصيل مجاني",
            min_order_amount=Decimal("200.00"),
            is_active=True,
        )

        fee, discount = delivery_fee(region, subtotal=Decimal("250.00"))
        assert fee == Decimal("0.00")
        assert discount == Decimal("25.00")

    def test_delivery_fee_when_promo_inactive(self, db):
        from apps.core.models import City, Region
        from apps.orders.models import CartPromotion
        from apps.orders.services import delivery_fee

        city = City.objects.create(name="مصراتة", code="MRA", delivery_fee=Decimal("20.00"))
        region = Region.objects.create(city=city, name="المركز", delivery_fee=Decimal("20.00"))

        CartPromotion.objects.all().delete()
        CartPromotion.objects.create(
            title="توصيل مجاني",
            min_order_amount=Decimal("200.00"),
            is_active=False,
        )

        fee, discount = delivery_fee(region, subtotal=Decimal("300.00"))
        assert fee == Decimal("20.00")
        assert discount == Decimal("0.00")

    def test_active_and_admin_cart_promotion_endpoints(self, client, admin_client):
        from apps.orders.models import CartPromotion

        CartPromotion.objects.all().delete()
        CartPromotion.objects.create(
            title="شحن مجاني لكافة المدن",
            min_order_amount=Decimal("180.00"),
            is_active=True,
        )

        # Public endpoint
        res = client.get("/api/cart/promotions/active/")
        assert res.status_code == 200
        assert res.json()["data"]["min_order_amount"] == "180.00"
        assert res.json()["data"]["is_active"] is True

        # Admin endpoint GET
        admin_res = admin_client.get("/api/admin/cart-promotions/")
        assert admin_res.status_code == 200
        assert admin_res.json()["data"]["min_order_amount"] == "180.00"

        # Admin endpoint PUT
        put_res = admin_client.put(
            "/api/admin/cart-promotions/",
            {"min_order_amount": "250.00", "is_active": False},
            content_type="application/json",
        )
        assert put_res.status_code == 200
        assert put_res.json()["data"]["min_order_amount"] == "250.00"
        assert put_res.json()["data"]["is_active"] is False

        # Public endpoint now returns null when inactive
        public_res = client.get("/api/cart/promotions/active/")
        assert public_res.status_code == 200
        assert public_res.json()["data"] is None


class TestAdminQuickOrderAndBulkActions:
    def test_quick_create_order_deducts_stock_and_creates_customer(self, admin_client, product, city):
        initial_stock = product.stock
        payload = {
            "customer_name": "أحمد الفرجاني",
            "customer_phone": "0912345678",
            "customer_email": "ahmed@example.ly",
            "shipping_city_id": str(city.id),
            "shipping_address": "شارع النصر — طرابلس",
            "delivery_method_code": "",
            "payment_method_code": "manual_payment",
            "customer_notes": "التوصيل بعد العصر",
            "items": [
                {"product_id": product.id, "quantity": 2}
            ],
        }

        res = admin_client.post(
            "/api/admin/orders/quick-create/",
            payload,
            content_type="application/json",
        )
        assert res.status_code == 201
        data = res.json()["data"]
        assert data["order_number"].startswith("2026")
        assert len(data["items"]) == 1
        assert data["items"][0]["quantity"] == 2

        # Verify stock was atomically deducted
        product.refresh_from_db()
        assert product.stock == initial_stock - 2

        # Verify customer was created
        from apps.core.models import User
        user = User.objects.get(phone_number="0912345678")
        assert user.name == "أحمد الفرجاني"
        assert user.phone_verified is True

    def test_quick_create_order_fails_when_stock_insufficient(self, admin_client, product, city):
        product.stock = 1
        product.save(update_fields=["stock"])

        payload = {
            "customer_name": "طارق الصادق",
            "customer_phone": "0923334455",
            "shipping_city_id": str(city.id),
            "shipping_address": "وسط البلاد",
            "items": [
                {"product_id": product.id, "quantity": 5}
            ],
        }

        res = admin_client.post(
            "/api/admin/orders/quick-create/",
            payload,
            content_type="application/json",
        )
        assert res.status_code == 400
        assert "غير متوفرة" in res.json()["message"]

    def test_customer_lookup_by_phone(self, admin_client, customer):
        customer.name = "محمود التاجوري"
        customer.phone_number = "0915556677"
        customer.save()

        res = admin_client.get("/api/admin/customers/lookup/?phone=091555")
        assert res.status_code == 200
        items = res.json()["data"]
        assert len(items) >= 1
        assert items[0]["name"] == "محمود التاجوري"
        assert items[0]["phone_number"] == "0915556677"

    def test_bulk_order_action_updates_statuses(self, admin_client, customer):
        order1 = Order.objects.create(order_number="202608MOA8801", user=customer, status=OrderStatus.PENDING)
        order2 = Order.objects.create(order_number="202608MOA8802", user=customer, status=OrderStatus.PENDING)

        res = admin_client.post(
            "/api/admin/orders/bulk-action/",
            {"order_ids": [str(order1.id), str(order2.id)], "action": "mark_processing"},
            content_type="application/json",
        )
        assert res.status_code == 200
        assert res.json()["data"]["updated_count"] == 2

        order1.refresh_from_db()
        order2.refresh_from_db()
        assert order1.status == OrderStatus.PROCESSING
        assert order2.status == OrderStatus.PROCESSING


@pytest.mark.django_db
class TestAdminWaybillsAndInvoices:
    """Plan 02 — Thermal Waybills & Official Invoicing Suite Tests."""

    def test_tafqeet_libyan_dinars_conversion(self):
        from apps.orders.tafqeet import tafqeet_libyan_dinars
        assert "أربعمائة وعشرون ديناراً" in tafqeet_libyan_dinars("420.00")
        assert "مائة وخمسة وأربعون ديناراً" in tafqeet_libyan_dinars("145.50")
        assert "خمسون درهماً" in tafqeet_libyan_dinars("145.50")
        assert "ألف دينار" in tafqeet_libyan_dinars("1000.00")

    def test_order_waybill_endpoint(self, admin_client, customer, product):
        order = Order.objects.create(
            order_number="202608MOA9901",
            user=customer,
            status=OrderStatus.PROCESSING,
            total=Decimal("350.00"),
            payment_method="manual_payment",
            shipping_address="طرابلس — شارع النصر",
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=2,
            unit_price=Decimal("175.00"),
            total_price=Decimal("350.00"),
        )

        res = admin_client.get(f"/api/admin/orders/{order.order_number}/waybill/")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["order_number"] == "202608MOA9901"
        assert data["recipient"]["address"] == "طرابلس — شارع النصر"
        assert data["payment"]["cod_amount"] == "350.00"
        assert len(data["packing_list"]) == 1
        assert data["packing_list"][0]["quantity"] == 2
        assert "بضاعة قابلة للكسر" in data["fragile_warning"]

    def test_order_invoice_endpoint(self, admin_client, customer, product):
        order = Order.objects.create(
            order_number="202608MOA9902",
            user=customer,
            status=OrderStatus.PROCESSING,
            subtotal=Decimal("300.00"),
            shipping_total=Decimal("20.00"),
            total=Decimal("320.00"),
            payment_method="manual_payment",
        )
        OrderItem.objects.create(
            order=order,
            product=product,
            quantity=1,
            unit_price=Decimal("300.00"),
            total_price=Decimal("300.00"),
        )

        res = admin_client.get(f"/api/admin/orders/{order.order_number}/invoice/")
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["invoice_number"].startswith("INV-")
        assert data["order_number"] == "202608MOA9902"
        assert data["financials"]["total"] == "320.00"
        assert "ثلاثمائة وعشرون ديناراً" in data["financials"]["tafqeet"]
        assert "شركة نسائم ليبيا" in data["company"]["name"]
        assert "100%" in data["terms"]

    def test_batch_waybills_endpoint(self, admin_client, customer):
        order1 = Order.objects.create(order_number="202608MOA9903", user=customer, total=Decimal("100.00"))
        order2 = Order.objects.create(order_number="202608MOA9904", user=customer, total=Decimal("200.00"))

        res = admin_client.post(
            "/api/admin/orders/batch-waybills/",
            {"order_ids": [str(order1.id), str(order2.id)]},
            content_type="application/json",
        )
        assert res.status_code == 200
        items = res.json()["data"]
        assert len(items) == 2
        assert items[0]["order_number"] in ["202608MOA9903", "202608MOA9904"]

