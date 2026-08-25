"""Layout resolution, widget normalisation and widget population.

Three jobs, kept apart on purpose:

1. **Resolve** — which of the layouts is active right now (`08-features.md`).
2. **Normalise** — one canonical shape per widget type, applied *on write*. The
   reference accepted `imageUrl`, `image_url` and `url` for the same field and
   re-normalised on every read, in the client. Here the client can trust `data`.
3. **Populate** — a `product_list` widget stores ids; the homepage needs the
   objects. One request renders the homepage, so population happens server-side.
"""

from __future__ import annotations

from django.core.cache import cache
from django.db.models import Prefetch, Q
from django.utils import timezone

from apps.catalog.models import Category, Collection, Product
from apps.orders.models import Discount, OrderItem

from .models import StorefrontLayout, Widget, WidgetType

LAYOUT_CACHE_KEY = "storefront:layout:active"
LAYOUT_CACHE_SECONDS = 300


# --------------------------------------------------------------------------
# 1. Resolution
# --------------------------------------------------------------------------

def resolve_active_layout(now=None) -> StorefrontLayout | None:
    """A layout is active when `is_global_active` **and** now is inside the date
    range (when set) **and** today is in `active_days` (when set) **and** the
    hour is inside the hour window (when set). Most recently updated wins.

    When nothing matches, fall back to the global default — a store with a
    scheduled layout that has expired must not lose its homepage.
    """
    now = now or timezone.localtime()
    candidates = list(StorefrontLayout.objects.filter(is_global_active=True))
    matching = [layout for layout in candidates if _matches(layout, now)]
    pool = matching or candidates
    if not pool:
        return None
    return max(pool, key=lambda layout: layout.updated_at)


def _matches(layout: StorefrontLayout, now) -> bool:
    if layout.active_start_date and now < layout.active_start_date:
        return False
    if layout.active_end_date and now > layout.active_end_date:
        return False

    days = layout.active_days or []
    if days:
        # Stored as English weekday names, lowercased, as the reference did.
        today = now.strftime("%A").lower()
        if today not in [str(day).lower() for day in days]:
            return False

    start, end = layout.active_start_hour, layout.active_end_hour
    if start is not None and end is not None:
        hour = now.hour
        # A window that wraps midnight (22 → 6) is inclusive of both ends.
        inside = start <= hour < end if start <= end else (hour >= start or hour < end)
        if not inside:
            return False
    return True


# --------------------------------------------------------------------------
# 2. Normalisation — one canonical shape per type, applied on write
# --------------------------------------------------------------------------

def _first(data: dict, *keys, default=""):
    """Accept the reference's aliases at the boundary, store exactly one."""
    for key in keys:
        value = data.get(key)
        if value not in (None, ""):
            return value
    return default


def _ids(value) -> list[str]:
    if not isinstance(value, (list, tuple)):
        return []
    return [str(item) for item in value if item not in (None, "")]


def _layout(value) -> str:
    return "slider" if value == "slider" else "grid"


