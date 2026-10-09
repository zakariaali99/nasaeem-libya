"""Admin order editing: lines, destination, totals and stock stay consistent."""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Product, ProductImage
from apps.orders import services
from apps.orders.models import Cart, CartItem, Discount, DiscountType, OrderStatus, ShippingStatus

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner_api(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


@pytest.fixture
def musk(db):
    return Product.objects.create(
        name="مسك أبيض", slug="musk", price=Decimal("100.00"), sku="NL-MUSK",
        track_quantity=True, stock=4,
    )


@pytest.fixture
def order(customer, product, region):
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=product, quantity=2)
    return services.checkout(cart=cart, user=customer, region_id=region.id, address="شارع 1")


def edit_url(order):
    return reverse("admin-order-edit", kwargs={"pk": order.id})


def lines(order):
    return [{"id": str(i.id), "quantity": i.quantity} for i in order.items.all()]


class TestOrderEdit:
    def test_changing_a_quantity_reprices_and_moves_the_reservation(self, owner_api, order, product):
        line = order.items.get()
        product.refresh_from_db()
        assert product.reserved_stock == 2

        response = owner_api.put(
            edit_url(order), {"items": [{"id": str(line.id), "quantity": 3}]}, format="json"
        )

        assert response.status_code == 200, response.json()
        body = response.json()["data"]
        assert body["subtotal"] == "1350.00"
        assert body["shipping_total"] == "5.00"
        assert body["total"] == "1355.00"
        product.refresh_from_db()
        assert product.reserved_stock == 3

    def test_a_kept_line_keeps_the_price_the_customer_was_quoted(self, owner_api, order, product):
        product.price = Decimal("999.00")
        product.save()
        line = order.items.get()

        body = owner_api.put(
            edit_url(order), {"items": [{"id": str(line.id), "quantity": 1}]}, format="json"
        ).json()["data"]

        assert body["subtotal"] == "450.00"

    def test_adding_and_removing_lines(self, owner_api, order, product, musk):
        response = owner_api.put(
            edit_url(order), {"items": [{"product_id": str(musk.id), "quantity": 2}]}, format="json"
        )

        assert response.status_code == 200, response.json()
        body = response.json()["data"]
        assert [(i["product_name"], i["quantity"]) for i in body["items"]] == [("مسك أبيض", 2)]
        assert body["subtotal"] == "200.00"
        product.refresh_from_db()
        musk.refresh_from_db()
        assert product.reserved_stock == 0
        assert musk.reserved_stock == 2

    def test_more_than_the_stock_is_refused_and_nothing_changes(self, owner_api, order, musk):
        response = owner_api.put(
            edit_url(order), {"items": lines(order) + [{"product_id": str(musk.id), "quantity": 5}]},
            format="json",
        )

        assert response.status_code == 409
        assert order.items.count() == 1
        musk.refresh_from_db()
        assert musk.reserved_stock == 0

    def test_a_sized_product_needs_a_size(self, owner_api, order, product, variant):
        product.has_variants = True
        product.save()

        refused = owner_api.put(
            edit_url(order), {"items": [{"product_id": str(product.id), "quantity": 1}]}, format="json"
        )
        accepted = owner_api.put(
            edit_url(order),
            {"items": [{"product_id": str(product.id), "variant_id": str(variant.id), "quantity": 1}]},
            format="json",
        )

        assert refused.status_code == 400
        assert accepted.status_code == 200, accepted.json()
        variant.refresh_from_db()
        assert variant.reserved_stock == 1

    def test_an_empty_order_is_refused(self, owner_api, order):
        response = owner_api.put(edit_url(order), {"items": []}, format="json")
        assert response.status_code == 400

    def test_destination_and_address_change_the_delivery_fee(self, owner_api, order, region_without_fee):
        response = owner_api.put(
            edit_url(order),
            {"items": lines(order), "region_id": region_without_fee.id, "address": "شارع 2",
             "customer_notes": "اتصل قبل الوصول"},
            format="json",
        )

        body = response.json()["data"]
        assert body["shipping_region"] == region_without_fee.id
        assert body["shipping_address"] == "شارع 2"
        assert body["customer_notes"] == "اتصل قبل الوصول"
        assert body["shipping_total"] == "15.00"  # falls back to the city fee

    def test_the_redeemed_discount_is_reapplied_to_the_new_basket(self, owner_api, order):
        order.discount = Discount.objects.create(
            name="10%", code="TEN", type=DiscountType.PERCENTAGE, percentage=Decimal("10")
        )
        order.save()

        body = owner_api.put(
            edit_url(order), {"items": [{"id": str(order.items.get().id), "quantity": 1}]},
            format="json",
        ).json()["data"]

        assert body["discount_total"] == "45.00"
        assert body["total"] == "410.00"  # 450 − 45 + 5

    def test_an_order_with_the_courier_cannot_be_edited(self, owner_api, order):
        order.status = OrderStatus.PROCESSING
        order.shipping_status = ShippingStatus.ACCEPTED
        order.save()

        response = owner_api.put(edit_url(order), {"items": lines(order)}, format="json")

        assert response.status_code == 409

    def test_customers_cannot_edit_orders(self, order, customer):
        client = APIClient()
        client.force_authenticate(user=customer)
        response = client.put(edit_url(order), {"items": lines(order)}, format="json")
        assert response.status_code == 403


class TestOrderPayload:
    def test_the_order_carries_the_customer_the_lead_image_and_editability(
        self, owner_api, order, product, customer
    ):
        ProductImage.objects.create(product=product, url="/media/products/oud-full.webp")

        body = owner_api.get(reverse("order-detail", kwargs={"lookup": order.order_number})).json()["data"]

        assert body["user"] == {"id": str(customer.id), "name": customer.name, "phone_number": customer.phone_number}
        assert body["editable"] is True
        assert body["items"][0]["image"]["renditions"]["thumb"] == "/media/products/oud-thumb.webp"
