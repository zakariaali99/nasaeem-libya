"""Checkout: the money path.

The concurrency test at the bottom is the reason `select_for_update()` exists in
`services.checkout()`. It uses **real threads and real database connections** —
mocking the race would prove nothing about the lock.
"""

import threading
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.db import connections, transaction
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.catalog.models import Product
from apps.core.models import City, Region, User
from apps.orders import services
from apps.orders.models import (
    Cart,
    CartItem,
    DeliveryMethod,
    Discount,
    DiscountType,
    Order,
    OrderStatus,
)

pytestmark = pytest.mark.django_db

PASSWORD = "CorrectHorse9"


@pytest.fixture
def buyer(db):
    return User.objects.create_user(phone_number="0913333333", password=PASSWORD, name="مشتري")


@pytest.fixture
def buyer_api(buyer):
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": buyer.phone_number, "password": PASSWORD},
        format="json",
    )
    return client


@pytest.fixture
def courier(db):
    return DeliveryMethod.objects.create(name="فانكس", code="vanex", is_active=True)


def add_line(cart, product, quantity=1, variant=None):
    return CartItem.objects.create(cart=cart, product=product, variant=variant, quantity=quantity)


# --------------------------------------------------------------------------
# Guest carts
# --------------------------------------------------------------------------

class TestGuestCart:
    def test_a_guest_adds_to_the_cart_without_an_account(self, api, product):
        response = api.post(
            reverse("cart"), {"product_id": str(product.id), "quantity": 2}, format="json"
        )
        assert response.status_code == 201
        body = response.json()["data"]
        assert body["item_count"] == 2
        assert body["subtotal"] == "900.00"  # 450.00 × 2, computed server-side

    def test_the_guest_cart_survives_a_reload(self, api, product):
        api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        # A "reload" is a fresh GET carrying the same session cookie.
        again = api.get(reverse("cart")).json()["data"]
        assert again["item_count"] == 1

    def test_a_different_visitor_does_not_see_that_cart(self, api, product):
        api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        stranger = APIClient()
        assert stranger.get(reverse("cart")).json()["data"]["item_count"] == 0

    def test_adding_the_same_line_twice_increments_rather_than_duplicates(self, api, product):
        api.post(reverse("cart"), {"product_id": str(product.id), "quantity": 2}, format="json")
        body = api.post(
            reverse("cart"), {"product_id": str(product.id), "quantity": 3}, format="json"
        ).json()["data"]
        assert len(body["items"]) == 1
        assert body["item_count"] == 5

    def test_the_cart_refuses_more_than_the_shelf_holds(self, api, product):
        response = api.post(
            reverse("cart"), {"product_id": str(product.id), "quantity": 99}, format="json"
        )
        assert response.status_code == 409
        assert "10" in response.json()["message"]

    def test_a_variant_product_cannot_be_added_without_choosing_one(self, api, product, variant):
        product.has_variants = True
        product.save()
        response = api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        assert response.status_code == 400
        assert response.json()["message"] == "يرجى اختيار أحد خيارات المنتج"

    def test_quantity_and_removal_are_keyed_on_the_line_id(self, api, product):
        item_id = api.post(
            reverse("cart"), {"product_id": str(product.id)}, format="json"
        ).json()["data"]["items"][0]["id"]

        updated = api.patch(reverse("cart-item", args=[item_id]), {"quantity": 4}, format="json")
        assert updated.json()["data"]["item_count"] == 4

        removed = api.delete(reverse("cart-item", args=[item_id]))
        assert removed.json()["data"]["item_count"] == 0


