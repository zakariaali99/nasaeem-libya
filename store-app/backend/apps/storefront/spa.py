"""Server-rendered SEO shell for the SPA.

Rule 1 (`01-architecture.md`) forbids a Node runtime in production, so a crawler
that requests `/products/<slug>` cannot be handed a JS-rendered page. Instead
Django serves the built `index.html` and injects the page's real `<title>`,
`<meta>` description, Open Graph tags and JSON-LD `Product` data before
`</head>`. The bytes a crawler (or `curl`) sees therefore already contain the
product name and price; the SPA hydrates over the same document unchanged.

This is the decision `IMPLEMENTATION.md` left open at Phase 9 — a Django
template endpoint over a build-time prerender — chosen because it needs no
second toolchain and stays correct as prices change.

Only `/products/<slug>` gets product-specific injection. Every other SPA route
is served the shell unchanged: its default title and description (already in
`index.html`) are correct, and there is nothing crawlable to enrich.
"""

from __future__ import annotations

import json
import re
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

from django.conf import settings
from django.http import Http404, HttpResponse
from django.utils.html import escape
from django.views.decorators.cache import cache_control

from apps.catalog.models import Product

_TITLE_RE = re.compile(r"<title>.*?</title>", re.IGNORECASE | re.DOTALL)
_DESC_RE = re.compile(r'<meta\s+name="description"[^>]*>', re.IGNORECASE)
_SITE_NAME = "نسائم ليبيا"


def _index_path() -> Path:
    """First existing shell: the built dist file in production, source in dev."""
    for candidate in settings.SPA_INDEX_CANDIDATES:
        if Path(candidate).is_file():
            return Path(candidate)
    raise Http404("SPA shell not built")


def _read_index_uncached() -> str:
    return _index_path().read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _read_index_cached() -> tuple[float, str]:
    path = _index_path()
    return (path.stat().st_mtime, path.read_text(encoding="utf-8"))


def _read_index() -> str:
    """The shell HTML. Cached in production; re-read every call under DEBUG so
    a running dev server always reflects edits to `index.html`."""
    if settings.DEBUG:
        return _read_index_uncached()
    path = _index_path()
    mtime, html = _read_index_cached()
    if mtime != path.stat().st_mtime:  # rebuilt under us — drop the stale cache
        _read_index_cached.cache_clear()
        _, html = _read_index_cached()
    return html


def _product_path(slug: str) -> str:
    """`/products/<slug>` with the slug percent-encoded, so a Unicode slug
    yields a valid ASCII URL for canonical, og:url and JSON-LD."""
    return "/products/" + quote(slug, safe="")


def _absolute(request, url: str) -> str:
    """A fully-qualified URL. `SITE_URL` is the source of truth for canonical
    origin; `request.build_absolute_uri` only fills in when it is unset."""
    if url.startswith(("http://", "https://")):
        return url
    base = settings.SITE_URL or request.build_absolute_uri("/").rstrip("/")
    return base + ("" if url.startswith("/") else "/") + url


def _display_price(product: Product) -> Decimal | None:
    """The parent price, or the cheapest active variant when the parent has none
    (variant products carry price per variant, not on the parent row)."""
    if product.price is not None:
        return product.price
    prices = [v.price for v in product.variants.all() if v.is_active and v.price is not None]
    return min(prices) if prices else None


def _meta_description(product: Product) -> str:
    text = product.meta_description or product.description or ""
    text = " ".join(text.split())  # collapse whitespace/newlines
    if len(text) > 160:
        text = text[:157].rstrip() + "…"
    return text or f"{product.name} — {_SITE_NAME}."


