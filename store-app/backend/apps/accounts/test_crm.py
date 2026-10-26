"""Plan 8, phase د-8: the customer file.

Segments at their limits, birthdays across the year end, who may do what, the
CSV export and the WhatsApp templates. The orders are created straight on the
model with the (status, shipping_status) pairs `stage_service` writes.
"""

import datetime as dt
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts import crm
from apps.core.models import CustomerInteraction, CustomerTag, Role, StoreSettings, User
from apps.orders.models import Discount, DiscountType, Order, OrderStatus, ShippingStatus

pytestmark = pytest.mark.django_db


def order(user, *, total="100.00", stage="delivered", days_ago=1, city=None, number=None):
    status, shipping = {
        "delivered": (OrderStatus.COMPLETED, ShippingStatus.DELIVERED),
        "new": (OrderStatus.PENDING, ShippingStatus.PENDING),
        "cancelled": (OrderStatus.CANCELLED, ShippingStatus.CANCELLED),
        "returned": (OrderStatus.REFUNDED, ShippingStatus.RETURNED),
    }[stage]
    o = Order.objects.create(
        user=user, order_number=number or f"T{Order.objects.count() + 1:05d}",
        subtotal=Decimal(total), total=Decimal(total), status=status, shipping_status=shipping,
        shipping_address="شارع", finalised_at=timezone.now(), shipping_city=city,
    )
    Order.objects.filter(pk=o.pk).update(created_at=timezone.now() - dt.timedelta(days=days_ago))
    return o


@pytest.fixture
def settings_row(db):
    return StoreSettings.objects.get_or_create(pk=1)[0]


@pytest.fixture
def staff(db):
    return User.objects.create_user(phone_number="0920000001", password="StaffPass9x", name="موظف", role=Role.STAFF)


@pytest.fixture
def manager(db):
    return User.objects.create_user(phone_number="0920000002", password="ManPass9x", name="مشرف", role=Role.MANAGER)


@pytest.fixture
def admin(db):
    return User.objects.create_user(phone_number="0920000003", password="AdmPass9x", name="مدير", role=Role.ADMIN)


