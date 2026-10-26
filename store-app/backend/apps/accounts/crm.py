"""The customer file (plan 8, phase د): numbers, segment, birthdays and the
ready WhatsApp messages, in one place.

Nothing here is stored. Every figure is computed from the orders when it is
shown, so it can never drift the way the old `lifetime_spend` / `vip_tier`
counters did. The aggregation is plain `Count` / `Sum` / `Max` subqueries that
run the same on the live host's SQLite and on Postgres.
"""

from __future__ import annotations

import csv
import datetime as dt
from decimal import Decimal
from io import StringIO

from django.db.models import (
    Count, DateTimeField, DecimalField, F, IntegerField, Max, OuterRef, Q, Subquery, Sum,
)
from django.db.models.functions import Coalesce
from django.utils import timezone

from apps.core.models import StoreSettings, User
from apps.orders.models import Discount, Order, OrderStatus
from apps.orders.stage_service import stage_of

# ---- segments --------------------------------------------------------------

SEGMENT_INACTIVE = "inactive"
SEGMENT_VIP = "vip"
SEGMENT_REPEAT = "repeat"
SEGMENT_NEW = "new"

SEGMENT_LABELS = {
    SEGMENT_INACTIVE: "خامل",
    SEGMENT_VIP: "VIP",
    SEGMENT_REPEAT: "متكرر",
    SEGMENT_NEW: "جديد",
}


def segment_of(orders_count: int, spend: Decimal, last_order_at, settings: StoreSettings, now=None) -> str:
    """First rule that applies wins: inactive, then VIP, then repeat, then new.

    A customer with five orders who has not ordered in two months is inactive,
    not VIP — the point of the label is who to call."""
    now = now or timezone.now()
    if orders_count and last_order_at and (now - last_order_at).days > settings.crm_inactive_days:
        return SEGMENT_INACTIVE
    if orders_count >= settings.crm_vip_min_orders or (spend or 0) >= settings.crm_vip_min_spend:
        return SEGMENT_VIP
    if orders_count >= 2:
        return SEGMENT_REPEAT
    return SEGMENT_NEW


# ---- numbers ---------------------------------------------------------------

def counted_orders():
    """The orders that count: placed and not cancelled (decision 2)."""
    return Order.objects.placed().exclude(status=OrderStatus.CANCELLED)


def delivered_orders():
    """The orders whose money counts as spend: delivered ones only."""
    return Order.objects.placed().filter(status=OrderStatus.COMPLETED)


def _per_customer(qs, aggregate):
    return Subquery(
        qs.filter(user=OuterRef("pk")).order_by().values("user").annotate(v=aggregate).values("v")[:1]
    )


def annotate_numbers(users):
    """`orders_count`, `spend`, `last_order_at` on every row, in one query."""
    return users.annotate(
        orders_count=Coalesce(
            _per_customer(counted_orders(), Count("id")), 0, output_field=IntegerField()
        ),
        spend=Coalesce(
            _per_customer(delivered_orders(), Sum("total")), Decimal("0"),
            output_field=DecimalField(max_digits=12, decimal_places=2),
        ),
        last_order_at=Subquery(
            counted_orders().filter(user=OuterRef("pk")).order_by().values("user")
            .annotate(v=Max("created_at")).values("v")[:1],
            output_field=DateTimeField(),
        ),
        last_city=Subquery(
            counted_orders().filter(user=OuterRef("pk"), shipping_city__isnull=False)
            .order_by("-created_at").values("shipping_city__name")[:1]
        ),
    )


def favourite_city(user: User) -> str:
    """The city that appears most often on the customer's orders."""
    row = (
        counted_orders().filter(user=user, shipping_city__isnull=False)
        .values("shipping_city__name").annotate(n=Count("id")).order_by("-n", "shipping_city__name").first()
    )
    return row["shipping_city__name"] if row else ""


def average_order(spend, orders_count) -> Decimal:
    if not orders_count:
        return Decimal("0.00")
    return (Decimal(spend or 0) / orders_count).quantize(Decimal("0.01"))


# ---- birthdays -------------------------------------------------------------

def birthday_is_today(birthday: dt.date | None, today: dt.date | None = None) -> bool:
    today = today or timezone.localdate()
    if not birthday:
        return False
    if birthday.month == 2 and birthday.day == 29 and not _leap(today.year):
        return today.month == 3 and today.day == 1
    return (birthday.month, birthday.day) == (today.month, today.day)


def _leap(year: int) -> bool:
    return year % 4 == 0 and (year % 100 != 0 or year % 400 == 0)