def _product_head(request, product: Product) -> tuple[str, str, str]:
    """Returns (title, description, head_html) for a product page."""
    title = product.meta_title or f"{product.name} · {_SITE_NAME}"
    description = _meta_description(product)
    url = _absolute(request, _product_path(product.slug))
    price = _display_price(product)

    # `safe="/"` keeps path separators but percent-encodes Unicode filenames,
    # so a product image stored under an Arabic name is a valid ASCII URL.
    images = [
        _absolute(request, quote(img.url, safe="/"))
        for img in product.images.all()
        if img.url
    ]
    in_stock = product.is_in_stock

    # JSON-LD Product + Offer. Built as a dict then json.dumps'd so quoting and
    # escaping are the library's problem, not a template's.
    offer: dict = {
        "@type": "Offer",
        "url": url,
        "priceCurrency": settings.CURRENCY,
        "availability": (
            "https://schema.org/InStock" if in_stock else "https://schema.org/OutOfStock"
        ),
    }
    if price is not None:
        offer["price"] = f"{price:.2f}"

    ld: dict = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": description,
        "url": url,
        "offers": offer,
    }
    if images:
        ld["image"] = images
    if product.sku:
        ld["sku"] = product.sku
    if product.barcode:
        ld["gtin"] = product.barcode

    # `<` is escaped so a name/description containing "</script>" cannot break
    # out of the block. json.dumps already escapes quotes and control chars.
    ld_json = json.dumps(ld, ensure_ascii=False).replace("<", "\\u003c")

    tags = [
        f'<link rel="canonical" href="{escape(url)}" data-seo>',
        '<meta property="og:type" content="product" data-seo>',
        f'<meta property="og:site_name" content="{escape(_SITE_NAME)}" data-seo>',
        f'<meta property="og:title" content="{escape(title)}" data-seo>',
        f'<meta property="og:description" content="{escape(description)}" data-seo>',
        f'<meta property="og:url" content="{escape(url)}" data-seo>',
        '<meta name="twitter:card" content="summary_large_image" data-seo>',
    ]
    if images:
        tags.append(f'<meta property="og:image" content="{escape(images[0])}" data-seo>')
    if price is not None:
        tags.append(
            f'<meta property="product:price:amount" content="{price:.2f}" data-seo>'
        )
        tags.append(
            f'<meta property="product:price:currency" content="{escape(settings.CURRENCY)}" data-seo>'
        )
    tags.append(f'<script type="application/ld+json" data-seo>{ld_json}</script>')

    return title, description, "\n    ".join(tags)


def _apply_head(html: str, *, title: str, description: str, extra: str) -> str:
    """Replace the shell's default title + description, and insert `extra` before
    </head>. Replacing (not appending) keeps exactly one <title> in the source."""
    title_tag = f"<title>{escape(title)}</title>"
    desc_tag = f'<meta name="description" content="{escape(description)}" />'

    html, n = _TITLE_RE.subn(title_tag, html, count=1)
    if n == 0:
        extra = title_tag + "\n    " + extra
    html, n = _DESC_RE.subn(desc_tag, html, count=1)
    if n == 0:
        extra = desc_tag + "\n    " + extra

    return html.replace("</head>", f"    {extra}\n  </head>", 1)


def robots_txt(request):
    """Allow everything except the operator app and the API; point at the map."""
    lines = [
        "User-agent: *",
        "Disallow: /admin",
        "Disallow: /api/",
        "Disallow: /django-admin/",
        "Disallow: /checkout/",
        "Disallow: /me",
        "",
        f"Sitemap: {_absolute(request, '/sitemap.xml')}",
        "",
    ]
    return HttpResponse("\n".join(lines), content_type="text/plain; charset=utf-8")


@cache_control(max_age=3600)
def sitemap_xml(request):
    """A flat sitemap: the storefront landmarks plus every active product.

    Kept deliberately simple — no pagination, no lastmod guesswork beyond the
    product's own `updated_at`. `02-data-model.md` scale (hundreds of products,
    not millions) fits one document comfortably under the 50k-URL limit."""
    urls = [(_absolute(request, p), None) for p in ("/", "/products")]
    for product in (
        Product.objects.filter(is_active=True).order_by("-updated_at").only("slug", "updated_at")
    ):
        lastmod = product.updated_at.date().isoformat() if product.updated_at else None
        urls.append((_absolute(request, _product_path(product.slug)), lastmod))

    body = ['<?xml version="1.0" encoding="UTF-8"?>']
    body.append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    for loc, lastmod in urls:
        body.append("  <url>")
        body.append(f"    <loc>{escape(loc)}</loc>")
        if lastmod:
            body.append(f"    <lastmod>{lastmod}</lastmod>")
        body.append("  </url>")
    body.append("</urlset>")
    return HttpResponse("\n".join(body), content_type="application/xml; charset=utf-8")


@cache_control(no_cache=True)
def render_shell(request, path: str = ""):
    """Catch-all for SPA routes. Product pages get injected SEO; everything else
    gets the shell verbatim (its default head is already correct)."""
    html = _read_index()

    match = re.match(r"^products/(?P<slug>[^/]+)/?$", path)
    if match:
        product = (
            Product.objects.filter(slug=match.group("slug"), is_active=True)
            .prefetch_related("images", "variants")
            .first()
        )
        if product is not None:
            title, description, extra = _product_head(request, product)
            html = _apply_head(html, title=title, description=description, extra=extra)

    return HttpResponse(html, content_type="text/html; charset=utf-8")
