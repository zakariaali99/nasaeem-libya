"""Catalogue model behaviour: stock arithmetic, Arabic slugs, append-only logs."""

from decimal import Decimal

import pytest
from django.db import IntegrityError
from django.db.models import ProtectedError

from apps.catalog.models import Category, InventoryLog, Product

pytestmark = pytest.mark.django_db


class TestArabicSlugs:
    def test_arabic_slug_round_trips_through_the_orm(self, product):
        assert Product.objects.get(slug="عود-ملكي").name == "عود ملكي"

    def test_every_slug_field_allows_unicode(self):
        """A Latin-only slug field silently mangles every Arabic name."""
        from apps.catalog.models import Collection

        for model in (Category, Collection, Product):
            assert model._meta.get_field("slug").allow_unicode is True

    def test_arabic_slug_is_unique(self, product):
        with pytest.raises(IntegrityError):
            Product.objects.create(name="آخر", slug="عود-ملكي", price=Decimal("10.00"))


class TestStock:
    def test_available_stock_subtracts_reservations(self, product):
        product.reserved_stock = 4
        assert product.available_stock == 6

    def test_a_fully_reserved_product_is_out_of_stock(self, product):
        product.reserved_stock = 10
        assert product.available_stock == 0
        assert not product.is_in_stock

    def test_untracked_products_are_always_in_stock(self, product):
        product.track_quantity = False
        product.stock = 0
        assert product.is_in_stock

    def test_variant_available_stock_subtracts_reservations(self, variant):
        variant.reserved_stock = 2
        assert variant.available_stock == 3


class TestInventoryLogIsAppendOnly:
    def test_a_log_row_can_be_created(self, product, owner):
        log = InventoryLog.objects.create(
            product=product, change=5, reason=InventoryLog.Reason.RESTOCK, user=owner
        )
        assert log.change == 5

    def test_a_log_row_cannot_be_updated(self, product):
        log = InventoryLog.objects.create(
            product=product, change=5, reason=InventoryLog.Reason.RESTOCK
        )
        log.change = 999
        with pytest.raises(ValueError):
            log.save()

    def test_a_log_row_cannot_be_deleted(self, product):
        log = InventoryLog.objects.create(
            product=product, change=5, reason=InventoryLog.Reason.RESTOCK
        )
        with pytest.raises(ValueError):
            log.delete()


class TestRelationalIntegrity:
    def test_deleting_a_product_with_a_cart_item_cleans_cart(self, product, customer):
        from apps.orders.models import Cart, CartItem

        cart = Cart.objects.create(user=customer)
        CartItem.objects.create(cart=cart, product=product, quantity=1)
        product.delete()
        assert CartItem.objects.filter(cart=cart, product_id=product.id).count() == 0

    def test_deleting_a_product_with_an_order_item_preserves_order_history(self, product, customer):
        """Order history must survive a product being removed from the catalogue."""
        from apps.orders.models import Order, OrderItem

        order = Order.objects.create(order_number="202608MOA0001", user=customer)
        item = OrderItem.objects.create(
            order=order, product=product, quantity=1,
            unit_price=Decimal("450.00"), total_price=Decimal("450.00"),
            product_name=product.name,
        )
        product.delete()
        item.refresh_from_db()
        assert item.product is None
        assert item.product_name == "عود ملكي"
        assert item.total_price == Decimal("450.00")

    def test_a_product_cannot_be_in_the_same_category_twice(self, product, category):
        from apps.catalog.models import ProductCategory

        ProductCategory.objects.create(product=product, category=category)
        with pytest.raises(IntegrityError):
            ProductCategory.objects.create(product=product, category=category)


# ===========================================================================
# Phase 3 — the catalogue API
# ===========================================================================

from django.urls import reverse  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402

from apps.core.models import Role  # noqa: E402