class TestCartMergeOnLogin:
    def test_the_guest_cart_merges_into_the_user_cart_on_login(self, api, buyer, product):
        """The whole point of a guest cart: what you put in it before signing in
        is still there afterwards."""
        api.post(reverse("cart"), {"product_id": str(product.id), "quantity": 2}, format="json")

        response = api.post(
            reverse("auth-login"),
            {"phone_number": buyer.phone_number, "password": PASSWORD},
            format="json",
        )
        assert response.status_code == 200
        assert api.get(reverse("cart")).json()["data"]["item_count"] == 2

    def test_quantities_add_up_when_both_carts_hold_the_same_line(self, api, buyer, product):
        Cart.objects.create(user=buyer).items.create(product=product, quantity=1)
        api.post(reverse("cart"), {"product_id": str(product.id), "quantity": 2}, format="json")

        api.post(
            reverse("auth-login"),
            {"phone_number": buyer.phone_number, "password": PASSWORD},
            format="json",
        )
        body = api.get(reverse("cart")).json()["data"]
        assert len(body["items"]) == 1
        assert body["item_count"] == 3

    def test_the_guest_cart_row_does_not_linger(self, api, buyer, product):
        api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        api.post(
            reverse("auth-login"),
            {"phone_number": buyer.phone_number, "password": PASSWORD},
            format="json",
        )
        assert Cart.objects.filter(user__isnull=True).count() == 0


# --------------------------------------------------------------------------
# Money is computed server-side
# --------------------------------------------------------------------------

class TestServerSideTotals:
    def test_a_tampered_total_is_ignored(self, buyer_api, product, region, courier):
        """`CheckoutSerializer` has no `total` field at all, so a client that
        sends one is not merely overridden — it is never read."""
        buyer_api.post(reverse("cart"), {"product_id": str(product.id), "quantity": 2},
                       format="json")
        response = buyer_api.post(reverse("cart-checkout"), {
            "region_id": region.id,
            "address": "شارع النصر",
            "total": "1.00",
            "subtotal": "1.00",
            "shipping_total": "0.00",
        }, format="json")

        assert response.status_code == 201
        order = response.json()["data"]
        assert order["subtotal"] == "900.00"
        assert order["shipping_total"] == "5.00"     # the region's own fee
        assert order["total"] == "905.00"

    def test_a_tampered_unit_price_is_ignored(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id), "unit_price": "1.00"},
                       format="json")
        response = buyer_api.post(reverse("cart-checkout"),
                                  {"region_id": region.id, "address": "شارع النصر"},
                                  format="json")
        assert response.json()["data"]["items"][0]["unit_price"] == "450.00"

    def test_the_delivery_fee_falls_back_to_the_city(self, buyer_api, product, region_without_fee):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        response = buyer_api.post(reverse("cart-checkout"),
                                  {"region_id": region_without_fee.id, "address": "شارع"},
                                  format="json")
        # The region charges 0, so the city's 15.00 applies.
        assert response.json()["data"]["shipping_total"] == "15.00"

    def test_order_lines_snapshot_the_name_and_the_price(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        order_id = buyer_api.post(reverse("cart-checkout"),
                                  {"region_id": region.id, "address": "شارع"},
                                  format="json").json()["data"]["id"]

        product.name = "اسم جديد تماماً"
        product.price = Decimal("999.00")
        product.save()

        order = Order.objects.get(id=order_id)
        line = order.items.first()
        assert line.product_name == "عود ملكي"
        assert line.unit_price == Decimal("450.00")

    def test_the_cart_is_emptied_and_stock_reserved(self, buyer_api, buyer, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id), "quantity": 3},
                       format="json")
        buyer_api.post(reverse("cart-checkout"), {"region_id": region.id, "address": "شارع"},
                       format="json")

        product.refresh_from_db()
        assert product.reserved_stock == 3
        # Stock leaves the shelf on payment confirmation, not on checkout.
        assert product.stock == 10
        assert Cart.objects.get(user=buyer).items.count() == 0


