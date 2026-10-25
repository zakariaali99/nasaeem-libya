"""Hiding from the store: a product, a brand, a category or a collection.

A hidden thing stays in the dashboard and in old orders, and is gone from
every place a shopper can reach — lists, search, the product page, the
sitemap, homepage widgets, the wishlist, the cart and checkout.
"""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.catalog.models import Category, Collection, Product, ProductCategory, ProductCollection
from apps.orders import services
from apps.orders.models import Cart, CartItem
from apps.orders.services import CheckoutError
from apps.storefront import services as storefront
from apps.storefront.models import StorefrontLayout, Widget, WidgetType

pytestmark = pytest.mark.django_db


def _product(name, slug, *, categories=(), collections=()):
    product = Product.objects.create(name=name, slug=slug, price=Decimal("100.00"))
    for category in categories:
        ProductCategory.objects.create(product=product, category=category)
    for collection in collections:
        ProductCollection.objects.create(product=product, collection=collection)
    return product


@pytest.fixture
def store():
    """أفنان (a brand) with a sub-category, «عروض الصيف» (a category beside
    it) and «مختارات» (a collection). One product sits in both أفنان and
    عروض الصيف — the owner's own example."""
    afnan = Category.objects.create(name="أفنان", slug="afnan")
    afnan_men = Category.objects.create(name="أفنان رجالي", slug="afnan-men", parent=afnan)
    summer = Category.objects.create(name="عروض الصيف", slug="summer")
    picks = Collection.objects.create(name="مختارات", slug="picks")
    return {
        "afnan": afnan,
        "afnan_men": afnan_men,
        "summer": summer,
        "picks": picks,
        "both": _product("9pm", "9pm", categories=[afnan, summer]),
        "afnan_only": _product("سوبريمو", "supremo", categories=[afnan]),
        "sub": _product("تورب", "turathi", categories=[afnan_men]),
        "picked": _product("مختار", "picked", collections=[picks]),
        "plain": _product("عادي", "plain"),
    }


def _list_names(client=None, **params):
    client = client or APIClient()
    rows = client.get(reverse("product-list"), {"page_size": 100, **params}).json()["data"]
    return {row["name"] for row in rows}


def _staff(owner):
    client = APIClient()
    client.force_authenticate(user=owner)
    return client


def _hide(model_obj):
    model_obj.is_active = False
    model_obj.save()


def test_hiding_a_category_hides_only_its_products(store):
    """The owner's example: hide «عروض الصيف» and the product in both is gone,
    while أفنان and its other products stay."""
    _hide(store["summer"])
    assert _list_names() == {"سوبريمو", "تورب", "مختار", "عادي"}
    tree = APIClient().get(reverse("category-list")).json()["data"]
    assert {c["name"] for c in tree} == {"أفنان"}


def test_hiding_a_brand_hides_its_sub_categories_and_their_products(store):
    _hide(store["afnan"])
    assert _list_names() == {"مختار", "عادي"}
    tree = APIClient().get(reverse("category-list")).json()["data"]
    assert [c["name"] for c in tree] == ["عروض الصيف"]
    for category in (store["afnan"], store["afnan_men"]):
        assert APIClient().get(reverse("category-detail", kwargs={"pk": category.id})).status_code == 404
        assert APIClient().get(reverse("category-products", kwargs={"pk": category.id})).status_code == 404


def test_hiding_a_collection_hides_its_products(store):
    _hide(store["picks"])
    assert "مختار" not in _list_names()
    assert APIClient().get(reverse("collection-list")).json()["data"] == []
    assert APIClient().get(reverse("collection-detail", kwargs={"pk": store["picks"].id})).status_code == 404


def test_showing_the_brand_again_restores_each_product_as_it_was(store):
    _hide(store["afnan_only"])  # hidden on its own first
    _hide(store["afnan"])
    store["afnan"].is_active = True
    store["afnan"].save()
    names = _list_names()
    assert {"9pm", "تورب"} <= names
    assert "سوبريمو" not in names  # its own switch is still off
    assert Product.objects.get(pk=store["both"].pk).is_active  # never touched


def test_a_hidden_product_is_out_of_every_shopper_path(store, customer):
    _hide(store["afnan"])
    hidden = store["sub"]
    client = APIClient()

    assert client.get(reverse("product-detail", kwargs={"pk": hidden.id})).status_code == 404
    assert client.get(reverse("product-by-slug", kwargs={"slug": hidden.slug})).status_code == 404
    assert "تورب" not in _list_names(search="تورب")
    predictive = client.get(reverse("search-predictive"), {"q": "أفنان"}).json()["data"]
    assert predictive["products"] == [] and predictive["matched_categories"] == []
    assert hidden.slug not in client.get("/api/sitemap.xml").content.decode()

    shopper = APIClient()
    shopper.force_authenticate(user=customer)
    assert shopper.post(reverse("wishlist-toggle"), {"product_id": str(hidden.id)}, format="json").status_code == 404
    assert client.post(reverse("cart"), {"product_id": str(hidden.id), "quantity": 1}, format="json").status_code == 404