PASSWORD = "CorrectHorse9"


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def admin_api(db):
    from apps.core.models import User

    User.objects.create_superuser(phone_number="0910000002", password=PASSWORD, role=Role.OWNER)
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": "0910000002", "password": PASSWORD},
        format="json",
    )
    return client


@pytest.fixture
def customer_api(db):
    from apps.core.models import User

    User.objects.create_user(phone_number="0912222222", password=PASSWORD)
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": "0912222222", "password": PASSWORD},
        format="json",
    )
    return client


def make_products(count, *, category=None, prefix="منتج"):
    from apps.catalog.models import ProductImage

    created = []
    for index in range(count):
        product = Product.objects.create(
            name=f"{prefix} {index}", slug=f"{prefix}-{index}",
            price=Decimal("100.00") + index, is_active=True, track_quantity=True, stock=5,
        )
        ProductImage.objects.create(product=product, url=f"/media/products/p{index}-full.webp")
        if category:
            product.categories.add(category)
        created.append(product)
    return created


class TestProductList:
    def test_the_card_gets_everything_it_needs_in_one_response(self, api, product, category):
        from apps.catalog.models import ProductImage

        product.categories.add(category)
        ProductImage.objects.create(product=product, url="/media/products/x-full.webp")

        body = api.get(reverse("product-list")).json()
        item = body["data"][0]
        for field in (
            "id", "name", "slug", "price", "compare_at_price", "images", "has_variants",
            "stock", "reserved_stock", "is_active", "categories", "collections", "discounts",
        ):
            assert field in item, field
        assert body["meta"] == {"page": 1, "limit": 20, "total": 1, "pages": 1}

    def test_images_carry_all_three_renditions(self, api, product):
        from apps.catalog.models import ProductImage

        ProductImage.objects.create(product=product, url="/media/products/x-full.webp")
        image = api.get(reverse("product-list")).json()["data"][0]["images"][0]
        assert set(image["renditions"]) == {"thumb", "medium", "full"}
        assert image["renditions"]["thumb"].endswith("x-thumb.webp")

    def test_the_list_issues_no_n_plus_one(self, api, django_assert_num_queries, category):
        """The count must not grow with the number of products. Drop the
        prefetches in product_queryset() and this fails."""
        make_products(1, category=category)
        api.get(reverse("product-list"))  # warm any one-off queries

        make_products(1, category=category, prefix="أ")
        with django_assert_num_queries(0) as captured:
            pass
        import django.test.utils  # noqa: F401
        from django.test.utils import CaptureQueriesContext
        from django.db import connection

        with CaptureQueriesContext(connection) as small:
            api.get(reverse("product-list"))
        baseline = len(small)

        make_products(10, category=category, prefix="ب")
        with CaptureQueriesContext(connection) as large:
            api.get(reverse("product-list"))

        assert len(large) == baseline, (
            f"query count grew from {baseline} to {len(large)} when 10 products were added — N+1"
        )

    def test_inactive_products_are_hidden_from_the_public(self, api, product):
        product.is_active = False
        product.save()
        assert api.get(reverse("product-list")).json()["meta"]["total"] == 0

    def test_an_admin_can_see_inactive_products(self, admin_api, product):
        product.is_active = False
        product.save()
        response = admin_api.get(reverse("product-list"), {"is_active": "false"})
        assert response.json()["meta"]["total"] == 1

    @pytest.mark.parametrize(
        "params,expected",
        [
            ({"search": "عود"}, 1),
            ({"search": "لا-يوجد"}, 0),
            ({"min_price": "500"}, 0),
            ({"max_price": "500"}, 1),
        ],
    )
    def test_filters(self, api, product, params, expected):
        assert api.get(reverse("product-list"), params).json()["meta"]["total"] == expected

    def test_sorting_by_price(self, api, category):
        make_products(3, category=category)
        ascending = api.get(reverse("product-list"), {"sort": "price_asc"}).json()["data"]
        prices = [Decimal(p["price"]) for p in ascending]
        assert prices == sorted(prices)

    def test_filtering_by_category_slug(self, api, category):
        make_products(2, category=category)
        make_products(1, prefix="خارج")
        body = api.get(reverse("product-list"), {"category": category.slug}).json()
        assert body["meta"]["total"] == 2


