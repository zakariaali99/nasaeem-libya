"""Customer Relationship Management (CRM) service for Nasaim Libya.

Calculates live customer metrics, tiers (VIP, repeat, new, inactive),
tagging, birthday celebrations, communication logs, and CSV exports.

Rules (Plan 08, Decisions 1–5):
- Spend is calculated from DELIVERED orders only.
- Total orders count includes all non-cancelled orders.
- Customer tiers evaluated in strict order:
  1. Inactive: Has placed orders, but last order > inactive_days ago (default 60).
  2. VIP: >= vip_min_orders (default 5) OR >= vip_min_spend (default 500 LYD).
  3. Repeat: >= 2 orders.
  4. New: <= 1 order.
- Production is SQLite: avoid Postgres-only functions.
"""

from __future__ import annotations

import csv
from datetime import date, timedelta
from decimal import Decimal
import io
import re

from django.db import models
from django.db.models import Count, Max, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.http import HttpResponse
from django.utils import timezone

from apps.core.models import CustomerInteraction, CustomerTag, Role, StoreSettings, User
from apps.orders.models import Order, OrderStatus, ShippingStatus


def get_crm_thresholds() -> dict[str, int | Decimal]:
    """Retrieve configurable thresholds from StoreSettings (pk=1)."""
    settings = StoreSettings.objects.filter(pk=1).first()
    if settings:
        return {
            "vip_min_orders": settings.crm_vip_min_orders or 5,
            "vip_min_spend": settings.crm_vip_min_spend or Decimal("500.00"),
            "inactive_days": settings.crm_inactive_days or 60,
        }
    return {
        "vip_min_orders": 5,
        "vip_min_spend": Decimal("500.00"),
        "inactive_days": 60,
    }


def determine_customer_tier(
    total_orders: int,
    lifetime_spend: Decimal,
    last_order_date: timezone.datetime | date | None,
    thresholds: dict | None = None,
    now: timezone.datetime | None = None,
) -> str:
    """Determine customer tier based on approved priority (Plan 08, d-2)."""
    if thresholds is None:
        thresholds = get_crm_thresholds()
    if now is None:
        now = timezone.now()

    inactive_days = int(thresholds.get("inactive_days", 60))
    vip_min_orders = int(thresholds.get("vip_min_orders", 5))
    vip_min_spend = Decimal(str(thresholds.get("vip_min_spend", "500.00")))

    # 1. Inactive: has orders, but last order was placed more than inactive_days ago
    if total_orders > 0 and last_order_date is not None:
        if isinstance(last_order_date, date) and not isinstance(last_order_date, timezone.datetime):
            last_date = last_order_date
            today_date = now.date() if isinstance(now, timezone.datetime) else now
            diff_days = (today_date - last_date).days
        else:
            diff_days = (now - last_order_date).days

        if diff_days > inactive_days:
            return "inactive"

    # 2. VIP: 5 orders or 500 LYD spend
    if total_orders >= vip_min_orders or lifetime_spend >= vip_min_spend:
        return "vip"

    # 3. Repeat: 2 or more orders
    if total_orders >= 2:
        return "repeat"

    # 4. New: 1 or 0 orders
    return "new"


TIER_LABELS = {
    "vip": "عميل مميز (VIP)",
    "repeat": "عميل متكرر",
    "new": "عميل جديد",
    "inactive": "عميل خامل",
}

TIER_SHORT_LABELS = {
    "vip": "VIP",
    "repeat": "متكرر",
    "new": "جديد",
    "inactive": "خامل",
}


