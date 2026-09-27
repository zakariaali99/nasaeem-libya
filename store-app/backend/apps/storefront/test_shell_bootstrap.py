"""The SPA shell inlines store settings + first-paint data. These guard the
failure modes found in review: a UUID in the payload silently dropped the whole
block, categories were flat instead of the API's tree, and the hero preload
made phones download the desktop banner."""
import json
import re

import pytest

from apps.catalog.models import Category
from apps.storefront.models import StorefrontLayout, Widget
from apps.storefront.spa import render_shell


def _script_value(html, name):
    match = re.search(rf"window\.{name} = (.*?);</script>", html)
    assert match, f"{name} missing from the shell"
    return json.loads(match.group(1))


@pytest.mark.django_db
def test_subcategories_do_not_drop_the_bootstrap_and_come_as_a_tree(rf):
    parent = Category.objects.create(name="رجالي", slug="رجالي")
    Category.objects.create(name="عود", slug="عود", parent=parent)

    html = render_shell(rf.get("/"), path="").content.decode()

    assert "whatsapp" in _script_value(html, "__STORE_SETTINGS__")
    categories = _script_value(html, "__BOOTSTRAP__")["categories"]
    assert [c["name"] for c in categories] == ["رجالي"]
    assert [c["name"] for c in categories[0]["children"]] == ["عود"]


@pytest.mark.django_db
def test_the_hero_is_preloaded_once_per_breakpoint(rf):
    layout = StorefrontLayout.objects.create(name="الرئيسية", is_global_active=True)
    Widget.objects.create(layout=layout, type="hero_cta", data={
        "desktopImageUrl": "/media/banners/hero-desktop.webp",
        "mobileImageUrl": "/media/banners/hero-mobile.webp",
    })

    html = render_shell(rf.get("/"), path="").content.decode()
    preloads = re.findall(r'<link rel="preload" as="image"[^>]*>', html)

    assert len(preloads) == 2
    mobile = next(tag for tag in preloads if "max-width: 640px" in tag)
    desktop = next(tag for tag in preloads if "min-width: 641px" in tag)
    assert 'href="/media/banners/hero-mobile-full.webp"' in mobile
    assert 'href="/media/banners/hero-desktop.webp"' in desktop


@pytest.mark.django_db
def test_legacy_jpg_banners_are_preloaded_as_is(rf):
    """A JPG that `optimize_media` has not converted has no renditions."""
    layout = StorefrontLayout.objects.create(name="الرئيسية", is_global_active=True)
    Widget.objects.create(layout=layout, type="hero_cta", data={
        "desktopImageUrl": "/media/banners/hero-desktop.jpg",
        "mobileImageUrl": "/media/banners/hero-mobile.jpg",
    })

    html = render_shell(rf.get("/"), path="").content.decode()
    assert 'href="/media/banners/hero-mobile.jpg"' in html
    assert "hero-mobile-full" not in html


def test_rendition_url_only_derives_for_uploaded_webp():
    from apps.catalog.services import rendition_url

    assert rendition_url("/media/products/x-full.webp", "medium") == "/media/products/x-medium.webp"
    assert rendition_url("/media/banners/hero.webp", "full") == "/media/banners/hero-full.webp"
    assert rendition_url("/media/banners/hero.jpg", "full") == "/media/banners/hero.jpg"
    assert rendition_url("https://cdn.example.com/a.webp", "full") == "https://cdn.example.com/a.webp"


@pytest.mark.django_db
def test_dotfiles_and_the_stale_dist_media_are_not_served(client, settings):
    settings.ALLOWED_HOSTS = ["*"]
    assert client.get("/.htaccess").status_code == 404
    assert client.get("/.DS_Store").status_code == 404