class TestProductDetail:
    def test_resolves_by_slug_and_by_uuid(self, api, product):
        by_slug = api.get(reverse("product-detail", args=[product.slug]))
        by_uuid = api.get(reverse("product-detail", args=[str(product.id)]))
        assert by_slug.status_code == by_uuid.status_code == 200
        assert by_slug.json()["data"]["id"] == by_uuid.json()["data"]["id"]

    def test_an_arabic_slug_resolves(self, api, product):
        assert api.get(reverse("product-detail", args=["عود-ملكي"])).status_code == 200

    def test_a_missing_product_is_404_with_an_arabic_message(self, api):
        response = api.get(reverse("product-detail", args=["nope"]))
        assert response.status_code == 404
        assert "غير موجود" in response.json()["message"]

    def test_the_discount_badge_agrees_with_the_prices(self, api, product):
        """price 450, compare_at 560 → 20%. The badge is derived from the two
        numbers beside it, so it cannot disagree with them."""
        item = api.get(reverse("product-detail", args=[product.slug])).json()["data"]
        assert item["price"] == "450.00"
        assert item["compare_at_price"] == "560.00"
        assert item["discount_percent"] == 20

    def test_no_badge_when_there_is_no_saving(self, api, product):
        product.compare_at_price = None
        product.save()
        item = api.get(reverse("product-detail", args=[product.slug])).json()["data"]
        assert item["discount_percent"] is None


class TestProductWrites:
    def test_an_admin_creates_a_product_and_it_appears_publicly(self, admin_api, api, category):
        response = admin_api.post(
            reverse("product-list"),
            {"name": "عطر تجريبي", "price": "199.99", "category_ids": [str(category.id)],
             "images": [{"url": "/media/products/n-full.webp", "alt_text": "عطر"}]},
            format="json",
        )
        assert response.status_code == 201
        created = response.json()["data"]
        assert created["slug"] == "عطر-تجريبي"

        public = api.get(reverse("product-detail", args=[created["slug"]]))
        assert public.status_code == 200
        assert public.json()["data"]["categories"][0]["id"] == str(category.id)
        assert public.json()["data"]["images"][0]["alt_text"] == "عطر"

    def test_compare_at_price_must_exceed_price(self, admin_api):
        response = admin_api.post(
            reverse("product-list"),
            {"name": "خطأ", "price": "100.00", "compare_at_price": "80.00"},
            format="json",
        )
        assert response.status_code == 400
        assert "compare_at_price" in response.json()["errors"]

    def test_stock_cannot_be_set_through_the_product_endpoint(self, admin_api, product):
        """Stock only moves through adjust_stock(), which writes an InventoryLog."""
        admin_api.patch(
            reverse("product-detail", args=[product.slug]), {"stock": 9999}, format="json"
        )
        product.refresh_from_db()
        assert product.stock == 10

    def test_deleting_a_product_with_order_history_deletes_product_safely(
        self, admin_api, product, customer
    ):
        from apps.orders.models import Order, OrderItem

        order = Order.objects.create(order_number="202608TST0001", user=customer)
        item = OrderItem.objects.create(
            order=order, product=product, quantity=1, unit_price=Decimal("450.00"),
            total_price=Decimal("450.00"), product_name=product.name,
        )
        response = admin_api.delete(reverse("product-detail", args=[product.slug]))
        assert response.status_code == 200
        assert not Product.objects.filter(id=product.id).exists()
        item.refresh_from_db()
        assert item.product is None
        assert item.product_name == "عود ملكي"

    def test_slugs_do_not_collide(self, admin_api):
        first = admin_api.post(reverse("product-list"), {"name": "عطر", "price": "10.00"}, format="json")
        second = admin_api.post(reverse("product-list"), {"name": "عطر", "price": "10.00"}, format="json")
        assert first.json()["data"]["slug"] != second.json()["data"]["slug"]


