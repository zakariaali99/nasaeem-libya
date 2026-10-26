"""Tests for Plan 08 CRM Customer Profile & Management (د-1 to د-8)."""

from datetime import date, timedelta
from decimal import Decimal
import io
import pytest

from django.utils import timezone
from rest_framework.test import APIClient

from apps.core.models import CustomerInteraction, CustomerTag, Role, StoreSettings, User
from apps.orders.models import Order, OrderStatus, ShippingStatus

from . import crm


def placed_order(user, number, total, status, shipping_status, city=None):
    """An order the customer actually confirmed: it has an address and a
    confirmation time, so `Order.objects.placed()` counts it."""
    return Order.objects.create(
        user=user, order_number=number, total=Decimal(total), subtotal=Decimal(total),
        status=status, shipping_status=shipping_status,
        shipping_address="شارع", finalised_at=timezone.now(), shipping_city=city,
    )


@pytest.fixture
def manager(db):
    user = User.objects.create(
        phone_number="0911111111",
        name="مدير المتجر",
        role=Role.MANAGER,
        is_staff=True,
    )
    user.set_password("pass123456")
    user.save()
    return user


@pytest.fixture
def support(db):
    user = User.objects.create(
        phone_number="0912222222",
        name="موظف دعم",
        role=Role.SUPPORT,
        is_staff=True,
    )
    user.set_password("pass123456")
    user.save()
    return user


@pytest.fixture
def customer(db):
    user = User.objects.create(
        phone_number="0913333333",
        name="علي التاجوري",
        role=Role.CUSTOMER,
        birthday=date(1995, 7, 15),
    )
    return user


