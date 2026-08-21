"""Storefront CMS: layout resolution, widget normalisation, targeting, population.

The homepage is entirely CMS-driven — if resolution picks the wrong layout, or a
widget's `data` arrives in a shape the client does not expect, the store has no
homepage. These are the tests that would notice.
"""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.cache import cache
from django.urls import reverse
from django.utils import timezone

from apps.catalog.models import Category, Collection, Product, ProductCollection
from apps.core.models import UserAddress
from apps.storefront import services
from apps.storefront.models import StorefrontLayout, Widget, WidgetType

pytestmark = pytest.mark.django_db


@pytest.fixture
def layout(db):
    return StorefrontLayout.objects.create(name="الافتراضي", is_global_active=True)


# --------------------------------------------------------------------------
# Resolution
# --------------------------------------------------------------------------

def test_no_layouts_resolves_to_none():
    assert services.resolve_active_layout() is None


def test_an_inactive_layout_is_never_resolved():
    StorefrontLayout.objects.create(name="مسودة", is_global_active=False)
    assert services.resolve_active_layout() is None


def test_a_layout_outside_its_date_range_does_not_win(layout):
    now = timezone.localtime()
    ramadan = StorefrontLayout.objects.create(
        name="رمضان",
        is_global_active=True,
        active_start_date=now - timedelta(days=60),
        active_end_date=now - timedelta(days=30),
    )
    assert services.resolve_active_layout(now) == layout
    assert services.resolve_active_layout(now) != ramadan


def test_the_most_recently_updated_matching_layout_wins(layout):
    newer = StorefrontLayout.objects.create(name="العيد", is_global_active=True)
    assert services.resolve_active_layout() == newer
    layout.save()  # touches updated_at
    assert services.resolve_active_layout() == layout


def test_an_expired_layout_still_serves_when_it_is_the_only_one():
    """Falling back beats losing the homepage entirely."""
    now = timezone.localtime()
    only = StorefrontLayout.objects.create(
        name="منتهي", is_global_active=True,
        active_start_date=now - timedelta(days=10),
        active_end_date=now - timedelta(days=5),
    )
    assert services.resolve_active_layout(now) == only


def test_active_days_excludes_other_weekdays(layout):
    now = timezone.localtime()
    tomorrow = (now + timedelta(days=1)).strftime("%A").lower()
    layout.active_days = [tomorrow]
    layout.save()
    assert services._matches(layout, now) is False
    assert services._matches(layout, now + timedelta(days=1)) is True


def test_the_hour_window_is_half_open(layout):
    now = timezone.localtime().replace(hour=12)
    layout.active_start_hour, layout.active_end_hour = 9, 17
    assert services._matches(layout, now) is True
    assert services._matches(layout, now.replace(hour=17)) is False
    assert services._matches(layout, now.replace(hour=8)) is False


def test_an_hour_window_that_wraps_midnight_still_matches(layout):
    layout.active_start_hour, layout.active_end_hour = 22, 6
    now = timezone.localtime()
    assert services._matches(layout, now.replace(hour=23)) is True
    assert services._matches(layout, now.replace(hour=2)) is True
    assert services._matches(layout, now.replace(hour=12)) is False


# --------------------------------------------------------------------------
# Normalisation — one shape per type, on write
# --------------------------------------------------------------------------

def test_image_aliases_collapse_to_one_field():
    """The reference accepted imageUrl / image_url / url for the same field and
    re-normalised on every read, in the client. One shape is stored here."""
    for alias in ("imageUrl", "image_url", "url"):
        data = services.normalise_widget_data(WidgetType.IMAGE, {alias: "/a.webp"})
        assert data["imageUrl"] == "/a.webp"
        assert set(data) == {"imageUrl", "altText", "linkUrl"}


def test_photo_grid_item_label_has_exactly_one_name():
    data = services.normalise_widget_data(
        WidgetType.PHOTO_LINK_GRID,
        {"items": [{"image_url": "/a.webp", "name": "أرماف", "href": "/x"}]},
    )
    assert data["items"] == [{"imageUrl": "/a.webp", "linkUrl": "/x", "label": "أرماف"}]