class TestInventory:
    def test_an_adjustment_writes_an_inventory_log_row(self, admin_api, product):
        before = InventoryLog.objects.count()
        response = admin_api.post(
            reverse("inventory-adjust"),
            {"product_id": str(product.id), "change": 5, "reason": "restock", "note": "شحنة"},
            format="json",
        )
        assert response.status_code == 200
        product.refresh_from_db()
        assert product.stock == 15
        assert InventoryLog.objects.count() == before + 1

        log = InventoryLog.objects.latest("created_at")
        assert log.change == 5 and log.reason == "restock" and log.note == "شحنة"
        assert log.user.phone_number == "0910000002"

    def test_stock_cannot_go_below_what_is_reserved(self, admin_api, product):
        product.reserved_stock = 8
        product.save()
        response = admin_api.post(
            reverse("inventory-adjust"),
            {"product_id": str(product.id), "change": -5, "reason": "correction"},
            format="json",
        )
        assert response.status_code == 400
        product.refresh_from_db()
        assert product.stock == 10

    def test_stock_cannot_go_negative(self, admin_api, product):
        response = admin_api.post(
            reverse("inventory-adjust"),
            {"product_id": str(product.id), "change": -50, "reason": "correction"},
            format="json",
        )
        assert response.status_code == 400

    def test_a_zero_change_is_rejected(self, admin_api, product):
        response = admin_api.post(
            reverse("inventory-adjust"),
            {"product_id": str(product.id), "change": 0, "reason": "correction"},
            format="json",
        )
        assert response.status_code == 400

    def test_adjusting_a_variant_logs_against_it(self, admin_api, product, variant):
        admin_api.post(
            reverse("inventory-adjust"),
            {"product_id": str(product.id), "variant_id": str(variant.id),
             "change": 3, "reason": "restock"},
            format="json",
        )
        variant.refresh_from_db()
        assert variant.stock == 8
        assert InventoryLog.objects.filter(variant=variant).count() == 1

    def test_the_log_endpoint_lists_history(self, admin_api, product):
        admin_api.post(
            reverse("inventory-adjust"),
            {"product_id": str(product.id), "change": 2, "reason": "restock"}, format="json",
        )
        body = admin_api.get(reverse("inventory-logs")).json()
        assert body["meta"]["total"] == 1
        assert body["data"][0]["reason_label"] == "إعادة تخزين"


class TestVariantMatrix:
    def test_the_matrix_creates_one_variant_per_combination(self, admin_api, product):
        from apps.catalog.models import VariantOption, VariantValue

        size = VariantOption.objects.create(name="الحجم")
        colour = VariantOption.objects.create(name="اللون")
        sizes = [VariantValue.objects.create(option=size, value=v) for v in ("50 مل", "100 مل")]
        colours = [VariantValue.objects.create(option=colour, value=v) for v in ("ذهبي", "فضي")]

        response = admin_api.post(
            reverse("variant-matrix", args=[product.slug]),
            {"value_groups": [[str(v.id) for v in sizes], [str(v.id) for v in colours]],
             "defaults": {"stock": 4}},
            format="json",
        )
        assert response.status_code == 201
        assert len(response.json()["data"]) == 4
        product.refresh_from_db()
        assert product.has_variants is True

    def test_regenerating_creates_only_what_is_missing(self, admin_api, product):
        from apps.catalog.models import VariantOption, VariantValue

        size = VariantOption.objects.create(name="الحجم")
        values = [VariantValue.objects.create(option=size, value=v) for v in ("50 مل", "100 مل")]
        payload = {"value_groups": [[str(v.id) for v in values]]}

        first = admin_api.post(reverse("variant-matrix", args=[product.slug]), payload, format="json")
        second = admin_api.post(reverse("variant-matrix", args=[product.slug]), payload, format="json")
        assert len(first.json()["data"]) == 2
        assert len(second.json()["data"]) == 0


