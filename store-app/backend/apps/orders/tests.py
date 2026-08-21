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