def test_a_slide_without_an_image_is_dropped():
    data = services.normalise_widget_data(
        WidgetType.CAROUSEL, {"slides": [{"title": "بلا صورة"}, {"imageUrl": "/b.webp"}]}
    )
    assert len(data["slides"]) == 1


def test_unknown_enum_values_fall_back_rather_than_reaching_the_client():
    assert services.normalise_widget_data(WidgetType.SPACER, {"height": "enormous"})["height"] == "md"
    assert services.normalise_widget_data(
        WidgetType.ANNOUNCEMENT_BAR, {"icon": "banana"}
    )["icon"] == "megaphone"
    assert services.normalise_widget_data(
        WidgetType.PRODUCT_LIST, {"layout": "carousel"}
    )["layout"] == "grid"
    assert services.normalise_widget_data(
        WidgetType.HERO_CTA, {"alignment": "middle"}
    )["alignment"] == "center"


def test_a_personalised_limit_is_clamped():
    assert services.normalise_widget_data(WidgetType.BUY_AGAIN, {"limit": 999})["limit"] == 24
    assert services.normalise_widget_data(WidgetType.BUY_AGAIN, {"limit": "x"})["limit"] == 8


# --------------------------------------------------------------------------
# Targeting
# --------------------------------------------------------------------------

def test_a_guest_only_widget_is_hidden_from_a_signed_in_customer(layout, customer):
    widget = Widget.objects.create(
        layout=layout, type=WidgetType.TEXT_BLOCK, data={"content": "سجّل الآن"},
        targeting={"isGuest": True},
    )
    from django.contrib.auth.models import AnonymousUser

    assert services.widget_is_visible(widget, user=AnonymousUser()) is True
    assert services.widget_is_visible(widget, user=customer) is False


def test_region_targeting_hides_a_widget_from_another_region(layout, customer, region):
    UserAddress.objects.create(user=customer, region=region, address="شارع", is_default=True)
    widget = Widget.objects.create(
        layout=layout, type=WidgetType.TEXT_BLOCK, data={"content": "طرابلس"},
        targeting={"region": "somewhere-else"},
    )
    assert services.widget_is_visible(widget, user=customer) is False

    widget.targeting = {"region": region.id}
    assert services.widget_is_visible(widget, user=customer) is True


# --------------------------------------------------------------------------
# Population
# --------------------------------------------------------------------------

def _make_products(count, *, active=True):
    return [
        Product.objects.create(
            name=f"عطر {index}", slug=f"عطر-{index}", price=Decimal("100.00"),
            sku=f"SKU-{index}", stock=5, is_active=active,
        )
        for index in range(count)
    ]


def test_a_product_list_keeps_the_operators_order(layout, client):
    products = _make_products(3)
    chosen = [str(products[2].id), str(products[0].id), str(products[1].id)]
    Widget.objects.create(
        layout=layout, type=WidgetType.PRODUCT_LIST,
        data=services.normalise_widget_data(WidgetType.PRODUCT_LIST, {"productIds": chosen}),
    )
    response = client.get(reverse("storefront-layout"))
    names = [p["name"] for p in response.json()["data"]["widgets"][0]["data"]["products"]]
    assert names == [products[2].name, products[0].name, products[1].name]


def test_an_inactive_product_never_reaches_the_homepage(layout, client):
    hidden = _make_products(1, active=False)[0]
    Widget.objects.create(
        layout=layout, type=WidgetType.PRODUCT_LIST,
        data=services.normalise_widget_data(
            WidgetType.PRODUCT_LIST, {"productIds": [str(hidden.id)]}
        ),
    )
    response = client.get(reverse("storefront-layout"))
    assert response.json()["data"]["widgets"][0]["data"]["products"] == []


