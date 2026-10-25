"""`make_mobile_copies`: the phone copy for banners uploaded before uploads made one."""

from io import StringIO

import pytest
from django.core.management import call_command
from PIL import Image

from apps.storefront.models import StorefrontLayout, Widget, WidgetType

pytestmark = pytest.mark.django_db


def _run(*args):
    out = StringIO()
    call_command("make_mobile_copies", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def old_banner(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    settings.MEDIA_URL = "/media/"
    (tmp_path / "banners").mkdir()
    full = tmp_path / "banners" / "summer-full.webp"
    Image.new("RGB", (1920, 640), (109, 155, 31)).save(full, "WEBP")
    # A banner that already has its phone copy is left alone.
    Image.new("RGB", (1920, 640)).save(tmp_path / "banners" / "new-full.webp", "WEBP")
    Image.new("RGB", (1080, 360)).save(tmp_path / "banners" / "new-mobile.webp", "WEBP")

    layout = StorefrontLayout.objects.create(name="الافتراضي", is_global_active=True)
    Widget.objects.create(layout=layout, type=WidgetType.CAROUSEL, order=1, data={"slides": [
        {"imageUrl": "/media/banners/summer-full.webp"},
        {"imageUrl": "/media/banners/new-full.webp"},
        {"imageUrl": "https://example.com/elsewhere-full.webp"},
    ]})
    return tmp_path / "banners"


def test_a_report_only_counts_and_writes_nothing(old_banner):
    out = _run()
    assert "بلا نسخة جوال: 1" in out
    assert "summer-full.webp" in out
    assert not (old_banner / "summer-mobile.webp").exists()


def test_apply_makes_the_1080px_copy_and_a_second_run_does_nothing(old_banner):
    before = (old_banner / "summer-full.webp").read_bytes()
    assert "صُنعت 1" in _run("--apply")
    with Image.open(old_banner / "summer-mobile.webp") as copy:
        assert copy.size == (1080, 360)
    assert (old_banner / "summer-full.webp").read_bytes() == before
    assert "لا شيء لعمله" in _run("--apply")
    slide = Widget.objects.get().data["slides"][0]
    assert slide["mobileSrc"] == "/media/banners/summer-mobile.webp"


def test_a_banner_already_small_is_left_as_it_is(old_banner):
    Image.new("RGB", (1200, 800)).save(old_banner / "small-full.webp", "WEBP")
    widget = Widget.objects.get()
    widget.data["slides"].append({"imageUrl": "/media/banners/small-full.webp"})
    widget.save()
    _run("--apply")
    assert not (old_banner / "small-mobile.webp").exists()
