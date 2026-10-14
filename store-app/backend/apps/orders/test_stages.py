"""Order stages: any stage can move to any other, and stock and money follow
the difference — going away and coming back leaves everything as it was."""

from decimal import Decimal
from itertools import permutations

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Product
from apps.orders import services
from apps.orders.models import Cart, CartItem, OrderStage, OrderStageEvent, StockState
from apps.orders.stage_service import STAGE_FIELDS, StageError, change_stage, stage_of
from apps.payments.models import LedgerTransaction, Payment

pytestmark = pytest.mark.django_db

STAGES = list(STAGE_FIELDS)


@pytest.fixture
def owner_api(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


def place(customer, product, region, *, quantity=2, payment_method="cash_on_delivery"):
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=product, quantity=quantity)
    return services.checkout(cart=cart, user=customer, region_id=region.id,
                             address="شارع 1", payment_method=payment_method)


def shelf(product):
    product.refresh_from_db()
    return product.stock, product.reserved_stock


def revenue_balance():
    """Net sales booked in the ledger for all orders."""
    total = Decimal("0")
    for txn in LedgerTransaction.objects.filter(reference_type__in=["ORDER_SALE", "ORDER_SALE_REVERSAL"]):
        for entry in txn.entries.filter(account__code="4010_SALES_REVENUE"):
            total += entry.amount if entry.entry_type == "credit" else -entry.amount
    return total


class TestStockFollowsTheStage:
    def test_a_new_order_holds_a_reservation(self, customer, product, region):
        order = place(customer, product, region)
        assert stage_of(order) == OrderStage.NEW
        assert order.stock_state == StockState.RESERVED
        assert shelf(product) == (10, 2)

    def test_out_for_delivery_takes_the_units_off_the_shelf(self, customer, product, region, owner):
        order = place(customer, product, region)
        change_stage(order, OrderStage.OUT_FOR_DELIVERY, by=owner)
        assert shelf(product) == (8, 0)

    def test_cancelled_after_delivery_puts_them_back_and_delivered_again_takes_them(
        self, customer, product, region, owner
    ):
        order = place(customer, product, region)
        change_stage(order, OrderStage.DELIVERED, by=owner)
        assert shelf(product) == (8, 0)
        change_stage(order, OrderStage.CANCELLED, by=owner, note="المندوب أخطأ")
        assert shelf(product) == (10, 0)
        change_stage(order, OrderStage.DELIVERED, by=owner, note="العميل استلم فعلاً")
        assert shelf(product) == (8, 0)

    def test_damaged_returns_do_not_go_back_on_the_shelf(self, customer, product, region, owner):
        order = place(customer, product, region)
        change_stage(order, OrderStage.DELIVERED, by=owner)
        line = order.items.get()
        change_stage(order, OrderStage.RETURNED, by=owner, damaged_item_ids=[str(line.id)])
        assert shelf(product) == (8, 0)

    def test_reviving_a_cancelled_order_without_stock_is_refused_unless_confirmed(
        self, customer, product, region, owner
    ):
        order = place(customer, product, region, quantity=2)
        change_stage(order, OrderStage.CANCELLED, by=owner)
        Product.objects.filter(pk=product.pk).update(stock=1)

        with pytest.raises(StageError) as err:
            change_stage(order, OrderStage.PREPARING, by=owner)
        assert err.value.code == "insufficient_stock"
        assert shelf(product) == (1, 0)

        change_stage(order, OrderStage.PREPARING, by=owner, allow_short=True)
        assert shelf(product) == (1, 2)

    @pytest.mark.parametrize("start,target", list(permutations(STAGES, 2)))
    def test_every_pair_round_trips(self, customer, product, region, owner, start, target):
        """Go start → target → start: stock and booked revenue end where they began."""
        order = place(customer, product, region)
        if start != OrderStage.NEW:
            change_stage(order, start, by=owner)
        before = (shelf(product), revenue_balance())

        change_stage(order, target, by=owner)
        assert stage_of(order.__class__.objects.get(pk=order.pk)) == target
        change_stage(order, start, by=owner)

        assert (shelf(product), revenue_balance()) == before

    def test_dry_run_changes_nothing(self, customer, product, region, owner):
        order = place(customer, product, region)
        result = change_stage(order, OrderStage.DELIVERED, by=owner, dry_run=True)
        assert not result.applied
        assert {e["kind"] for e in result.effects} == {"stock_out", "sale_booked"}
        assert shelf(product) == (10, 2)
        assert stage_of(order.__class__.objects.get(pk=order.pk)) == OrderStage.NEW
        assert not OrderStageEvent.objects.exists()