def birthdays_in_week(users, today: dt.date | None = None):
    """Customers whose birthday falls in the next seven days, today included.
    Works across the year end: the week of 29 December includes 2 January."""
    today = today or timezone.localdate()
    days = [today + dt.timedelta(days=i) for i in range(7)]
    wanted = {(d.month, d.day) for d in days}
    # 29 February is celebrated on 1 March in a common year.
    if any(d.month == 3 and d.day == 1 for d in days) and not _leap(today.year):
        wanted.add((2, 29))
    months = {m for m, _ in wanted}
    rows = []
    for user in users.filter(birthday__isnull=False, birthday__month__in=months):
        key = (user.birthday.month, user.birthday.day)
        if key in wanted:
            rows.append(user)
    # Soonest first.
    def days_until(u):
        for i, d in enumerate(days):
            if (u.birthday.month, u.birthday.day) == (d.month, d.day):
                return i
            if u.birthday.month == 2 and u.birthday.day == 29 and (d.month, d.day) == (3, 1):
                return i
        return 7
    rows.sort(key=days_until)
    return rows


# ---- WhatsApp templates ----------------------------------------------------

TEMPLATE_KEYS = {
    "followup": "crm.whatsapp.followup",
    "vip": "crm.whatsapp.vip",
    "birthday": "crm.whatsapp.birthday",
}

TEMPLATE_LABELS = {
    "followup": "متابعة بعد الشراء",
    "vip": "عرض VIP",
    "birthday": "تهنئة عيد ميلاد",
}

# The built-in wording; the operator's own is stored in StoreSettings.texts
# under the keys above (edited from «نصوص المتجر»). Kept in step with
# `frontend/src/lib/siteText.ts`.
TEMPLATE_DEFAULTS = {
    "followup": "مرحباً {الاسم}، شكراً لطلبك رقم {رقم_الطلب} من {المتجر}. نتمنى أن يكون قد أعجبك، ويسعدنا رأيك أو أي ملاحظة.",
    "vip": "مرحباً {الاسم}، أنت من عملاء {المتجر} المميزين. لك خصم خاص بالكود {الكوبون} على طلبك القادم.",
    "birthday": "كل عام وأنت بخير {الاسم}! هديتنا لك من {المتجر} بمناسبة عيد ميلادك: كود خصم {الكوبون}.",
}


def whatsapp_number(phone: str) -> str:
    """`09XXXXXXXX` → `2189XXXXXXXX`, the form wa.me expects."""
    digits = "".join(ch for ch in (phone or "") if ch.isdigit())
    if digits.startswith("00218"):
        digits = digits[2:]
    if digits.startswith("0"):
        return "218" + digits[1:]
    if digits and not digits.startswith("218"):
        return "218" + digits
    return digits


def active_coupons():
    """Coupons a customer could actually use right now. No made-up codes."""
    now = timezone.now()
    return (
        Discount.objects.filter(is_active=True, code__isnull=False)
        .exclude(code="")
        .filter(Q(start_date__isnull=True) | Q(start_date__lte=now))
        .filter(Q(end_date__isnull=True) | Q(end_date__gte=now))
        .filter(Q(usage_limit__isnull=True) | Q(usage_count__lt=F("usage_limit")))
        .order_by("code")
    )


def render_template(text: str, *, name: str, store: str, coupon: str = "", order_number: str = "") -> str:
    return (
        text.replace("{الاسم}", name or "عميلنا العزيز")
        .replace("{المتجر}", store)
        .replace("{الكوبون}", coupon or "")
        .replace("{رقم_الطلب}", order_number or "")
        .strip()
    )


def template_text(settings: StoreSettings, template: str) -> str:
    texts = settings.texts or {}
    stored = texts.get(TEMPLATE_KEYS[template])
    return stored if isinstance(stored, str) and stored.strip() else TEMPLATE_DEFAULTS[template]


# ---- CSV export ------------------------------------------------------------

CSV_HEADERS = ["الاسم", "الهاتف", "المدينة", "التصنيف", "الوسوم", "عدد الطلبات", "الإنفاق", "آخر طلب", "تاريخ الميلاد"]


def export_csv(rows, settings: StoreSettings) -> str:
    """UTF-8 with a BOM, so Excel opens the Arabic correctly."""
    out = StringIO()
    out.write("﻿")
    writer = csv.writer(out)
    writer.writerow(CSV_HEADERS)
    now = timezone.now()
    for u in rows:
        writer.writerow([
            u.name,
            u.phone_number,
            u.last_city or "",
            SEGMENT_LABELS[segment_of(u.orders_count, u.spend, u.last_order_at, settings, now)],
            "، ".join(t.name for t in u.tags.all()),
            u.orders_count,
            f"{Decimal(u.spend or 0):.2f}",
            timezone.localtime(u.last_order_at).strftime("%Y-%m-%d") if u.last_order_at else "",
            u.birthday.isoformat() if u.birthday else "",
        ])
    return out.getvalue()


def recent_orders(user: User, limit: int = 10):
    rows = []
    for o in Order.objects.placed().filter(user=user).order_by("-created_at")[:limit]:
        rows.append({
            "id": str(o.id),
            "order_number": o.order_number,
            "stage": stage_of(o),
            "total": str(o.total),
            "created_at": o.created_at,
        })
    return rows