class TestImageUpload:
    def test_an_upload_produces_three_renditions(self, admin_api, tmp_path, settings):
        import io

        from PIL import Image
        from django.core.files.uploadedfile import SimpleUploadedFile

        settings.MEDIA_ROOT = str(tmp_path)
        buffer = io.BytesIO()
        Image.new("RGB", (1500, 1500), (109, 155, 31)).save(buffer, "PNG")
        buffer.seek(0)

        response = admin_api.post(
            reverse("image-upload"),
            {"file": SimpleUploadedFile("bottle.png", buffer.read(), content_type="image/png")},
            format="multipart",
        )
        assert response.status_code == 201
        data = response.json()["data"]
        assert set(data["renditions"]) == {"thumb", "medium", "full"}

        written = sorted(p.name for p in (tmp_path / "products").iterdir())
        assert len(written) == 3
        assert all(name.endswith(".webp") for name in written)

        from PIL import Image as PILImage

        thumb = PILImage.open(tmp_path / "products" / [n for n in written if "thumb" in n][0])
        assert max(thumb.size) == 200

    def test_a_non_image_is_rejected(self, admin_api):
        from django.core.files.uploadedfile import SimpleUploadedFile

        response = admin_api.post(
            reverse("image-upload"),
            {"file": SimpleUploadedFile("evil.php", b"<?php echo 1; ?>", content_type="image/png")},
            format="multipart",
        )
        assert response.status_code == 400


ADMIN_ENDPOINTS = [
    ("get", "inventory-list", []),
    ("get", "inventory-logs", []),
    ("post", "inventory-adjust", []),
    ("get", "option-list", []),
    ("post", "option-list", []),
    ("get", "variant-list", []),
    ("post", "variant-list", []),
    ("post", "image-upload", []),
]


class TestAdminPermissionSweep:
    """Parametrised over the endpoint list so a new admin endpoint cannot
    silently skip the check."""

    @pytest.mark.parametrize("method,route,args", ADMIN_ENDPOINTS)
    def test_a_customer_gets_403(self, customer_api, method, route, args):
        response = getattr(customer_api, method)(reverse(route, args=args), {}, format="json")
        assert response.status_code == 403, f"{method.upper()} {route} → {response.status_code}"

    @pytest.mark.parametrize("method,route,args", ADMIN_ENDPOINTS)
    def test_an_anonymous_request_gets_401(self, api, method, route, args):
        response = getattr(api, method)(reverse(route, args=args), {}, format="json")
        assert response.status_code == 401, f"{method.upper()} {route} → {response.status_code}"

    def test_a_customer_cannot_write_products(self, customer_api, product):
        assert customer_api.post(reverse("product-list"), {"name": "x", "price": "1"}, format="json").status_code == 403
        assert customer_api.patch(reverse("product-detail", args=[product.slug]), {"name": "y"}, format="json").status_code == 403
        assert customer_api.delete(reverse("product-detail", args=[product.slug])).status_code == 403

    def test_a_customer_cannot_write_categories(self, customer_api, category):
        assert customer_api.post(reverse("category-list"), {"name": "x"}, format="json").status_code == 403
        assert customer_api.patch(reverse("category-detail", args=[category.slug]), {"name": "y"}, format="json").status_code == 403