class TestCheckoutRefusals:
    def test_checkout_requires_an_account(self, api, product, region):
        api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        response = api.post(reverse("cart-checkout"),
                            {"region_id": region.id, "address": "شارع"}, format="json")
        assert response.status_code == 401

    def test_an_empty_cart_cannot_be_checked_out(self, buyer_api, region):
        response = buyer_api.post(reverse("cart-checkout"),
                                  {"region_id": region.id, "address": "شارع"}, format="json")
        assert response.status_code == 400
        assert response.json()["message"] == "السلة فارغة"

    def test_an_address_is_required_to_confirm(self, buyer_api, product, region):
        """A draft order may exist without an address — `/checkout/:orderId` is
        where the customer types one. It cannot be CONFIRMED without it."""
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(reverse("cart-checkout"), {}, format="json").json()["data"]
        assert draft["shipping_address"] == ""
        assert draft["shipping_total"] == "0.00"

        response = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "  ",
        }, format="json")
        assert response.status_code == 400
        assert response.json()["errors"]["address"]

    def test_confirming_adds_the_delivery_fee_and_recomputes_the_total(
        self, buyer_api, product, region, courier
    ):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(reverse("cart-checkout"), {}, format="json").json()["data"]
        assert draft["total"] == "450.00"

        confirmed = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "شارع النصر",
            "delivery_method_code": courier.code, "payment_method": "moamalat",
        }, format="json").json()["data"]

        assert confirmed["shipping_total"] == "5.00"
        assert confirmed["total"] == "455.00"
        assert confirmed["region_name"] == region.name
        assert confirmed["delivery_method_name"] == courier.name

    def test_another_customer_cannot_confirm_your_order(self, buyer_api, product, region, db):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(reverse("cart-checkout"), {}, format="json").json()["data"]

        User.objects.create_user(phone_number="0916666666", password=PASSWORD)
        other = APIClient()
        other.post(reverse("auth-login"),
                   {"phone_number": "0916666666", "password": PASSWORD}, format="json")
        response = other.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "شارع",
        }, format="json")
        assert response.status_code == 404

    def test_with_zero_regions_checkout_explains_the_problem_in_arabic(
        self, buyer_api, product
    ):
        """The reference rendered an empty <select> here and the customer simply
        could not order. Say what is wrong."""
        Region.objects.all().delete()
        City.objects.all().delete()

        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(reverse("cart-checkout"), {}, format="json").json()["data"]
        response = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "address": "شارع",
        }, format="json")

        assert response.status_code == 400
        message = response.json()["message"]
        assert "لا توجد مناطق توصيل" in message
        assert not any("a" <= character.lower() <= "z" for character in message)

    def test_the_cities_endpoint_says_so_too(self, api):
        Region.objects.all().delete()
        City.objects.all().delete()
        body = api.get(reverse("delivery-cities")).json()
        assert body["data"] == []
        assert "لا توجد مدن توصيل" in body["message"]

    def test_a_deactivated_product_cannot_be_checked_out(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        product.is_active = False
        product.save()
        response = buyer_api.post(reverse("cart-checkout"),
                                  {"region_id": region.id, "address": "شارع"}, format="json")
        assert response.status_code == 400
        assert "لم يعد متاحاً" in response.json()["message"]


# --------------------------------------------------------------------------
# Discounts — every branch
# --------------------------------------------------------------------------

class TestDiscounts:
    @pytest.fixture
    def basket(self, buyer_api, product):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id), "quantity": 2},
                       format="json")  # subtotal 900.00
        return buyer_api

    def make(self, **kwargs):
        defaults = {
            "code": "WELCOME", "name": "ترحيب", "type": DiscountType.PERCENTAGE,
            "percentage": Decimal("10.00"), "value": Decimal("0.00"), "is_active": True,
        }
        return Discount.objects.create(**{**defaults, **kwargs})

    def checkout(self, client, region, code="WELCOME"):
        return client.post(reverse("cart-checkout"), {
            "region_id": region.id, "address": "شارع", "discount_code": code,
        }, format="json")

    def test_a_percentage_discount_applies(self, basket, region):
        self.make()
        order = self.checkout(basket, region).json()["data"]
        assert order["discount_total"] == "90.00"
        assert order["total"] == "815.00"  # 900 - 90 + 5

    def test_an_expired_discount_is_refused(self, basket, region):
        self.make(end_date=timezone.now() - timezone.timedelta(days=1))
        response = self.checkout(basket, region)
        assert response.status_code == 400
        assert response.json()["message"] == "انتهت صلاحية كود الخصم"

    def test_a_discount_that_has_not_started_is_refused(self, basket, region):
        self.make(start_date=timezone.now() + timezone.timedelta(days=1))
        assert self.checkout(basket, region).json()["message"] == "كود الخصم لم يبدأ بعد"

    def test_an_over_limit_discount_is_refused(self, basket, region):
        self.make(usage_limit=5, usage_count=5)
        assert self.checkout(basket, region).json()["message"] == "تم استخدام كود الخصم بالكامل"

    def test_a_below_minimum_basket_is_refused(self, basket, region):
        self.make(min_order_amount=Decimal("2000.00"))
        assert "الحد الأدنى" in self.checkout(basket, region).json()["message"]

    def test_the_cap_limits_the_discount(self, basket, region):
        self.make(max_discount_amount=Decimal("25.00"))
        order = self.checkout(basket, region).json()["data"]
        assert order["discount_total"] == "25.00"

    def test_an_inactive_discount_is_refused(self, basket, region):
        self.make(is_active=False)
        assert self.checkout(basket, region).json()["message"] == "كود الخصم غير مفعّل"

    def test_an_unknown_code_is_refused(self, basket, region):
        assert self.checkout(basket, region, code="NOPE").json()["message"] == "كود الخصم غير صحيح"

    def test_a_product_scoped_discount_only_counts_its_own_products(self, basket, region, db):
        other = Product.objects.create(
            name="غير مشمول", slug="غير-مشمول", price=Decimal("100.00"), sku="X", stock=5
        )
        discount = self.make(percentage=Decimal("50.00"))
        discount.products.set([other])
        response = self.checkout(basket, region)
        assert response.status_code == 400
        assert "لا ينطبق على المنتجات" in response.json()["message"]

    def test_a_fixed_discount_never_exceeds_the_basket(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        self.make(type=DiscountType.FIXED, value=Decimal("9999.00"))
        order = self.checkout(buyer_api, region).json()["data"]
        assert order["discount_total"] == "450.00"
        assert Decimal(order["total"]) >= 0

    def test_usage_count_increments_once_per_order(self, basket, region):
        discount = self.make(usage_limit=10)
        self.checkout(basket, region)
        discount.refresh_from_db()
        assert discount.usage_count == 1

    def test_the_public_validate_endpoint_never_leaks_limits(self, api, product):
        self.make(usage_limit=3, usage_count=1)
        api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        body = api.post(reverse("discount-list"), {"code": "WELCOME"}, format="json").json()["data"]
        assert set(body) == {"code", "name", "discount_total", "cart"}


# --------------------------------------------------------------------------
# Order visibility
# --------------------------------------------------------------------------

class TestOrderVisibility:
    def test_a_customer_sees_only_their_own_orders(self, buyer_api, buyer, product, region, db):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        buyer_api.post(reverse("cart-checkout"), {"region_id": region.id, "address": "شارع"},
                       format="json")

        stranger = User.objects.create_user(phone_number="0914444444", password=PASSWORD)
        other = APIClient()
        other.post(reverse("auth-login"),
                   {"phone_number": stranger.phone_number, "password": PASSWORD}, format="json")

        assert other.get(reverse("order-list")).json()["meta"]["total"] == 0

        order = Order.objects.first()
        # Tried by id, not merely absent from a list: 404, not 403 — confirming
        # that someone else's order exists is itself a leak.
        assert other.get(reverse("order-detail", args=[str(order.id)])).status_code == 404
        assert other.get(reverse("order-detail", args=[order.order_number])).status_code == 404

    def test_an_order_resolves_by_number_as_well_as_by_id(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        created = buyer_api.post(reverse("cart-checkout"),
                                 {"region_id": region.id, "address": "شارع"},
                                 format="json").json()["data"]
        by_number = buyer_api.get(reverse("order-detail", args=[created["order_number"]]))
        assert by_number.json()["data"]["id"] == created["id"]

    def test_an_anonymous_visitor_cannot_list_orders(self, api):
        assert api.get(reverse("order-list")).status_code == 401


@pytest.fixture
def admin_api(db):
    from apps.core.models import Role

    User.objects.create_superuser(
        phone_number="0912222222", password=PASSWORD, role=Role.OWNER
    )
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": "0912222222", "password": PASSWORD},
        format="json",
    )
    return client


class TestOrderAdminPatch:
    """The admin order endpoint validates what it writes.

    Transition *enforcement* is Phase 7; refusing an illegal *value* had to be
    true the day the endpoint shipped. Before this test, `{"status": "<any
    string>"}` was written straight through.
    """

    def test_an_unknown_status_value_is_refused(self, admin_api, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        created = buyer_api.post(reverse("cart-checkout"),
                                 {"region_id": region.id, "address": "شارع"},
                                 format="json").json()["data"]

        response = admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                                   {"status": "not-a-status"}, format="json")

        assert response.status_code == 400
        assert response.json()["errors"]["status"]
        assert Order.objects.get(id=created["id"]).status == OrderStatus.PENDING

    def test_an_unknown_field_is_refused_rather_than_ignored(self, admin_api, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        created = buyer_api.post(reverse("cart-checkout"),
                                 {"region_id": region.id, "address": "شارع"},
                                 format="json").json()["data"]

        response = admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                                   {"total": "1.00"}, format="json")

        assert response.status_code == 400
        assert Order.objects.get(id=created["id"]).total != Decimal("1.00")

    def test_a_legal_change_still_writes(self, admin_api, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        created = buyer_api.post(reverse("cart-checkout"),
                                 {"region_id": region.id, "address": "شارع"},
                                 format="json").json()["data"]

        response = admin_api.patch(
            reverse("order-detail", args=[created["order_number"]]),
            {"status": OrderStatus.PROCESSING, "tracking_number": " VX-0001 "},
            format="json",
        )

        assert response.status_code == 200
        order = Order.objects.get(id=created["id"])
        assert order.status == OrderStatus.PROCESSING
        assert order.tracking_number == "VX-0001"


class TestOrderNumbers:
    def test_the_format_is_preserved(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        number = buyer_api.post(reverse("cart-checkout"), {
            "region_id": region.id, "address": "شارع", "payment_method": "moamalat",
        }, format="json").json()["data"]["order_number"]

        assert number[:6] == timezone.localtime().strftime("%Y%m")
        assert number[6:9] == "MOA"
        assert number[9:].isdigit()

    def test_numbers_never_repeat(self, db):
        """The reference used Math.random() for these."""
        numbers = {services.next_order_number("moamalat") for _ in range(200)}
        assert len(numbers) == 200

    def test_a_missing_payment_method_still_produces_a_valid_number(self, db):
        assert services.next_order_number("")[6:9] == "UNK"


# --------------------------------------------------------------------------
# Concurrency — the reason select_for_update() exists
# --------------------------------------------------------------------------

@pytest.mark.django_db(transaction=True)
def test_two_checkouts_for_the_last_unit_one_succeeds_one_gets_409(django_db_setup):
    """Two real threads, two real connections, one unit of stock.

    Remove `select_for_update()` from `services.checkout()` and this MUST fail —
    both threads read `available_stock == 1` and both reserve it. If it still
    passes without the lock, the test is wrong; fix the test, not the gate.
    """
    city = City.objects.create(id="c1", name="طرابلس", code="TIP", delivery_fee=Decimal("10.00"))
    region = Region.objects.create(id="r1", name="وسط", city=city, delivery_fee=Decimal("0.00"))
    product = Product.objects.create(
        name="آخر قطعة", slug="آخر-قطعة", price=Decimal("100.00"), sku="LAST",
        track_quantity=True, stock=1,
    )

    buyers = []
    for index in range(2):
        user = User.objects.create_user(phone_number=f"091500000{index}", password=PASSWORD)
        cart = Cart.objects.create(user=user)
        CartItem.objects.create(cart=cart, product=product, quantity=1)
        buyers.append((user, cart))

    barrier = threading.Barrier(2)
    results = []
    lock = threading.Lock()

    def attempt(user, cart):
        try:
            barrier.wait(timeout=10)
            with transaction.atomic():
                order = services.checkout(
                    cart=cart, user=user, region_id=region.id, address="شارع",
                )
            with lock:
                results.append(("ok", order.order_number))
        except services.OutOfStock as exc:
            with lock:
                results.append(("conflict", exc.status))
        except Exception as exc:  # pragma: no cover - surfaced in the assertion
            with lock:
                results.append(("error", repr(exc)))
        finally:
            connections.close_all()

    threads = [threading.Thread(target=attempt, args=pair) for pair in buyers]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)

    outcomes = sorted(outcome for outcome, _ in results)
    assert outcomes == ["conflict", "ok"], results

    product.refresh_from_db()
    assert product.reserved_stock == 1, "the unit was reserved twice — the lock is not holding"
    assert Order.objects.count() == 1
    assert Order.objects.first().status == OrderStatus.PENDING


class TestOrderNumberTag:
    """The three-character payment tag is corrected at confirmation.

    A draft exists before the customer has chosen how to pay, so it is stamped
    `UNK`. Only the tag changes — the month and the sequence are the order's
    identity and must survive.
    """

    def test_the_tag_is_corrected_without_changing_the_identity(
        self, buyer_api, product, region
    ):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(reverse("cart-checkout"), {}, format="json").json()["data"]
        assert draft["order_number"][6:9] == "UNK"

        confirmed = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "شارع",
            "payment_method": "manual_payment",
        }, format="json").json()["data"]

        assert confirmed["order_number"][6:9] == "MAN"
        assert confirmed["order_number"][:6] == draft["order_number"][:6]
        assert confirmed["order_number"][9:] == draft["order_number"][9:]

    def test_confirming_without_a_payment_method_leaves_the_number_alone(
        self, buyer_api, product, region
    ):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        draft = buyer_api.post(reverse("cart-checkout"), {}, format="json").json()["data"]
        confirmed = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "شارع",
        }, format="json").json()["data"]
        assert confirmed["order_number"] == draft["order_number"]


