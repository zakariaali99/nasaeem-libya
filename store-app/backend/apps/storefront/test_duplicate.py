import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.core.models import User
from apps.storefront.models import StorefrontLayout, Widget, WidgetType

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(db):
    return User.objects.create_user(
        phone_number="0911234567",
        password="OwnerPass9x",
        name="مالك المتجر",
        role="owner",
    )


@pytest.fixture
def admin_api(owner):
    client = APIClient()
    client.post(
        reverse("auth-login"),
        {"phone_number": owner.phone_number, "password": "OwnerPass9x"},
        format="json",
    )
    return client


def test_layout_duplicate(admin_api):
    layout = StorefrontLayout.objects.create(name="تخطيط رمضان الأصلي")
    Widget.objects.create(
        layout=layout,
        type=WidgetType.ANNOUNCEMENT_BAR,
        data={"title": "أهلاً رمضان", "message": "خصومات حصرية"},
        order=0,
    )

    url = reverse("admin-layout-duplicate", args=[layout.id])
    res = admin_api.post(url)
    assert res.status_code == 201
    new_data = res.json()["data"]
    assert "تخطيط رمضان الأصلي (نسخة)" in new_data["name"]
    assert len(new_data["widgets"]) == 1
    assert new_data["widgets"][0]["type"] == "announcement_bar"