class TestMoney:
    def test_pay_on_delivery_is_booked_once_and_reversed_when_it_leaves_delivered(
        self, customer, product, region, owner
    ):
        order = place(customer, product, region)
        change_stage(order, OrderStage.DELIVERED, by=owner)
        assert revenue_balance() == order.total
        assert Payment.objects.get(order=order).status == "completed"

        change_stage(order, OrderStage.RETURNED, by=owner)
        assert revenue_balance() == 0
        assert Payment.objects.get(order=order).status == "cancelled"

    def test_an_online_paid_order_is_not_booked_by_a_stage_change(self, customer, product, region, owner):
        order = place(customer, product, region, payment_method="tlync")
        change_stage(order, OrderStage.DELIVERED, by=owner)
        assert revenue_balance() == 0


class TestHistoryAndApi:
    def test_every_change_is_recorded(self, customer, product, region, owner):
        order = place(customer, product, region)
        change_stage(order, OrderStage.CANCELLED, by=owner, note="العميل ألغى")
        event = OrderStageEvent.objects.get(order=order)
        assert (event.from_stage, event.to_stage, event.note, event.changed_by) == (
            "new", "cancelled", "العميل ألغى", owner
        )

    def test_stage_endpoint_moves_and_previews(self, owner_api, customer, product, region):
        order = place(customer, product, region)
        url = reverse("admin-order-stage", kwargs={"pk": order.id})

        preview = owner_api.post(url, {"stage": "cancelled", "dry_run": True}, format="json")
        assert preview.status_code == 200
        assert preview.json()["data"]["backward"] is True

        moved = owner_api.post(url, {"stage": "delivered"}, format="json")
        assert moved.status_code == 200, moved.json()
        body = moved.json()["data"]
        assert body["stage"] == "delivered"
        assert body["stage_events"][0]["to_stage"] == "delivered"

    def test_old_patch_still_works_and_cancelled_is_no_longer_final(self, owner_api, customer, product, region):
        order = place(customer, product, region)
        url = reverse("order-detail", kwargs={"lookup": order.order_number})
        assert owner_api.patch(url, {"status": "cancelled"}, format="json").status_code == 200
        response = owner_api.patch(url, {"status": "completed", "shipping_status": "delivered"}, format="json")
        assert response.status_code == 200, response.json()
        assert response.json()["data"]["stage"] == "delivered"
        assert shelf(product) == (8, 0)

    def test_customers_never_see_admin_notes_or_history(self, customer, product, region):
        order = place(customer, product, region)
        order.admin_notes = "عميل صعب"
        order.save()
        client = APIClient()
        client.force_authenticate(user=customer)
        body = client.get(reverse("order-detail", kwargs={"lookup": order.order_number})).json()["data"]
        assert body["admin_notes"] is None and body["stage_events"] is None
        assert body["stage_label"] == "جديد"

    def test_bulk_cancel_releases_stock(self, owner_api, customer, product, region):
        first = place(customer, product, region, quantity=1)
        second = place(customer, product, region, quantity=1)
        assert shelf(product) == (10, 2)
        response = owner_api.post(
            reverse("admin-bulk-order-action"),
            {"order_ids": [str(first.id), str(second.id)], "action": "cancelled"},
            format="json",
        )
        assert response.status_code == 200
        assert response.json()["data"]["updated_count"] == 2
        assert shelf(product) == (10, 0)

    def test_stage_filter_and_counts(self, owner_api, customer, product, region, owner):
        first = place(customer, product, region, quantity=1)
        place(customer, product, region, quantity=1)
        change_stage(first, OrderStage.OUT_FOR_DELIVERY, by=owner)

        counts = owner_api.get(reverse("admin-order-stage-counts")).json()["data"]
        assert counts["new"] == 1 and counts["out_for_delivery"] == 1 and counts["all"] == 2

        listed = owner_api.get(reverse("order-list"), {"stage": "out_for_delivery"}).json()["data"]
        assert [o["id"] for o in listed] == [str(first.id)]