# --------------------------------------------------------------------------
# Expired drafts — a reservation is a lease, not a leak
# --------------------------------------------------------------------------

@pytest.fixture
def discount(db):
    return Discount.objects.create(
        code="LEASED", name="كود محدود", type=DiscountType.PERCENTAGE,
        percentage=Decimal("10.00"), value=Decimal("0.00"),
        is_active=True, usage_limit=1,
    )


def _age_draft(order_id: str, minutes: int = 61) -> None:
    Order.objects.filter(id=order_id).update(
        created_at=timezone.now() - timedelta(minutes=minutes)
    )


class TestExpiredDrafts:
    def test_an_expired_draft_releases_its_reservation(self, buyer_api, product, region):
        assert product.stock == 10
        created = self._draft(buyer_api, product, region)
        product.refresh_from_db()
        assert product.reserved_stock == 1

        _age_draft(created["id"])
        released = services.release_expired_drafts()

        assert released == 1
        product.refresh_from_db()
        assert product.reserved_stock == 0
        assert Order.objects.get(id=created["id"]).status == OrderStatus.CANCELLED

    def _draft(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        return buyer_api.post(reverse("cart-checkout"),
                              {"region_id": region.id, "address": "شارع"},
                              format="json").json()["data"]

    def test_a_fresh_draft_is_never_touched(self, buyer_api, product, region):
        created = self._draft(buyer_api, product, region)

        assert services.release_expired_drafts() == 0

        order = Order.objects.get(id=created["id"])
        assert order.status == OrderStatus.PENDING
        product.refresh_from_db()
        assert product.reserved_stock == 1

    def test_an_finalised_order_is_never_reclaimed_however_old(self, buyer_api, product, region):
        draft = self._draft(buyer_api, product, region)
        response = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "شارع",
        }, format="json")
        assert response.status_code == 200
        Order.objects.filter(id=draft["id"]).update(
            created_at=timezone.now() - timedelta(days=7)
        )

        assert services.release_expired_drafts() == 0
        assert Order.objects.get(id=draft["id"]).status == OrderStatus.PENDING

    def test_an_expired_draft_cannot_be_finalised_afterwards(self, buyer_api, product, region):
        draft = self._draft(buyer_api, product, region)
        _age_draft(draft["id"])
        services.release_expired_drafts()

        response = buyer_api.post(reverse("checkout-confirm"), {
            "order_id": draft["id"], "region_id": region.id, "address": "شارع",
        }, format="json")

        assert response.status_code == 409

    def test_an_abandoned_draft_returns_its_discount_use(self, buyer_api, product, discount, region):
        self._draft_with_code(buyer_api, product, region, discount.code)
        discount.refresh_from_db()
        assert discount.usage_count == 1

        draft_id = Order.objects.first().id
        _age_draft(draft_id)
        services.release_expired_drafts()

        discount.refresh_from_db()
        assert discount.usage_count == 0

    def _draft_with_code(self, buyer_api, product, region, code):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        return buyer_api.post(reverse("cart-checkout"), {
            "region_id": region.id, "address": "شارع", "discount_code": code,
        }, format="json").json()["data"]

    def test_the_release_is_idempotent(self, buyer_api, product, region):
        created = self._draft(buyer_api, product, region)
        _age_draft(created["id"])

        assert services.release_expired_drafts() == 1
        assert services.release_expired_drafts() == 0
        product.refresh_from_db()
        assert product.reserved_stock == 0

    def test_checking_out_frees_stock_an_abandoned_draft_was_hiding(
        self, buyer_api, buyer, product, region,
    ):
        """The payoff: the last units are hidden by one customer's abandoned
        basket, and another customer can still buy them — without any cron
        having run."""
        abandoned = self._draft(buyer_api, product, region)
        _age_draft(abandoned["id"])
        # The sweep is throttled to once per window; simulate the next window
        # having arrived so the add-to-cart hook gets its turn.
        cache.delete(services.DRAFT_SWEEP_CACHE_KEY)

        other = User.objects.create_user(phone_number="0915555555", password=PASSWORD)
        other_api = APIClient()
        other_api.post(reverse("auth-login"),
                       {"phone_number": other.phone_number, "password": PASSWORD},
                       format="json")
        other_api.post(reverse("cart"),
                       {"product_id": str(product.id), "quantity": product.stock},
                       format="json")
        response = other_api.post(reverse("cart-checkout"),
                                  {"region_id": region.id, "address": "شارع أخرى"},
                                  format="json")

        assert response.status_code == 201, response.json()
        assert Order.objects.get(id=abandoned["id"]).status == OrderStatus.CANCELLED


