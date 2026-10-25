"""The English store's content: `?lang=en` reads the `_en` twins, an empty
twin falls back to the Arabic, and the dashboard (no `lang`) is untouched."""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import PerfumeAttribute, Product, ProductCategory
from apps.orders.models import Cart, CartItem
from apps.storefront import services as storefront
from apps.storefront.models import StorefrontLayout, Widget, WidgetType

pytestmark = pytest.mark.django_db

EN = {"lang": "en"}


def _names(params=None):
    rows = APIClient().get(reverse("product-list"), {"page_size": 50, **(params or {})}).json()["data"]
    return {row["name"] for row in rows}


@pytest.fixture
def translated(product, category):
    product.name_en = "Royal Oud"
    product.description_en = "A deep oud."
    product.save()
    category.name_en = "Perfumes"
    category.save()
    ProductCategory.objects.create(product=product, category=category)
    PerfumeAttribute.objects.create(product=product, top_notes=["عود"], top_notes_en=["Oud"], heart_notes=["ورد"])
    return product


def test_english_pages_read_the_english_twin_and_fall_back_to_arabic(translated):
    Product.objects.create(name="مسك أبيض", slug="musk", price=Decimal("100.00"))
    assert _names() == {"عود ملكي", "مسك أبيض"}
    assert _names(EN) == {"Royal Oud", "مسك أبيض"}  # untranslated stays Arabic

    detail = APIClient().get(reverse("product-detail", kwargs={"pk": translated.id}), EN).json()["data"]
    assert (detail["name"], detail["description"]) == ("Royal Oud", "A deep oud.")
    assert detail["categories"][0]["name"] == "Perfumes"
    notes = detail["perfume_details"]
    assert notes["top_notes"] == ["Oud"] and notes["heart_notes"] == ["ورد"]


def test_the_cached_product_page_is_kept_per_language(translated):
    url = reverse("product-detail", kwargs={"pk": translated.id})
    assert APIClient().get(url).json()["data"]["name"] == "عود ملكي"
    assert APIClient().get(url, EN).json()["data"]["name"] == "Royal Oud"
    assert APIClient().get(url).json()["data"]["name"] == "عود ملكي"


def test_the_dashboard_sees_both_languages(translated, owner):
    staff = APIClient()
    staff.force_authenticate(user=owner)
    data = staff.get(reverse("product-detail", kwargs={"pk": translated.id})).json()["data"]
    assert (data["name"], data["name_en"]) == ("عود ملكي", "Royal Oud")

    staff.patch(reverse("product-detail", kwargs={"pk": translated.id}), {"name_en": "Royal Oud Intense"}, format="json")
    assert APIClient().get(reverse("product-detail", kwargs={"pk": translated.id}), EN).json()["data"]["name"] == "Royal Oud Intense"


def test_search_finds_the_english_name_from_either_language(translated):
    assert _names({"search": "royal"}) == {"عود ملكي"}
    assert _names({"search": "royal", **EN}) == {"Royal Oud"}
    predictive = APIClient().get(reverse("search-predictive"), {"q": "Royal", **EN}).json()["data"]
    assert [p["name"] for p in predictive["products"]] == ["Royal Oud"]


def test_sizes_read_in_english_without_typing_them(variant):
    rows = APIClient().get(reverse("product-list"), EN).json()["data"]
    assert rows[0]["variant_choices"][0]["label"] == "50 ml"
    rows = APIClient().get(reverse("product-list")).json()["data"]
    assert rows[0]["variant_choices"][0]["label"] == "50 مل"


def test_cities_have_english_names(city, region):
    city.name_en = "Tripoli"
    city.save()
    rows = APIClient().get(reverse("delivery-cities"), EN).json()["data"]
    assert rows[0]["name"] == "Tripoli"
    assert APIClient().get(reverse("delivery-cities")).json()["data"][0]["name"] == "طرابلس"
    region_rows = APIClient().get(reverse("delivery-city-regions", kwargs={"city_id": city.id}), EN).json()["data"]
    assert region_rows[0]["name"] == "قرقارش"  # no English name yet: Arabic


def test_the_cart_line_carries_the_english_name(translated, customer):
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=translated, quantity=1)
    shopper = APIClient()
    shopper.force_authenticate(user=customer)
    assert shopper.get(reverse("cart"), EN).json()["data"]["items"][0]["name"] == "Royal Oud"


def test_homepage_widgets_keep_and_serve_their_english_lines(product):
    layout = StorefrontLayout.objects.create(name="الافتراضي", is_global_active=True)
    data = storefront.normalise_widget_data(WidgetType.CAROUSEL, {
        "slides": [{"imageUrl": "/media/banners/a-full.webp", "title": "عروض", "title_en": "Offers",
                    "subtitle": "خصم", "subtitle_en": ""}],
        "unknown_en": "dropped",
    })
    assert data["slides"][0]["title_en"] == "Offers"
    assert "subtitle_en" not in data["slides"][0] and "unknown_en" not in data
    Widget.objects.create(layout=layout, type=WidgetType.CAROUSEL, order=1, data=data)

    slide = APIClient().get(reverse("storefront-layout"), EN).json()["data"]["widgets"][0]["data"]["slides"][0]
    assert (slide["title"], slide["subtitle"]) == ("Offers", "خصم")
    slide = APIClient().get(reverse("storefront-layout")).json()["data"]["widgets"][0]["data"]["slides"][0]
    assert slide["title"] == "عروض"