class TestSearch:
    """Arabic search. Every assertion here failed before the normalisation in
    `services.search_products` existed, because Postgres has no Arabic text
    configuration and `unaccent` does not touch harakat — measured:

        SELECT unaccent('عِطْر') = 'عطر';  ->  f
    """

    @pytest.fixture
    def catalogue(self, db):
        return [
            Product.objects.create(name=name, slug=slug, price=Decimal("100.00"),
                                   sku=sku, stock=5, description=description)
            for name, slug, sku, description in [
                ("عود ملكي", "عود-ملكي", "S-1", "عطر شرقي فاخر"),
                ("الوسام الأصيل", "الوسام-الأصيل", "S-2", "عطر رجالي كلاسيكي"),
                ("Armaf Club de Nuit", "armaf-club", "S-3", "عطر رجالي"),
            ]
        ]

    def search(self, api, term):
        response = api.get(reverse("product-list"), {"search": term})
        assert response.status_code == 200
        return [item["name"] for item in response.json()["data"]]

    def test_harakat_do_not_prevent_a_match(self, api, catalogue):
        assert "عود ملكي" in self.search(api, "عُودْ")

    def test_alef_variants_are_the_same_letter(self, api, catalogue):
        """A shopper typing الاصيل must find الأصيل — the hamza is optional in
        practice and typing it is the exception, not the rule."""
        assert "الوسام الأصيل" in self.search(api, "الاصيل")
        assert "الوسام الأصيل" in self.search(api, "الأصيل")

    def test_a_partial_word_still_finds_the_product(self, api, catalogue):
        """Full-text alone returns nothing for a prefix; trigram carries it."""
        assert "عود ملكي" in self.search(api, "عو")

    def test_latin_names_are_searchable_too(self, api, catalogue):
        assert "Armaf Club de Nuit" in self.search(api, "armaf")

    def test_the_description_is_searched(self, api, catalogue):
        assert len(self.search(api, "كلاسيكي")) == 1

    def test_a_term_that_matches_nothing_returns_nothing(self, api, catalogue):
        assert self.search(api, "zzzqqq") == []

    def test_an_inactive_product_is_never_returned(self, api, catalogue):
        catalogue[0].is_active = False
        catalogue[0].save()
        assert "عود ملكي" not in self.search(api, "عود")

    def test_search_is_ordered_by_relevance_not_by_date(self, api, catalogue):
        """The name match must outrank the description-only match, regardless of
        which product was created first."""
        assert self.search(api, "عود")[0] == "عود ملكي"

    def test_an_explicit_sort_overrides_relevance(self, api, catalogue):
        response = api.get(reverse("product-list"), {"search": "عطر", "sort": "name"})
        names = [item["name"] for item in response.json()["data"]]
        # Compared against the database's own collation, not Python's sorted():
        # PostgreSQL and Python order Arabic against Latin differently, and the
        # claim under test is "the sort parameter was honoured", not "Python
        # and PostgreSQL agree about collation".
        expected = list(
            Product.objects.filter(name__in=names).order_by("name").values_list("name", flat=True)
        )
        assert names == expected
        assert len(names) == 3


class TestInStockFilterAgreesWithTheCard:
    """The filter and the card must not disagree. They did: a product with
    variants keeps its stock on the variants, so `stock__gt=0` hid every
    variant product from "المتوفر فقط" while its card said متوفر."""

    def test_a_variant_product_with_stock_survives_the_filter(self, api, product, variant):
        product.has_variants = True
        product.stock = 0
        product.save()

        listing = api.get(reverse("product-list"), {"in_stock": "true"}).json()["data"]
        assert [item["name"] for item in listing] == [product.name]
        assert listing[0]["in_stock"] is True

    def test_a_variant_product_with_no_stock_is_filtered_out(self, api, product, variant):
        product.has_variants = True
        product.stock = 0
        product.save()
        variant.stock = 0
        variant.save()

        assert api.get(reverse("product-list"), {"in_stock": "true"}).json()["data"] == []

    def test_fully_reserved_stock_is_not_available(self, api, product):
        product.stock = 5
        product.reserved_stock = 5
        product.save()

        assert api.get(reverse("product-list"), {"in_stock": "true"}).json()["data"] == []
        assert api.get(reverse("product-list")).json()["data"][0]["in_stock"] is False

    def test_an_untracked_product_is_always_available(self, api, product):
        product.track_quantity = False
        product.stock = 0
        product.save()

        assert len(api.get(reverse("product-list"), {"in_stock": "true"}).json()["data"]) == 1