def compute_customer_metrics(user: User, thresholds: dict | None = None) -> dict:
    """Compute detailed CRM metrics for a single user."""
    if thresholds is None:
        thresholds = get_crm_thresholds()

    orders_qs = Order.objects.filter(user=user)
    non_cancelled = orders_qs.exclude(status=OrderStatus.CANCELLED)
    delivered = orders_qs.filter(shipping_status=ShippingStatus.DELIVERED)

    total_orders = non_cancelled.count()
    delivered_count = delivered.count()
    lifetime_spend = (
        delivered.aggregate(s=Coalesce(Sum("total"), Value(Decimal("0.00"))))["s"]
        or Decimal("0.00")
    )
    avg_order_value = (
        (lifetime_spend / delivered_count).quantize(Decimal("0.01"))
        if delivered_count > 0
        else Decimal("0.00")
    )

    last_order = non_cancelled.order_by("-created_at").first()
    last_order_date = last_order.created_at if last_order else None

    tier = determine_customer_tier(
        total_orders=total_orders,
        lifetime_spend=lifetime_spend,
        last_order_date=last_order_date,
        thresholds=thresholds,
    )

    # City: most frequent order city or default address
    top_city_order = (
        orders_qs.exclude(shipping_city__isnull=True)
        .values("shipping_city__name")
        .annotate(c=Count("id"))
        .order_by("-c")
        .first()
    )
    if top_city_order:
        city_name = top_city_order["shipping_city__name"]
    else:
        addr = user.addresses.select_related("city").filter(is_default=True).first() or user.addresses.select_related("city").first()
        city_name = addr.city.name if addr and addr.city else ""

    # Birthday check
    today = timezone.localdate()
    is_birthday_today = bool(
        user.birthday
        and user.birthday.month == today.month
        and user.birthday.day == today.day
    )

    return {
        "total_orders": total_orders,
        "delivered_orders_count": delivered_count,
        "lifetime_spend": str(lifetime_spend),
        "average_order_value": str(avg_order_value),
        "last_order_date": last_order_date.isoformat() if last_order_date else None,
        "tier": tier,
        "tier_label": TIER_LABELS.get(tier, tier),
        "tier_short_label": TIER_SHORT_LABELS.get(tier, tier),
        "city": city_name,
        "is_birthday_today": is_birthday_today,
        "birthday": user.birthday.isoformat() if user.birthday else None,
    }


def filter_and_annotate_users_queryset(queryset, params: dict, thresholds: dict | None = None):
    """Annotate and filter users queryset with CRM metrics, working on SQLite and Postgres."""
    if thresholds is None:
        thresholds = get_crm_thresholds()

    # Search filter
    if search := str(params.get("search") or "").strip():
        queryset = queryset.filter(
            Q(phone_number__icontains=search)
            | Q(name__icontains=search)
            | Q(email__icontains=search)
        )

    # Tag filter
    if tag_id := str(params.get("tag_id") or "").strip():
        queryset = queryset.filter(tags__id=tag_id)

    # City filter
    if city_id := str(params.get("city_id") or "").strip():
        queryset = queryset.filter(
            Q(addresses__city_id=city_id) | Q(orders__shipping_city_id=city_id)
        ).distinct()

    # Conditional aggregations (portable across SQLite and Postgres)
    annotated = queryset.annotate(
        crm_total_orders=Count(
            "orders",
            filter=~Q(orders__status=OrderStatus.CANCELLED),
            distinct=True,
        ),
        crm_lifetime_spend=Coalesce(
            Sum(
                "orders__total",
                filter=Q(orders__shipping_status=ShippingStatus.DELIVERED),
            ),
            Value(Decimal("0.00")),
            output_field=models.DecimalField(max_digits=12, decimal_places=2),
        ),
        crm_last_order_date=Max(
            "orders__created_at",
            filter=~Q(orders__status=OrderStatus.CANCELLED),
        ),
    )

    # Tier filter
    tier = str(params.get("tier") or "").strip().lower()
    if tier in ("vip", "repeat", "new", "inactive"):
        now = timezone.now()
        inactive_cutoff = now - timedelta(days=int(thresholds["inactive_days"]))
        vip_min_orders = int(thresholds["vip_min_orders"])
        vip_min_spend = Decimal(str(thresholds["vip_min_spend"]))

        is_inactive = Q(crm_total_orders__gt=0, crm_last_order_date__lt=inactive_cutoff)
        is_vip = ~is_inactive & (
            Q(crm_total_orders__gte=vip_min_orders)
            | Q(crm_lifetime_spend__gte=vip_min_spend)
        )
        is_repeat = ~is_inactive & ~is_vip & Q(crm_total_orders__gte=2)
        is_new = ~is_inactive & ~is_vip & Q(crm_total_orders__lte=1)

        if tier == "inactive":
            annotated = annotated.filter(is_inactive)
        elif tier == "vip":
            annotated = annotated.filter(is_vip)
        elif tier == "repeat":
            annotated = annotated.filter(is_repeat)
        elif tier == "new":
            annotated = annotated.filter(is_new)

    # Sorting
    sort_key = str(params.get("sort") or "").strip()
    if sort_key == "spend_desc":
        annotated = annotated.order_by("-crm_lifetime_spend", "-date_joined")
    elif sort_key == "spend_asc":
        annotated = annotated.order_by("crm_lifetime_spend", "-date_joined")
    elif sort_key == "orders_desc":
        annotated = annotated.order_by("-crm_total_orders", "-date_joined")
    elif sort_key == "last_order_desc":
        annotated = annotated.order_by(
            models.F("crm_last_order_date").desc(nulls_last=True), "-date_joined"
        )
    elif sort_key == "newest":
        annotated = annotated.order_by("-date_joined")
    elif sort_key == "oldest":
        annotated = annotated.order_by("date_joined")
    elif sort_key == "name":
        annotated = annotated.order_by("name", "-date_joined")
    else:
        annotated = annotated.order_by("-date_joined")

    return annotated