def normalise_widget_data(widget_type: str, data: dict | None) -> dict:
    """The canonical `data` for each of the 14 types, per `08-features.md`."""
    data = data if isinstance(data, dict) else {}

    if widget_type == WidgetType.CAROUSEL:
        slides = []
        for slide in data.get("slides") or []:
            if not isinstance(slide, dict):
                continue
            image = _first(slide, "imageUrl", "image_url", "url")
            if not image:
                continue
            slides.append({
                "imageUrl": image,
                "linkUrl": _first(slide, "linkUrl", "link_url", "href"),
                "title": slide.get("title", "") or "",
                "subtitle": slide.get("subtitle", "") or "",
            })
        style = data.get("carouselStyle")
        return {
            "slides": slides,
            "carouselStyle": "normal" if style == "normal" else "hero",
        }

    if widget_type == WidgetType.TEXT_BLOCK:
        return {"content": str(data.get("content") or "")}

    if widget_type == WidgetType.IMAGE:
        return {
            "imageUrl": _first(data, "imageUrl", "image_url", "url"),
            "altText": _first(data, "altText", "alt_text", "alt"),
            "linkUrl": _first(data, "linkUrl", "link_url", "href"),
        }

    if widget_type == WidgetType.PRODUCT_LIST:
        return {
            "title": data.get("title", "") or "",
            "productIds": _ids(_first(data, "productIds", "product_ids", default=[])),
            "layout": _layout(data.get("layout")),
        }

    if widget_type == WidgetType.COLLECTION_SHOWCASE:
        return {
            "collectionId": str(_first(data, "collectionId", "collection_id")),
            "layout": _layout(data.get("layout")),
        }

    if widget_type == WidgetType.CATEGORY_LIST:
        return {
            "title": data.get("title", "") or "",
            "categoryIds": _ids(_first(data, "categoryIds", "category_ids", default=[])),
            "layout": _layout(data.get("layout")),
        }

    if widget_type == WidgetType.PHOTO_LINK_GRID:
        items = []
        for item in data.get("items") or []:
            if not isinstance(item, dict):
                continue
            image = _first(item, "imageUrl", "image_url", "url")
            if not image:
                continue
            items.append({
                "imageUrl": image,
                "linkUrl": _first(item, "linkUrl", "link_url", "href"),
                # The reference called this `name` in the editor and `label` in
                # the type. One name survives: `label`.
                "label": _first(item, "label", "name", "title"),
            })
        return {"title": data.get("title", "") or "", "items": items}

    if widget_type == WidgetType.HERO_CTA:
        alignment = data.get("alignment")
        desktop_img = _first(
            data, "desktopImageUrl", "desktop_image_url", "backgroundImageUrl", "background_image_url", "imageUrl"
        )
        mobile_img = _first(
            data, "mobileImageUrl", "mobile_image_url"
        )
        return {
            "title": data.get("title", "") or "",
            "subtitle": data.get("subtitle", "") or "",
            "buttonLabel": _first(data, "buttonLabel", "button_label"),
            "buttonUrl": _first(data, "buttonUrl", "button_url"),
            "alignment": alignment if alignment in ("start", "center", "end") else "center",
            "desktopImageUrl": desktop_img,
            "mobileImageUrl": mobile_img,
            "backgroundImageUrl": desktop_img,
        }

    if widget_type == WidgetType.ANNOUNCEMENT_BAR:
        icon = data.get("icon")
        return {
            "title": data.get("title", "") or "",
            "message": data.get("message", "") or "",
            "linkLabel": _first(data, "linkLabel", "link_label"),
            "linkUrl": _first(data, "linkUrl", "link_url"),
            "dismissible": bool(data.get("dismissible", True)),
            "icon": icon if icon in ANNOUNCEMENT_ICONS else "megaphone",
        }

    if widget_type == WidgetType.DISCOVERY_BOX:
        return {
            "title": data.get("title", "") or "باقة عينات التجربة واسترداد القيمة 100%",
            "badge": data.get("badge", "") or "ضمان الرضا الكامل 🧪",
            "description": data.get("description", "") or "",
            "price": str(_first(data, "price", default="60 د.ل")),
            "sampleCount": int(data.get("sampleCount") or data.get("sample_count") or 5),
            "cashbackPercent": int(data.get("cashbackPercent") or data.get("cashback_percent") or 100),
            "linkUrl": _first(data, "linkUrl", "link_url", default="/search?q=عينات"),
            "buttonText": _first(data, "buttonText", "button_text", default="اطلب باقة التجربة الآن"),
            "showInCart": bool(data.get("showInCart", True)),
            "showInProductDetail": bool(data.get("showInProductDetail", True)),
        }

    if widget_type == WidgetType.TRUST_BADGES:
        items = []
        default_items = [
            {"icon": "shield-check", "title": "عطور أصلية 100%", "subtitle": "ماركات عالمية وأصلية مضمونة"},
            {"icon": "truck", "title": "توصيل لجميع مدن ليبيا", "subtitle": "شحن سريع وموثوق لباب بيتك"},
            {"icon": "credit-card", "title": "دفع آمن ومريح", "subtitle": "سداد، معاملات، بطاقات، أو كاش"},
        ]
        for item in data.get("items") or default_items:
            if isinstance(item, dict):
                items.append({
                    "icon": str(item.get("icon") or "sparkles"),
                    "title": str(item.get("title") or ""),
                    "subtitle": str(item.get("subtitle") or ""),
                })
        return {
            "title": data.get("title", "") or "",
            "items": items,
        }

    if widget_type == WidgetType.FREE_SHIPPING_BAR:
        return {
            "threshold": float(data.get("threshold") or 150),
            "messageBefore": str(data.get("messageBefore") or "أضف عطوراً بقيمة {amount} د.ل للحصول على شحن مجاني!"),
            "messageAfter": str(data.get("messageAfter") or "مبروك! مؤهل للشحن المجاني لكافة المدن 🚚"),
        }

    if widget_type == WidgetType.GIFT_WRAP_UPSELL:
        return {
            "title": data.get("title", "") or "تغليف الهدايا الفاخر",
            "price": str(_first(data, "price", default="15 د.ل")),
            "description": data.get("description", "") or "صندوق مخملي أنيق وشريط ستان وبطاقة إهداء مخصصة.",
            "imageUrl": _first(data, "imageUrl", "image_url"),
        }

    if widget_type == WidgetType.SPACER:
        height = data.get("height")
        return {"height": height if height in SPACER_HEIGHTS else "md"}

    if widget_type in PERSONALISED_TYPES:
        try:
            limit = int(data.get("limit") or 8)
        except (TypeError, ValueError):
            limit = 8
        return {
            "title": data.get("title", "") or "",
            "limit": max(1, min(limit, 24)),
            "layout": _layout(data.get("layout")),
        }

    return data


