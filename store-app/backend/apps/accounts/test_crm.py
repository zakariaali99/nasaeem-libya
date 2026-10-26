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
        Order.objects.create(
            user=customer,
            order_number="ORD-101",
            status=OrderStatus.COMPLETED,
            shipping_status=ShippingStatus.DELIVERED,
            total=Decimal("200.00"),
        )
        # 1 Cancelled order (500 LYD) -> should be excluded entirely
        Order.objects.create(
            user=customer,
            order_number="ORD-102",
            status=OrderStatus.CANCELLED,
            shipping_status=ShippingStatus.CANCELLED,
            total=Decimal("500.00"),
        )
        # 1 Pending order (150 LYD) -> counts toward total orders, but NOT lifetime spend
        Order.objects.create(
            user=customer,
            order_number="ORD-103",
            status=OrderStatus.PENDING,
            shipping_status=ShippingStatus.PENDING,
            total=Decimal("150.00"),
        )

        metrics = crm.compute_customer_metrics(customer)
        assert metrics["total_orders"] == 2  # ORD-101 and ORD-103
        assert Decimal(metrics["lifetime_spend"]) == Decimal("200.00")
        assert metrics["delivered_orders_count"] == 1
        assert Decimal(metrics["average_order_value"]) == Decimal("200.00")
        assert metrics["tier"] == "repeat"


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

        # Support CANNOT delete an interaction (Decision 3 & d-3: manager/admin/owner only)
        del_resp_support = client_support.delete(f"/api/admin/interactions/{interaction_id}/")
        assert del_resp_support.status_code == 403

        # Manager CAN delete an interaction
        client_mgr = APIClient()
        client_mgr.force_authenticate(user=manager)
        del_resp_mgr = client_mgr.delete(f"/api/admin/interactions/{interaction_id}/")
        assert del_resp_mgr.status_code == 204
        assert not CustomerInteraction.objects.filter(id=interaction_id).exists()

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