def as_(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


def profile(client, user):
    return client.get(reverse("admin-customer-profile", args=[user.id])).json()["data"]


# ---- segments --------------------------------------------------------------

class TestSegments:
    def test_four_orders_is_repeat_and_five_is_vip(self, customer, staff, settings_row):
        for _ in range(4):
            order(customer, total="10.00")
        assert profile(as_(staff), customer)["segment"] == "repeat"
        order(customer, total="10.00")
        data = profile(as_(staff), customer)
        assert data["segment"] == "vip"
        assert data["orders_count"] == 5

    def test_499_is_repeat_and_500_is_vip(self, customer, staff, settings_row):
        order(customer, total="250.00")
        order(customer, total="249.00")
        assert profile(as_(staff), customer)["segment"] == "repeat"
        order(customer, total="1.00")
        data = profile(as_(staff), customer)
        assert data["segment"] == "vip"
        assert data["spend"] == "500.00"

    def test_59_days_is_active_and_61_days_is_inactive(self, customer, staff, settings_row):
        for _ in range(5):
            order(customer, total="200.00", days_ago=59)
        assert profile(as_(staff), customer)["segment"] == "vip"
        Order.objects.filter(user=customer).update(created_at=timezone.now() - dt.timedelta(days=61))
        assert profile(as_(staff), customer)["segment"] == "inactive"

    def test_a_customer_with_no_orders_is_new_not_inactive(self, customer, staff, settings_row):
        data = profile(as_(staff), customer)
        assert data["segment"] == "new"
        assert data["orders_count"] == 0
        assert data["spend"] == "0.00"

    def test_cancelled_is_not_counted_and_returned_counts_but_adds_no_spend(self, customer, staff, settings_row):
        order(customer, total="300.00", stage="cancelled")
        order(customer, total="300.00", stage="returned")
        order(customer, total="100.00", stage="new")
        order(customer, total="50.00", stage="delivered")
        data = profile(as_(staff), customer)
        assert data["orders_count"] == 3
        assert data["spend"] == "50.00"

    def test_limits_come_from_store_settings(self, customer, staff, settings_row):
        settings_row.crm_vip_min_orders = 2
        settings_row.save()
        order(customer, total="5.00")
        order(customer, total="5.00")
        assert profile(as_(staff), customer)["segment"] == "vip"

    def test_a_draft_basket_is_not_an_order(self, customer, staff, settings_row):
        """«Continue to checkout» rows: no address, never finalised."""
        Order.objects.create(user=customer, order_number="DRAFT1", total=Decimal("900"), status=OrderStatus.PENDING)
        assert profile(as_(staff), customer)["orders_count"] == 0

    def test_favourite_city_is_the_most_frequent(self, customer, staff, settings_row, city):
        from apps.core.models import City

        other = City.objects.create(id="benghazi", name="بنغازي", code="BEN")
        order(customer, city=city)
        order(customer, city=other)
        order(customer, city=other)
        assert profile(as_(staff), customer)["favourite_city"] == "بنغازي"


# ---- birthdays -------------------------------------------------------------

class TestBirthdays:
    def test_week_of_29_december_includes_2_january(self, db):
        jan = User.objects.create_user(phone_number="0911111112", password="x", name="يناير", birthday=dt.date(1990, 1, 2))
        User.objects.create_user(phone_number="0911111113", password="x", name="يناير بعيد", birthday=dt.date(1990, 1, 5))
        dec = User.objects.create_user(phone_number="0911111114", password="x", name="ديسمبر", birthday=dt.date(1985, 12, 29))
        rows = crm.birthdays_in_week(User.objects.all(), today=dt.date(2026, 12, 29))
        assert [u.id for u in rows] == [dec.id, jan.id]

    def test_today_badge(self, db):
        today = timezone.localdate()
        u = User.objects.create_user(phone_number="0911111115", password="x", birthday=today.replace(year=1990))
        assert crm.birthday_is_today(u.birthday)
        assert not crm.birthday_is_today(today.replace(year=1990) + dt.timedelta(days=1))

    def test_birthdays_endpoint_lists_customers_only(self, staff, db):
        today = timezone.localdate()
        c = User.objects.create_user(phone_number="0911111116", password="x", name="ع", birthday=today.replace(year=1990))
        staff.birthday = today.replace(year=1980)
        staff.save()
        data = as_(staff).get(reverse("admin-customer-birthdays")).json()["data"]
        assert [r["id"] for r in data] == [str(c.id)]
        assert data[0]["today"] is True

    def test_customer_sets_birthday_from_account(self, customer):
        client = as_(customer)
        res = client.patch(reverse("auth-me"), {"birthday": "1995-06-15"}, format="json")
        assert res.status_code == 200
        assert res.json()["data"]["birthday"] == "1995-06-15"
        future = (timezone.localdate() + dt.timedelta(days=1)).isoformat()
        assert client.patch(reverse("auth-me"), {"birthday": future}, format="json").status_code == 400

    def test_staff_sets_birthday_and_tags(self, customer, staff):
        tag = CustomerTag.objects.create(name="يحب العود", color="#aa5500")
        res = as_(staff).patch(
            reverse("admin-user-detail", args=[customer.id]),
            {"birthday": "1990-03-03", "tags": [str(tag.id)]}, format="json",
        )
        assert res.status_code == 200
        customer.refresh_from_db()
        assert customer.birthday == dt.date(1990, 3, 3)
        assert list(customer.tags.all()) == [tag]


# ---- permissions -----------------------------------------------------------

class TestPermissions:
    def test_a_customer_reaches_nothing(self, customer):
        client = as_(customer)
        assert client.get(reverse("admin-customers")).status_code == 403
        assert client.get(reverse("admin-customer-profile", args=[customer.id])).status_code == 403
        assert client.get(reverse("admin-customers-export")).status_code == 403
        assert client.post(reverse("admin-customer-interactions", args=[customer.id]), {"text": "x"}).status_code == 403

    def test_support_sees_and_writes_but_does_not_export(self, customer, db):
        support = User.objects.create_user(phone_number="0920000009", password="x", role=Role.SUPPORT)
        client = as_(support)
        assert client.get(reverse("admin-customers")).status_code == 200
        res = client.post(reverse("admin-customer-interactions", args=[customer.id]), {"kind": "call", "text": "اتصلت"}, format="json")
        assert res.status_code == 201
        assert client.get(reverse("admin-customers-export")).status_code == 403

    def test_manager_exports(self, manager):
        assert as_(manager).get(reverse("admin-customers-export")).status_code == 200

    def test_only_an_administrator_deletes_a_log_line(self, customer, staff, admin):
        line = CustomerInteraction.objects.create(customer=customer, kind="note", text="ملاحظة", staff=staff)
        url = reverse("admin-customer-interaction-detail", args=[customer.id, line.id])
        assert as_(staff).delete(url).status_code == 403
        assert as_(admin).delete(url).status_code == 204
        assert not CustomerInteraction.objects.filter(pk=line.id).exists()

    def test_log_is_newest_first_and_records_the_staff_member(self, customer, staff):
        client = as_(staff)
        client.post(reverse("admin-customer-interactions", args=[customer.id]), {"kind": "call", "text": "الأولى"}, format="json")
        client.post(reverse("admin-customer-interactions", args=[customer.id]), {"kind": "note", "text": "الثانية"}, format="json")
        rows = profile(client, customer)["interactions"]
        assert [r["text"] for r in rows] == ["الثانية", "الأولى"]
        assert rows[0]["staff_name"] == "موظف"
        assert rows[0]["kind_label"] == "ملاحظة"


# ---- list, filters, export -------------------------------------------------

class TestListAndExport:
    def test_list_filters_by_segment_tag_and_city_and_sorts_by_spend(self, staff, settings_row, city):
        tag = CustomerTag.objects.create(name="جملة", color="#112233")
        a = User.objects.create_user(phone_number="0911111121", password="x", name="أ")
        b = User.objects.create_user(phone_number="0911111122", password="x", name="ب")
        a.tags.add(tag)
        order(a, total="600.00", city=city)
        order(b, total="20.00")
        order(b, total="20.00")
        client = as_(staff)
        rows = client.get(reverse("admin-customers"), {"segment": "vip"}).json()["data"]
        assert [r["name"] for r in rows] == ["أ"]
        rows = client.get(reverse("admin-customers"), {"tag": str(tag.id)}).json()["data"]
        assert [r["name"] for r in rows] == ["أ"]
        rows = client.get(reverse("admin-customers"), {"city": city.id}).json()["data"]
        assert [r["name"] for r in rows] == ["أ"]
        assert rows[0]["city"] == "طرابلس"
        rows = client.get(reverse("admin-customers"), {"ordering": "-spend", "role": "customer"}).json()["data"]
        assert [r["name"] for r in rows][:2] == ["أ", "ب"]
        rows = client.get(reverse("admin-customers"), {"ordering": "-orders", "role": "customer"}).json()["data"]
        assert [r["name"] for r in rows][:2] == ["ب", "أ"]

    def test_export_is_utf8_with_bom_and_respects_the_filter(self, manager, settings_row):
        tag = CustomerTag.objects.create(name="هدايا", color="#112233")
        a = User.objects.create_user(phone_number="0911111131", password="x", name="سالم", birthday=dt.date(1990, 5, 5))
        User.objects.create_user(phone_number="0911111132", password="x", name="غير مطلوب")
        a.tags.add(tag)
        order(a, total="120.50")
        res = as_(manager).get(reverse("admin-customers-export"), {"tag": str(tag.id)})
        assert res.status_code == 200
        assert res["Content-Type"].startswith("text/csv")
        raw = res.content
        assert raw.startswith("﻿".encode("utf-8"))
        lines = raw.decode("utf-8-sig").splitlines()
        assert lines[0].split(",") == crm.CSV_HEADERS
        assert len(lines) == 2
        assert lines[1].startswith("سالم,0911111131,")
        assert ",هدايا,1,120.50," in lines[1]
        assert lines[1].endswith("1990-05-05")
        assert "غير مطلوب" not in res.content.decode("utf-8-sig")


# ---- WhatsApp --------------------------------------------------------------

class TestWhatsApp:
    def test_number_is_in_218_form(self):
        assert crm.whatsapp_number("0912345678") == "218912345678"
        assert crm.whatsapp_number("+218 91 234 5678") == "218912345678"
        assert crm.whatsapp_number("00218912345678") == "218912345678"
        assert crm.whatsapp_number("912345678") == "218912345678"

    def test_variables_are_replaced_and_the_message_is_logged(self, customer, staff, settings_row):
        settings_row.store_name = "نسائم"
        settings_row.texts = {"crm.whatsapp.followup": "يا {الاسم} طلبك {رقم_الطلب} من {المتجر}"}
        settings_row.save()
        o = order(customer, number="202610MAN0001")
        res = as_(staff).post(
            reverse("admin-customer-whatsapp", args=[customer.id]),
            {"template": "followup", "order": str(o.id)}, format="json",
        )
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["text"] == "يا عميل طلبك 202610MAN0001 من نسائم"
        assert data["url"].startswith("https://wa.me/218911111111?text=")
        line = CustomerInteraction.objects.get(customer=customer)
        assert line.kind == "whatsapp"
        assert line.text == "واتساب: متابعة بعد الشراء"
        assert line.staff == staff

    def test_default_wording_is_used_when_nothing_is_stored(self, customer, staff, settings_row):
        data = profile(as_(staff), customer)
        texts = {t["key"]: t["text"] for t in data["templates"]}
        assert texts["birthday"] == crm.TEMPLATE_DEFAULTS["birthday"]

    def test_an_expired_coupon_is_neither_listed_nor_accepted(self, customer, staff, settings_row):
        now = timezone.now()
        Discount.objects.create(code="LIVE10", name="حي", type=DiscountType.PERCENTAGE, percentage=10, is_active=True)
        Discount.objects.create(
            code="OLD10", name="منتهي", type=DiscountType.PERCENTAGE, percentage=10, is_active=True,
            end_date=now - dt.timedelta(days=1),
        )
        Discount.objects.create(code="OFF10", name="موقوف", type=DiscountType.PERCENTAGE, percentage=10, is_active=False)
        Discount.objects.create(
            code="FULL", name="مستهلك", type=DiscountType.FIXED, value=5, is_active=True, usage_limit=1, usage_count=1,
        )
        client = as_(staff)
        assert [c["code"] for c in profile(client, customer)["coupons"]] == ["LIVE10"]
        url = reverse("admin-customer-whatsapp", args=[customer.id])
        assert client.post(url, {"template": "vip", "coupon": "OLD10"}, format="json").status_code == 400
        res = client.post(url, {"template": "vip", "coupon": "LIVE10"}, format="json")
        assert res.status_code == 200
        assert "LIVE10" in res.json()["data"]["text"]
        assert CustomerInteraction.objects.filter(customer=customer).count() == 1

    def test_unknown_template_is_refused(self, customer, staff):
        res = as_(staff).post(reverse("admin-customer-whatsapp", args=[customer.id]), {"template": "x"}, format="json")
        assert res.status_code == 400