class TestAvailableStockAgreesWithInStock:
    """`available_stock` and `in_stock` must be computed from the same place.
    They were not, and a variant product's card read "بقي 0 فقط" (only 0 left)
    beside `in_stock: true` — a badge contradicting itself."""

    def test_a_variant_product_reports_its_variants_stock(self, api, product, variant):
        product.has_variants = True
        product.stock = 0
        product.save()

        item = api.get(reverse("product-list")).json()["data"][0]
        assert item["in_stock"] is True
        assert item["available_stock"] == variant.stock

    def test_a_deactivated_variants_stock_does_not_count(self, api, product, variant):
        product.has_variants = True
        product.stock = 0
        product.save()
        variant.is_active = False
        variant.save()

        item = api.get(reverse("product-list")).json()["data"][0]
        assert item["available_stock"] == 0
        assert item["in_stock"] is False


class TestArabicNormalisationIsWhatFindsThese:
    """The cases trigram similarity alone does NOT find.

    Short names match fuzzily by accident — `similarity('عود ملكي','عُودْ')` is
    0.167, just over the 0.15 threshold — so a short-name test proves nothing
    about the normalisation. On a long name the shared trigrams dilute:

        similarity('عطر الياسمين الليبي الأصيل الفاخر', 'الاصيل') = 0.129   ← below threshold
        ILIKE '%الاصيل%'                                          = false
        to_tsvector(...) @@ plainto_tsquery('الاصيل')             = false

    Remove the rules in `ARABIC_NORMALISERS` and these two fail.
    """

    @pytest.fixture
    def long_names(self, db):
        Product.objects.create(
            name="عطر الياسمين الليبي الأصيل الفاخر", slug="عطر-الياسمين",
            price=Decimal("100.00"), sku="L-1", stock=5,
        )
        Product.objects.create(
            name="دهن العود الكمبودي المعتَّق الممتاز", slug="دهن-العود",
            price=Decimal("100.00"), sku="L-2", stock=5,
        )

    def test_a_hamza_free_query_finds_a_long_name_written_with_hamza(self, api, long_names):
        response = api.get(reverse("product-list"), {"search": "الاصيل"})
        assert [p["name"] for p in response.json()["data"]] == ["عطر الياسمين الليبي الأصيل الفاخر"]

    def test_harakat_in_the_stored_name_do_not_hide_it(self, api, long_names):
        """Kept, but honestly labelled: this one ALSO passes without the
        normalisation, because trigram similarity happens to score 0.167 —
        0.017 above the threshold. It guards the behaviour, not the mechanism;
        the test above is the one that proves the normalisation is doing work."""
        response = api.get(reverse("product-list"), {"search": "المعتق"})
        assert [p["name"] for p in response.json()["data"]] == ["دهن العود الكمبودي المعتَّق الممتاز"]


class TestWishlist:
    def test_wishlist_toggle_adds_and_removes(self, client, customer, product):
        client.force_login(customer)
        # 1. Toggle add
        res1 = client.post("/api/wishlist/toggle/", {"product_id": str(product.id)}, format="json")
        assert res1.status_code == 200
        assert res1.json()["data"]["is_wishlisted"] is True
        assert res1.json()["data"]["count"] == 1

        # 2. Get list
        res_list = client.get("/api/wishlist/")
        assert res_list.status_code == 200
        items = res_list.json()["data"]
        assert len(items) == 1
        assert items[0]["product"]["id"] == str(product.id)

        # 3. Get IDs
        res_ids = client.get("/api/wishlist/ids/")
        assert res_ids.status_code == 200
        assert res_ids.json()["data"] == [str(product.id)]

        # 4. Toggle remove
        res2 = client.post("/api/wishlist/toggle/", {"product_id": str(product.id)}, format="json")
        assert res2.status_code == 200
        assert res2.json()["data"]["is_wishlisted"] is False
        assert res2.json()["data"]["count"] == 0