def get_upcoming_birthdays_this_week(today: date | None = None) -> list[dict]:
    """Retrieve customers who celebrate their birthday within the next 7 days.

    Handles year boundary wraparound (e.g., Dec 29 to Jan 2) accurately.
    """
    if today is None:
        today = timezone.localdate()

    next_7_days = [today + timedelta(days=i) for i in range(7)]
    target_month_days = {(d.month, d.day): d for d in next_7_days}

    users_with_birthday = (
        User.objects.filter(birthday__isnull=False, is_active=True, role=Role.CUSTOMER)
        .prefetch_related("tags")
        .only("id", "name", "phone_number", "birthday")
    )

    results = []
    thresholds = get_crm_thresholds()

    for user in users_with_birthday:
        bday = user.birthday
        key = (bday.month, bday.day)
        if key in target_month_days:
            match_date = target_month_days[key]
            is_today = (match_date == today)
            results.append({
                "id": str(user.id),
                "name": user.name or "عميل",
                "phone_number": user.phone_number,
                "birthday": bday.isoformat(),
                "display_date": f"{bday.day:02d}/{bday.month:02d}",
                "is_today": is_today,
                "days_until": (match_date - today).days,
            })

    results.sort(key=lambda x: (x["days_until"], x["name"]))
    return results


def export_customers_csv(queryset) -> HttpResponse:
    """Export filtered customer list to CSV with UTF-8 BOM for Arabic Excel compatibility."""
    thresholds = get_crm_thresholds()

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    filename = f"customers_export_{timezone.localdate().isoformat()}.csv"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    # UTF-8 BOM so Excel opens Arabic correctly
    response.write("\ufeff")

    writer = csv.writer(response)
    writer.writerow([
        "الاسم",
        "رقم الهاتف",
        "البريد الإلكتروني",
        "المدينة",
        "التصنيف",
        "الوسوم",
        "عدد الطلبات",
        "إجمالي الإنفاق (د.ل)",
        "تاريخ آخر طلب",
        "تاريخ الميلاد",
        "تاريخ التسجيل",
    ])

    for user in queryset.prefetch_related("tags"):
        spend = getattr(user, "crm_lifetime_spend", Decimal("0.00"))
        total_orders = getattr(user, "crm_total_orders", 0)
        last_order = getattr(user, "crm_last_order_date", None)

        tier = determine_customer_tier(
            total_orders=total_orders,
            lifetime_spend=spend,
            last_order_date=last_order,
            thresholds=thresholds,
        )

        tags_str = ", ".join(t.name for t in user.tags.all())
        last_order_str = last_order.strftime("%Y-%m-%d %H:%M") if last_order else "لا يوجد"
        birthday_str = user.birthday.isoformat() if user.birthday else ""
        date_joined_str = user.date_joined.strftime("%Y-%m-%d")

        # Top city
        addr = user.addresses.select_related("city").filter(is_default=True).first() or user.addresses.select_related("city").first()
        city_str = addr.city.name if addr and addr.city else ""

        writer.writerow([
            user.name or "عميل بدون اسم",
            user.phone_number,
            user.email or "",
            city_str,
            TIER_LABELS.get(tier, tier),
            tags_str,
            total_orders,
            f"{spend:.2f}",
            last_order_str,
            birthday_str,
            date_joined_str,
        ])

    return response


def format_whatsapp_phone(raw_phone: str) -> str:
    """Format phone number for WhatsApp wa.me links with Libyan country code 218."""
    digits = re.sub(r"\D", "", str(raw_phone))
    if digits.startswith("09") and len(digits) == 10:
        return "218" + digits[1:]
    if digits.startswith("9") and len(digits) == 9:
        return "218" + digits
    if digits.startswith("218"):
        return digits
    return digits