def test_the_homepage_widgets_leave_hidden_things_out(store):
    layout = StorefrontLayout.objects.create(name="الافتراضي", is_global_active=True)
    _hide(store["afnan"])
    _hide(store["picks"])
    Widget.objects.create(layout=layout, type=WidgetType.PRODUCT_LIST, order=1, data=storefront.normalise_widget_data(
        WidgetType.PRODUCT_LIST, {"productIds": [str(store["sub"].id), str(store["plain"].id)]}))
    Widget.objects.create(layout=layout, type=WidgetType.CATEGORY_LIST, order=2, data=storefront.normalise_widget_data(
        WidgetType.CATEGORY_LIST, {"categoryIds": [str(store["afnan_men"].id), str(store["summer"].id)]}))
    Widget.objects.create(layout=layout, type=WidgetType.COLLECTION_SHOWCASE, order=3, data=storefront.normalise_widget_data(
        WidgetType.COLLECTION_SHOWCASE, {"collectionId": str(store["picks"].id)}))
    Widget.objects.create(layout=layout, type=WidgetType.RECENTLY_VIEWED, order=4, data=storefront.normalise_widget_data(
        WidgetType.RECENTLY_VIEWED, {"limit": 8}))

    widgets = APIClient().get(
        reverse("storefront-layout"), {"recent": f"{store['sub'].id},{store['plain'].id}"}
    ).json()["data"]["widgets"]
    products, categories, showcase, recent = (w["data"] for w in widgets)
    assert [p["name"] for p in products["products"]] == ["عادي"]
    assert [c["name"] for c in categories["categories"]] == ["عروض الصيف"]
    assert showcase["collection"] is None and showcase["products"] == []
    assert [p["name"] for p in recent["products"]] == ["عادي"]


def test_checkout_refuses_a_product_hidden_after_it_was_added(store, customer, region):
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=store["both"], quantity=1)
    _hide(store["summer"])

    line = services.cart_summary(cart)["items"][0]
    assert line["available"] is False
    with pytest.raises(CheckoutError, match="لم يعد متاحاً"):
        services.checkout(cart=cart, user=customer, region_id=region.id, address="شارع 1")


def test_old_orders_still_show_a_product_hidden_later(store, customer, region):
    cart = Cart.objects.create(user=customer)
    CartItem.objects.create(cart=cart, product=store["both"], quantity=1)
    order = services.checkout(cart=cart, user=customer, region_id=region.id, address="شارع 1")
    _hide(store["afnan"])

    rows = APIClient().post(reverse("order-track"), {"number": order.order_number}, format="json").json()["data"]
    assert rows[0]["items"][0]["product_name"] == "9pm"


def test_staff_still_see_everything_and_why_it_is_hidden(store, owner):
    _hide(store["afnan"])
    _hide(store["plain"])
    staff = _staff(owner)
    rows = {r["name"]: r["hidden_by"] for r in staff.get(reverse("product-list"), {"page_size": 100}).json()["data"]}
    assert rows["9pm"] == ["أفنان"]
    assert rows["تورب"] == ["أفنان"]
    assert rows["عادي"] == ["المنتج نفسه"]
    assert rows["مختار"] == []
    assert staff.get(reverse("product-detail", kwargs={"pk": store["sub"].id})).status_code == 200

    assert _list_names(staff, visibility="hidden") == {"9pm", "سوبريمو", "تورب", "عادي"}
    assert _list_names(staff, visibility="visible") == {"مختار"}

    # Customers are never told why — they never see the product at all.
    assert all(r["hidden_by"] == [] for r in APIClient().get(reverse("product-list")).json()["data"])


def test_the_confirmation_counts_the_products_that_would_go(store, owner):
    staff = _staff(owner)
    count = lambda name, pk: staff.get(reverse(name, kwargs={"pk": pk})).json()["data"]["products"]
    assert count("category-hide-impact", store["afnan"].id) == 3  # 9pm, سوبريمو, تورب
    assert count("category-hide-impact", store["summer"].id) == 1
    assert count("collection-hide-impact", store["picks"].id) == 1
    _hide(store["summer"])
    assert count("category-hide-impact", store["afnan"].id) == 2  # 9pm already gone
    assert APIClient().get(reverse("category-hide-impact", kwargs={"pk": store["afnan"].id})).status_code in (401, 403)


def test_staff_switch_a_category_off_and_on_from_the_dashboard(store, owner):
    staff = _staff(owner)
    url = reverse("category-detail", kwargs={"pk": store["afnan"].id})
    APIClient().get(reverse("product-detail", kwargs={"pk": store["afnan_only"].id}))  # warm the page cache
    assert staff.patch(url, {"is_active": False}, format="json").status_code == 200
    assert APIClient().get(reverse("product-detail", kwargs={"pk": store["afnan_only"].id})).status_code == 404
    assert staff.patch(url, {"is_active": True}, format="json").status_code == 200
    assert APIClient().get(reverse("product-detail", kwargs={"pk": store["afnan_only"].id})).status_code == 200