ANNOUNCEMENT_ICONS = ("megaphone", "info", "sparkles", "bell", "gift", "star", "tag")
SPACER_HEIGHTS = ("sm", "md", "lg", "xl", "2xl")
PERSONALISED_TYPES = (
    WidgetType.RECENTLY_VIEWED,
    WidgetType.BUY_AGAIN,
    WidgetType.RECOMMENDED_FOR_YOU,
    WidgetType.TRENDING_NEAR_YOU,
)


# --------------------------------------------------------------------------
# 3. Targeting
# --------------------------------------------------------------------------

def widget_is_visible(widget: Widget, *, user) -> bool:
    """`targeting` is `{isGuest?, segment?, region?}`.

    `segment` is **not implemented**: RFM segmentation is out of scope per
    `00-mission.md`, so there is nothing to resolve a segment against. A widget
    targeted at a segment is shown rather than silently hidden — recorded here
    so its absence is a decision, not an oversight.
    """
    targeting = widget.targeting or {}
    if not isinstance(targeting, dict):
        return True

    is_guest_rule = targeting.get("isGuest")
    if is_guest_rule is not None:
        is_guest = not (user and user.is_authenticated)
        if bool(is_guest_rule) != is_guest:
            return False

    region_rule = targeting.get("region")
    if region_rule:
        region = _user_region_id(user)
        # Fails open for a visitor whose region cannot be resolved: showing a
        # region-targeted widget too widely is a smaller failure than blanking
        # the homepage for everyone who has no saved address.
        if region is not None and str(region) != str(region_rule):
            return False

    return True


def _user_region_id(user):
    if not (user and user.is_authenticated):
        return None
    address = user.addresses.filter(is_default=True).first() or user.addresses.first()
    return address.region_id if address else None


# --------------------------------------------------------------------------
# 4. Population
# --------------------------------------------------------------------------

def _product_queryset():
    return Product.objects.filter(is_active=True).prefetch_related(
        "images",
        "categories",
        "collections",
        "variants",
        Prefetch("discounts", queryset=Discount.objects.filter(is_active=True)),
    )


def popular_products(limit: int, *, exclude_ids=()):
    """The guest fallback for every personalised widget.

    **No sales-rank data exists yet** — orders arrive in Phase 5 — so "popular"
    is currently the newest in-stock products. When order history exists this is
    the one function to change.
    """
    queryset = _product_queryset().filter(Q(track_quantity=False) | Q(stock__gt=0))
    if exclude_ids:
        queryset = queryset.exclude(id__in=list(exclude_ids))
    return list(queryset.order_by("-created_at")[:limit])


def _ordered_by_ids(ids):
    """Preserve the operator's chosen order — `id__in` does not."""
    products = {str(p.id): p for p in _product_queryset().filter(id__in=ids)}
    return [products[i] for i in ids if i in products]


