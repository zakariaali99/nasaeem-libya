"""The SEO shell — the Phase 9 SEO/prerender leg.

These pin the gate line from `09-phases.md`: a `curl` of a product URL returns
the name and price in the HTML source, with valid JSON-LD. They run against the
source `frontend/index.html` shell (dist is not built in CI), which is enough to
prove the injection; production reads the built dist file through the same code.
"""

import json
import re
from decimal import Decimal

import pytest

from apps.catalog.models import Product, ProductImage


def _ld(html: str) -> dict:
    """The single JSON-LD block, parsed. Fails loudly if absent or malformed."""
    match = re.search(
        r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL
    )
    assert match, "no JSON-LD block in the page"
    return json.loads(match.group(1).replace("\\u003c", "<"))


@pytest.mark.django_db
class TestProductShell:
    def test_name_and_price_are_in_the_html_source(self, client, product):
        # The gate: `curl -s .../products/<slug> | grep 'عود'`.
        html = client.get(f"/products/{product.slug}").content.decode("utf-8")
        assert product.name in html
        assert "450.00" in html

    def test_json_ld_is_valid_product_with_offer(self, client, product):
        html = client.get(f"/products/{product.slug}").content.decode("utf-8")
        ld = _ld(html)
        assert ld["@context"] == "https://schema.org"
        assert ld["@type"] == "Product"
        assert ld["name"] == product.name
        assert ld["offers"]["price"] == "450.00"
        assert ld["offers"]["priceCurrency"] == "LYD"
        assert ld["offers"]["availability"] == "https://schema.org/InStock"

    def test_out_of_stock_product_advertises_out_of_stock(self, client, product):
        product.stock = product.reserved_stock  # available_stock == 0
        product.save(update_fields=["stock"])
        html = client.get(f"/products/{product.slug}").content.decode("utf-8")
        assert _ld(html)["offers"]["availability"] == "https://schema.org/OutOfStock"

    def test_canonical_is_absolute_and_ascii_encoded(self, client, product):
        html = client.get(f"/products/{product.slug}").content.decode("utf-8")
        match = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        assert match
        url = match.group(1)
        assert url.startswith("https://nasaeem.ly/products/")
        assert url.isascii()  # the Arabic slug was percent-encoded

    def test_exactly_one_title_element(self, client, product):
        html = client.get(f"/products/{product.slug}").content.decode("utf-8")
        assert html.count("<title>") == 1
        assert product.name in re.search(r"<title>(.*?)</title>", html).group(1)

    def test_variant_price_used_when_parent_price_is_null(self, client, db):
        parent = Product.objects.create(
            name="عطر بخيارات", slug="عطر-بخيارات", has_variants=True, price=None
        )
        parent.variants.create(price=Decimal("90.00"), is_active=True, stock=3)
        parent.variants.create(price=Decimal("120.00"), is_active=True, stock=3)
        html = client.get(f"/products/{parent.slug}").content.decode("utf-8")
        assert _ld(html)["offers"]["price"] == "90.00"  # cheapest active variant

    def test_script_injection_in_name_is_escaped(self, client, db):
        Product.objects.create(
            name="X</script><script>alert(1)</script>",
            slug="xss-probe",
            price=Decimal("5.00"),
        )
        html = client.get("/products/xss-probe").content.decode("utf-8")
        # The raw closing tag must not appear inside the JSON-LD payload.
        block = re.search(
            r'application/ld\+json"[^>]*>(.*?)</script>', html, re.DOTALL
        ).group(1)
        assert "</script>" not in block
        assert "\\u003c/script>" in block

    def test_image_urls_are_absolute_and_encoded(self, client, product):
        ProductImage.objects.create(
            product=product, url="/media/products/عود-ملكي-full.webp", sort_order=0
        )
        ld = _ld(client.get(f"/products/{product.slug}").content.decode("utf-8"))
        assert ld["image"][0].startswith("https://nasaeem.ly/media/")
        assert ld["image"][0].isascii()


@pytest.mark.django_db
class TestShellFallback:
    def test_unknown_slug_serves_the_bare_shell(self, client):
        resp = client.get("/products/does-not-exist")
        assert resp.status_code == 200
        assert b"data-seo" not in resp.content  # nothing injected

    def test_non_product_route_serves_the_shell(self, client):
        resp = client.get("/cart")
        assert resp.status_code == 200
        assert b"<title>" in resp.content

    def test_homepage_serves_the_shell(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert b'id="root"' in resp.content

    def test_api_routes_are_not_shadowed_by_the_catchall(self, client):
        assert client.get("/api/health/").status_code == 200


@pytest.mark.django_db
class TestRobotsAndSitemap:
    def test_robots_disallows_admin_and_points_at_sitemap(self, client):
        body = client.get("/robots.txt").content.decode("utf-8")
        assert "Disallow: /admin" in body
        assert "Sitemap: https://nasaeem.ly/sitemap.xml" in body

    def test_sitemap_lists_active_products(self, client, product):
        body = client.get("/sitemap.xml").content.decode("utf-8")
        assert body.startswith("<?xml")
        assert "/products/" in body
        assert "https://nasaeem.ly/</loc>" in body

    def test_sitemap_omits_inactive_products(self, client, product):
        product.is_active = False
        product.save(update_fields=["is_active"])
        body = client.get("/sitemap.xml").content.decode("utf-8")
        from urllib.parse import quote

        assert quote(product.slug, safe="") not in body