@pytest.mark.django_db
class TestCustomerTierClassification:
    def test_new_customer_with_no_or_one_order(self):
        thresholds = {"vip_min_orders": 5, "vip_min_spend": Decimal("500.00"), "inactive_days": 60}
        now = timezone.now()

        # 0 orders
        tier = crm.determine_customer_tier(0, Decimal("0.00"), None, thresholds, now=now)
        assert tier == "new"

        # 1 order under 500 LYD
        tier = crm.determine_customer_tier(1, Decimal("150.00"), now - timedelta(days=5), thresholds, now=now)
        assert tier == "new"

    def test_repeat_customer_with_2_to_4_orders_under_vip_spend(self):
        thresholds = {"vip_min_orders": 5, "vip_min_spend": Decimal("500.00"), "inactive_days": 60}
        now = timezone.now()

        tier = crm.determine_customer_tier(2, Decimal("300.00"), now - timedelta(days=10), thresholds, now=now)
        assert tier == "repeat"

        tier = crm.determine_customer_tier(4, Decimal("499.00"), now - timedelta(days=2), thresholds, now=now)
        assert tier == "repeat"

    def test_vip_customer_by_spend_or_orders(self):
        thresholds = {"vip_min_orders": 5, "vip_min_spend": Decimal("500.00"), "inactive_days": 60}
        now = timezone.now()

        # VIP by spend (1 order of 500 LYD)
        tier = crm.determine_customer_tier(1, Decimal("500.00"), now - timedelta(days=5), thresholds, now=now)
        assert tier == "vip"

        # VIP by orders (5 orders of 200 LYD)
        tier = crm.determine_customer_tier(5, Decimal("200.00"), now - timedelta(days=5), thresholds, now=now)
        assert tier == "vip"

    def test_inactive_customer_priority_over_vip_and_repeat(self):
        thresholds = {"vip_min_orders": 5, "vip_min_spend": Decimal("500.00"), "inactive_days": 60}
        now = timezone.now()

        # 59 days ago: still VIP
        tier_59 = crm.determine_customer_tier(10, Decimal("2000.00"), now - timedelta(days=59), thresholds, now=now)
        assert tier_59 == "vip"

        # 61 days ago: becomes inactive
        tier_61 = crm.determine_customer_tier(10, Decimal("2000.00"), now - timedelta(days=61), thresholds, now=now)
        assert tier_61 == "inactive"

    def test_spend_counts_delivered_orders_only(self, customer):
        # 1 Delivered order (200 LYD)
        placed_order(customer, "ORD-101", "200.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED)
        # 1 Cancelled order (500 LYD) -> should be excluded entirely
        placed_order(customer, "ORD-102", "500.00", OrderStatus.CANCELLED, ShippingStatus.CANCELLED)
        # 1 Pending order (150 LYD) -> counts toward total orders, but NOT lifetime spend
        placed_order(customer, "ORD-103", "150.00", OrderStatus.PENDING, ShippingStatus.PENDING)
        # A basket that reached «Continue to checkout» and was abandoned: no
        # address, never confirmed. Not an order (OrderQuerySet.placed).
        Order.objects.create(user=customer, order_number="DRAFT-1", status=OrderStatus.PENDING, total=Decimal("900.00"))
        # Handed to the courier, not yet confirmed delivered: not spend yet.
        placed_order(customer, "ORD-104", "70.00", OrderStatus.PROCESSING, ShippingStatus.DELIVERED)

        metrics = crm.compute_customer_metrics(customer)
        assert metrics["total_orders"] == 3  # ORD-101, ORD-103, ORD-104
        assert Decimal(metrics["lifetime_spend"]) == Decimal("200.00")
        assert metrics["delivered_orders_count"] == 1
        assert Decimal(metrics["average_order_value"]) == Decimal("200.00")
        assert metrics["tier"] == "repeat"

    def test_the_list_agrees_with_the_dossier_and_a_city_filter_does_not_double_spend(self, manager, customer, city):
        """The list's annotations and the dossier's figures are the same
        numbers; a join on addresses (the city filter) must not multiply them."""
        from apps.core.models import UserAddress

        UserAddress.objects.create(user=customer, city=city, address="أ")
        UserAddress.objects.create(user=customer, city=city, address="ب")
        placed_order(customer, "ORD-201", "100.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED, city=city)
        placed_order(customer, "ORD-202", "100.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED, city=city)
        client = APIClient()
        client.force_authenticate(user=manager)
        for params in ({}, {"city_id": city.id}, {"tier": "repeat"}):
            rows = client.get("/api/admin/users/", {"role": "customer", **params}).json()["data"]
            row = next(r for r in rows if r["id"] == str(customer.id))
            assert row["crm"]["total_orders"] == 2, params
            assert Decimal(row["crm"]["lifetime_spend"]) == Decimal("200.00"), params

    def test_limits_through_the_endpoint(self, manager, customer):
        """4 orders → repeat, 5 → VIP; 499 → repeat, 500 → VIP (د-8)."""
        client = APIClient()
        client.force_authenticate(user=manager)

        def tier():
            return client.get(f"/api/admin/users/{customer.id}/crm/").json()["data"]["crm"]["tier"]

        for i in range(4):
            placed_order(customer, f"ORD-3{i}", "10.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED)
        assert tier() == "repeat"
        placed_order(customer, "ORD-35", "10.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED)
        assert tier() == "vip"
        Order.objects.filter(user=customer).delete()
        placed_order(customer, "ORD-36", "250.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED)
        placed_order(customer, "ORD-37", "249.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED)
        assert tier() == "repeat"
        placed_order(customer, "ORD-38", "1.00", OrderStatus.COMPLETED, ShippingStatus.DELIVERED)
        assert tier() == "vip"


@pytest.mark.django_db
class TestUpcomingBirthdays:
    def test_birthdays_within_coming_week_and_year_wraparound(self):
        # User born on Dec 30
        u1 = User.objects.create(
            phone_number="0914444444",
            name="سالم",
            birthday=date(1990, 12, 30),
            role=Role.CUSTOMER,
        )
        # User born on Jan 2
        u2 = User.objects.create(
            phone_number="0915555555",
            name="فاطمة",
            birthday=date(1998, 1, 2),
            role=Role.CUSTOMER,
        )
        # User born in June (not upcoming in Dec)
        u3 = User.objects.create(
            phone_number="0916666666",
            name="عمر",
            birthday=date(1992, 6, 15),
            role=Role.CUSTOMER,
        )

        # Reference date Dec 29
        ref_today = date(2026, 12, 29)
        upcoming = crm.get_upcoming_birthdays_this_week(today=ref_today)
        names = [item["name"] for item in upcoming]
        assert "سالم" in names  # Dec 30 is day +1
        assert "فاطمة" in names  # Jan 2 is day +4 (cross-year!)
        assert "عمر" not in names


@pytest.mark.django_db
class TestCRMAdminAPI:
    def test_customer_dossier_endpoint(self, manager, customer):
        client = APIClient()
        client.force_authenticate(user=manager)

        resp = client.get(f"/api/admin/users/{customer.id}/crm/")
        assert resp.status_code == 200
        data = resp.json()["data"]
        assert data["user"]["phone_number"] == customer.phone_number
        assert "crm" in data
        assert "recent_orders" in data
        assert "interactions" in data

    def test_tags_creation_and_assignment(self, manager, customer):
        client = APIClient()
        client.force_authenticate(user=manager)

        # Create tag
        create_resp = client.post("/api/admin/customer-tags/", {"name": "تاجر جملة", "color": "#10b981"})
        assert create_resp.status_code == 201
        tag_id = create_resp.json()["data"]["id"]

        # Assign tag to customer
        assign_resp = client.post(f"/api/admin/users/{customer.id}/tags/", {"tag_id": tag_id, "action": "add"})
        assert assign_resp.status_code == 200
        customer.refresh_from_db()
        assert customer.tags.filter(id=tag_id).exists()

        # Remove tag
        remove_resp = client.post(f"/api/admin/users/{customer.id}/tags/", {"tag_id": tag_id, "action": "remove"})
        assert remove_resp.status_code == 200
        customer.refresh_from_db()
        assert not customer.tags.filter(id=tag_id).exists()

    def test_interactions_log_and_delete_permissions(self, manager, support, customer):
        client_support = APIClient()
        client_support.force_authenticate(user=support)

        # Support can log an interaction
        log_resp = client_support.post(
            f"/api/admin/users/{customer.id}/interactions/",
            {"interaction_type": "call", "notes": "العميل يستفسر عن وصول عطر أفنان سوبريم"},
        )
        assert log_resp.status_code == 201
        interaction_id = log_resp.json()["data"]["id"]

        # Nobody but an administrator deletes a line (د-3): support and the
        # manager are refused, the administrator succeeds.
        del_resp_support = client_support.delete(f"/api/admin/interactions/{interaction_id}/")
        assert del_resp_support.status_code == 403
        client_mgr = APIClient()
        client_mgr.force_authenticate(user=manager)
        assert client_mgr.delete(f"/api/admin/interactions/{interaction_id}/").status_code == 403

        admin = User.objects.create(phone_number="0917777777", name="مدير", role=Role.ADMIN, is_staff=True)
        client_admin = APIClient()
        client_admin.force_authenticate(user=admin)
        assert client_admin.delete(f"/api/admin/interactions/{interaction_id}/").status_code == 204
        assert not CustomerInteraction.objects.filter(id=interaction_id).exists()

    def test_templates_come_from_store_texts_and_dead_coupons_are_hidden(self, manager, customer):
        """د-4: the wording is the operator's, with the variables; a coupon
        that is expired, switched off or used up is not offered."""
        from apps.orders.models import Discount, DiscountType

        settings_row, _ = StoreSettings.objects.get_or_create(pk=1)
        settings_row.store_name = "نسائم"
        settings_row.texts = {"crm.whatsapp.vip": "يا {الاسم} كودك {الكوبون} من {المتجر}"}
        settings_row.save()
        now = timezone.now()
        Discount.objects.create(code="LIVE10", name="حي", type=DiscountType.PERCENTAGE, percentage=10, is_active=True)
        Discount.objects.create(code="OLD10", name="منتهي", type=DiscountType.PERCENTAGE, percentage=10, is_active=True,
                                end_date=now - timedelta(days=1))
        Discount.objects.create(code="OFF10", name="موقوف", type=DiscountType.PERCENTAGE, percentage=10, is_active=False)
        Discount.objects.create(code="FULL", name="مستهلك", type=DiscountType.FIXED, value=5, is_active=True,
                                usage_limit=1, usage_count=1)

        client = APIClient()
        client.force_authenticate(user=manager)
        data = client.get(f"/api/admin/users/{customer.id}/crm/").json()["data"]
        assert [c["code"] for c in data["active_coupons"]] == ["LIVE10"]
        templates = {t["key"]: t["text"] for t in data["whatsapp_templates"]}
        assert templates["vip_offer"] == "يا {الاسم} كودك {الكوبون} من {المتجر}"
        assert templates["birthday"] == crm.TEMPLATE_DEFAULTS["birthday"]
        assert data["store_name"] == "نسائم"
        assert crm.render_template(templates["vip_offer"], name="علي", store="نسائم", coupon="LIVE10") == "يا علي كودك LIVE10 من نسائم"

    def test_csv_export_permissions_and_bom(self, manager, support, customer):
        # Support CANNOT export (Decision 3: manager, admin, owner only)
        client_support = APIClient()
        client_support.force_authenticate(user=support)
        resp_support = client_support.get("/api/admin/users/export/")
        assert resp_support.status_code == 403

        # Manager CAN export
        client_mgr = APIClient()
        client_mgr.force_authenticate(user=manager)
        resp_mgr = client_mgr.get("/api/admin/users/export/")
        assert resp_mgr.status_code == 200
        assert resp_mgr["Content-Type"].startswith("text/csv")
        content = resp_mgr.content
        # Must start with UTF-8 BOM
        assert content.startswith(b"\xef\xbb\xbf")
        text = content.decode("utf-8")
        assert "علي التاجوري" in text
        assert "0913333333" in text
        assert "الاسم" in text
        assert "إجمالي الإنفاق" in text

    def test_whatsapp_phone_formatting(self):
        assert crm.format_whatsapp_phone("0912345678") == "218912345678"
        assert crm.format_whatsapp_phone("912345678") == "218912345678"
        assert crm.format_whatsapp_phone("+218912345678") == "218912345678"