def _personalised_products(widget_type, limit, *, user, recent_ids=()):
    if widget_type == WidgetType.RECENTLY_VIEWED:
        # Browsing history is held client-side (localStorage) and posted back as
        # `?recent=`: there is no view-tracking table, because the analytics
        # tables that powered this in the reference are out of scope.
        chosen = _ordered_by_ids(list(recent_ids)[:limit])
        return chosen or popular_products(limit)

    if widget_type == WidgetType.BUY_AGAIN and user and user.is_authenticated:
        bought = (
            OrderItem.objects.filter(order__user=user)
            .order_by("-created_at")
            .values_list("product_id", flat=True)
        )
        seen, ordered = set(), []
        for product_id in bought:
            if product_id and product_id not in seen:
                seen.add(product_id)
                ordered.append(str(product_id))
            if len(ordered) >= limit:
                break
        chosen = _ordered_by_ids(ordered)
        return chosen or popular_products(limit)

    if widget_type == WidgetType.RECOMMENDED_FOR_YOU and user and user.is_authenticated:
        # Products from the categories this customer has actually bought from.
        categories = Category.objects.filter(
            products__order_items__order__user=user
        ).values_list("id", flat=True).distinct()
        bought_ids = OrderItem.objects.filter(order__user=user).values_list("product_id", flat=True)
        if categories:
            chosen = list(
                _product_queryset()
                .filter(categories__id__in=list(categories))
                .exclude(id__in=list(bought_ids))
                .distinct()[:limit]
            )
            if chosen:
                return chosen
        return popular_products(limit)

    if widget_type == WidgetType.TRENDING_NEAR_YOU:
        region_id = _user_region_id(user)
        if region_id:
            nearby = OrderItem.objects.filter(
                order__shipping_region_id=region_id
            ).values_list("product_id", flat=True)[: limit * 4]
            seen, ordered = set(), []
            for product_id in nearby:
                if product_id and product_id not in seen:
                    seen.add(product_id)
                    ordered.append(str(product_id))
            chosen = _ordered_by_ids(ordered[:limit])
            if chosen:
                return chosen
        return popular_products(limit)

    return popular_products(limit)


def populate(widget: Widget, *, user=None, recent_ids=(), serialize_product, serialize_category,
             serialize_collection) -> dict:
    """Return the widget's `data` with its referenced objects attached.

    The serializers are injected so this module never imports a serializer that
    imports it back.
    """
    data = dict(widget.data or {})

    if widget.type == WidgetType.PRODUCT_LIST:
        data["products"] = serialize_product(_ordered_by_ids(data.get("productIds") or []))

    elif widget.type == WidgetType.CATEGORY_LIST:
        ids = data.get("categoryIds") or []
        found = {str(c.id): c for c in Category.objects.filter(id__in=ids, is_active=True)}
        data["categories"] = serialize_category([found[i] for i in ids if i in found])

    elif widget.type == WidgetType.COLLECTION_SHOWCASE:
        collection = Collection.objects.filter(
            id=data.get("collectionId") or None, is_active=True
        ).first()
        data["collection"] = serialize_collection(collection) if collection else None
        data["products"] = (
            serialize_product(list(_product_queryset().filter(collections=collection)[:12]))
            if collection
            else []
        )

    elif widget.type in PERSONALISED_TYPES:
        data["products"] = serialize_product(
            _personalised_products(
                widget.type, data.get("limit") or 8, user=user, recent_ids=recent_ids
            )
        )

    return data


# --------------------------------------------------------------------------
# 5. Cache — invalidated on every layout/widget write (see models' signals)
# --------------------------------------------------------------------------

def cached_layout_rows():
    """The resolution + the raw widget rows. Personalised population is NOT
    cached — it varies per visitor, and caching it would show one customer's
    history to another."""
    cached = cache.get(LAYOUT_CACHE_KEY)
    if cached is not None:
        layout_id, widget_ids = cached
        if layout_id is None:
            return None, []
        layout = StorefrontLayout.objects.filter(id=layout_id).first()
        if layout is not None:
            widgets = list(Widget.objects.filter(id__in=widget_ids).order_by("order", "created_at"))
            return layout, widgets

    layout = resolve_active_layout()
    widgets = (
        list(layout.widgets.filter(is_active=True).order_by("order", "created_at"))
        if layout
        else []
    )
    cache.set(
        LAYOUT_CACHE_KEY,
        (str(layout.id) if layout else None, [str(w.id) for w in widgets]),
        LAYOUT_CACHE_SECONDS,
    )
    return layout, widgets


def invalidate_layout_cache(*_args, **_kwargs):
    cache.delete(LAYOUT_CACHE_KEY)