class TestStatusTransitions:
    """Phase 7 gate: transitions are enforced server-side."""

    def _order(self, buyer_api, product, region):
        buyer_api.post(reverse("cart"), {"product_id": str(product.id)}, format="json")
        return buyer_api.post(reverse("cart-checkout"),
                              {"region_id": region.id, "address": "شارع"},
                              format="json").json()["data"]

    def test_pending_to_processing_is_allowed(self, admin_api, buyer_api, product, region):
        created = self._order(buyer_api, product, region)
        response = admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                                   {"status": "processing"}, format="json")
        assert response.status_code == 200
        assert Order.objects.get(id=created["id"]).status == OrderStatus.PROCESSING

    def test_pending_cannot_jump_to_completed(self, admin_api, buyer_api, product, region):
        created = self._order(buyer_api, product, region)
        response = admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                                   {"status": "completed"}, format="json")
        assert response.status_code == 409
        assert Order.objects.get(id=created["id"]).status == OrderStatus.PENDING

    def test_cancelled_is_terminal(self, admin_api, buyer_api, product, region):
        created = self._order(buyer_api, product, region)
        admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                        {"status": "cancelled"}, format="json")
        response = admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                                   {"status": "processing"}, format="json")
        assert response.status_code == 409

    def test_cancelling_an_unpaid_order_returns_the_reservation(
        self, admin_api, buyer_api, product, region,
    ):
        created = self._order(buyer_api, product, region)
        product.refresh_from_db()
        assert product.reserved_stock == 1

        admin_api.patch(reverse("order-detail", args=[created["order_number"]]),
                        {"status": "cancelled"}, format="json")

        product.refresh_from_db()
        assert product.reserved_stock == 0
