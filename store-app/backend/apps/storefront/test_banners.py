"""Banner data: heights, focus points, phone pictures and the 1080px copy."""

import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.catalog.services import store_image
from apps.storefront.services import normalise_widget_data

pytestmark = pytest.mark.django_db


def png(width, height):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (40, 30, 60)).save(buffer, "PNG")
    return SimpleUploadedFile("b.png", buffer.getvalue(), content_type="image/png")


def test_older_slider_shapes_become_a_band_and_auto_stays_auto():
    assert normalise_widget_data("carousel", {"carouselStyle": "hero"})["bannerHeight"] == "band"
    assert normalise_widget_data("carousel", {"carouselStyle": "normal"})["bannerHeight"] == "band"
    assert normalise_widget_data("carousel", {"carouselStyle": "auto"})["bannerHeight"] == "auto"
    assert normalise_widget_data("carousel", {"bannerHeight": "full"})["bannerHeight"] == "full"


def test_a_slide_keeps_focus_and_text_settings_within_bounds():
    data = normalise_widget_data("carousel", {"slides": [{
        "imageUrl": "/media/banners/x-full.webp", "focusX": 140, "focusY": -5,
        "textAlign": "sideways", "overlay": 300, "textOnMobile": False,
    }]})
    slide = data["slides"][0]
    assert (slide["focusX"], slide["focusY"]) == (100, 0)
    assert slide["textAlign"] == "start"
    assert slide["overlay"] == 80
    assert slide["textOnMobile"] is False


def test_a_phone_only_slide_is_kept():
    data = normalise_widget_data("carousel", {"slides": [{"mobileImageUrl": "/media/banners/m-full.webp"}]})
    assert data["slides"][0]["imageUrl"] == "/media/banners/m-full.webp"


def test_an_uploaded_banner_gets_a_1080px_phone_copy(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    url = store_image(png(1920, 640), subdir="banners", full_size=1920, extra_renditions={"mobile": 1080})
    data = normalise_widget_data("carousel", {"slides": [{"imageUrl": url}]})
    phone = data["slides"][0]["mobileSrc"]
    assert phone.endswith("-mobile.webp")
    with Image.open(tmp_path / phone.removeprefix(settings.MEDIA_URL)) as copy:
        assert copy.size == (1080, 360)


def test_without_a_phone_copy_on_disk_mobile_src_is_empty():
    data = normalise_widget_data("carousel", {"slides": [{"imageUrl": "/media/banners/gone-full.webp"}]})
    assert data["slides"][0]["mobileSrc"] == ""