def test_a_personalised_widget_falls_back_to_popular_for_a_guest(layout, client):
    """A guest must never see an empty personalised widget — the fallback is the
    whole reason the widget can be placed on a public homepage."""
    _make_products(3)
    Widget.objects.create(
        layout=layout, type=WidgetType.RECOMMENDED_FOR_YOU,
        data=services.normalise_widget_data(WidgetType.RECOMMENDED_FOR_YOU, {"limit": 8}),
    )
    response = client.get(reverse("storefront-layout"))
    assert len(response.json()["data"]["widgets"][0]["data"]["products"]) == 3


def test_recently_viewed_uses_the_ids_the_client_sends(layout, client):
    products = _make_products(3)
    Widget.objects.create(
        layout=layout, type=WidgetType.RECENTLY_VIEWED,
        data=services.normalise_widget_data(WidgetType.RECENTLY_VIEWED, {"limit": 8}),
    )
    response = client.get(reverse("storefront-layout"), {"recent": str(products[1].id)})
    names = [p["name"] for p in response.json()["data"]["widgets"][0]["data"]["products"]]
    assert names == [products[1].name]


def test_a_collection_showcase_carries_its_collection_and_its_products(layout, client):
    collection = Collection.objects.create(name="عروض", slug="عروض")
    product = _make_products(1)[0]
    ProductCollection.objects.create(product=product, collection=collection)
    Widget.objects.create(
        layout=layout, type=WidgetType.COLLECTION_SHOWCASE,
        data=services.normalise_widget_data(
            WidgetType.COLLECTION_SHOWCASE, {"collectionId": str(collection.id)}
        ),
    )
    data = client.get(reverse("storefront-layout")).json()["data"]["widgets"][0]["data"]
    assert data["collection"]["name"] == "عروض"
    assert [p["name"] for p in data["products"]] == [product.name]


def test_a_category_list_skips_an_inactive_category(layout, client):
    live = Category.objects.create(name="أرماف", slug="أرماف")
    dead = Category.objects.create(name="مخفي", slug="مخفي", is_active=False)
    Widget.objects.create(
        layout=layout, type=WidgetType.CATEGORY_LIST,
        data=services.normalise_widget_data(
            WidgetType.CATEGORY_LIST, {"categoryIds": [str(dead.id), str(live.id)]}
        ),
    )
    data = client.get(reverse("storefront-layout")).json()["data"]["widgets"][0]["data"]
    assert [c["name"] for c in data["categories"]] == ["أرماف"]


# --------------------------------------------------------------------------
# The endpoint
# --------------------------------------------------------------------------

def test_the_layout_endpoint_is_public_and_answers_200_with_no_layout(client):
    """No layout is an empty homepage, not an error: the client renders a
    designed empty state, and a 404 would send it to an error screen instead."""
    response = client.get(reverse("storefront-layout"))
    assert response.status_code == 200
    assert response.json()["data"] == {"layout": None, "widgets": []}


def test_an_inactive_widget_is_not_served(layout, client):
    Widget.objects.create(layout=layout, type=WidgetType.SPACER, data={"height": "md"},
                          is_active=False)
    assert client.get(reverse("storefront-layout")).json()["data"]["widgets"] == []


def test_widgets_come_back_in_order(layout, client):
    for order in (2, 0, 1):
        Widget.objects.create(layout=layout, type=WidgetType.SPACER,
                              data={"height": "md"}, order=order)
    orders = [w["order"] for w in client.get(reverse("storefront-layout")).json()["data"]["widgets"]]
    assert orders == [0, 1, 2]


def test_saving_a_widget_invalidates_the_cached_layout(layout, client):
    """Phase 8's gate is 'the change is visible immediately after a save'. A
    cache with no invalidation is exactly how that gate fails."""
    client.get(reverse("storefront-layout"))
    assert cache.get(services.LAYOUT_CACHE_KEY) is not None

    Widget.objects.create(layout=layout, type=WidgetType.SPACER, data={"height": "md"})
    assert cache.get(services.LAYOUT_CACHE_KEY) is None

    widgets = client.get(reverse("storefront-layout")).json()["data"]["widgets"]
    assert len(widgets) == 1
