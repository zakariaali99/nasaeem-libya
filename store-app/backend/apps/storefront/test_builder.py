"""The homepage-builder API.

The gate's operator story runs through the browser; these pin the contract the
builder depends on: role enforcement, normalisation on write, and replace-all
widget semantics that cannot leave orphan rows behind.
"""

import pytest
from django.urls import reverse

from apps.storefront.models import StorefrontLayout, Widget, WidgetType

pytestmark = pytest.mark.django_db


@pytest.fixture
def layout(db):
    return StorefrontLayout.objects.create(name="تخطيط اختبار")


@pytest.fixture
def admin_api(db):
    from rest_framework.test import APIClient

    from apps.core.models import Role, User

    User.objects.create_superuser(
        phone_number="0911111111", password="CorrectHorse9", role=Role.OWNER
    )
    client = APIClient()
    client.post(reverse("auth-login"),
                {"phone_number": "0911111111", "password": "CorrectHorse9"},
                format="json")
    return client


@pytest.fixture
def customer_api(db):
    from apps.core.models import User
    from rest_framework.test import APIClient

    User.objects.create_user(phone_number="0916666666", password="CorrectHorse9")
    client = APIClient()
    client.post(reverse("auth-login"),
                {"phone_number": "0916666666", "password": "CorrectHorse9"},
                format="json")
    return client


class TestLayoutBuilderAPI:
    def test_anonymous_and_customers_are_refused(self, api, customer_api, layout):
        assert api.get(reverse("admin-layout-detail", args=[layout.id])).status_code == 401
        assert customer_api.get(reverse("admin-layout-detail", args=[layout.id])).status_code == 403

    def test_widgets_replace_all_and_normalise_on_write(self, admin_api, layout):
        response = admin_api.patch(
            reverse("admin-layout-detail", args=[layout.id]),
            {"widgets": [
                {"type": WidgetType.ANNOUNCEMENT_BAR,
                 "data": {"message": "شحن مجاني", "link_url": "/products"}},
                {"type": "not-a-type", "data": {}},
            ]},
            format="json",
        )
        assert response.status_code == 400
        assert response.json()["errors"]["widgets"]

        response = admin_api.patch(
            reverse("admin-layout-detail", args=[layout.id]),
            {"widgets": [
                {"type": WidgetType.ANNOUNCEMENT_BAR,
                 "data": {"message": "شحن مجاني", "linkUrl": "/products"}},
                {"type": WidgetType.SPACER, "data": {}},
            ]},
            format="json",
        )
        assert response.status_code == 200
        widgets = list(layout.widgets.order_by("order"))
        assert [w.type for w in widgets] == ["announcement_bar", "spacer"]
        # Normalised: aliases collapsed into canonical names.
        assert widgets[0].data["message"] == "شحن مجاني"
        assert widgets[0].data["linkUrl"] == "/products"

    def test_a_second_patch_replaces_without_leaving_orphans(self, admin_api, layout):
        admin_api.patch(
            reverse("admin-layout-detail", args=[layout.id]),
            {"widgets": [{"type": WidgetType.SPACER, "data": {}}]},
            format="json",
        )
        admin_api.patch(
            reverse("admin-layout-detail", args=[layout.id]),
            {"widgets": [{"type": WidgetType.IMAGE, "data": {"imageUrl": "https://x.test/a.webp"}}]},
            format="json",
        )
        assert Widget.objects.filter(layout=layout).count() == 1
        assert Widget.objects.filter(layout=layout).first().type == WidgetType.IMAGE

    def test_scheduling_fields_validate(self, admin_api, layout):
        response = admin_api.patch(
            reverse("admin-layout-detail", args=[layout.id]),
            {"active_days": "not-a-list"},
            format="json",
        )
        assert response.status_code == 400
        response = admin_api.patch(
            reverse("admin-layout-detail", args=[layout.id]),
            {"active_days": [0, 4], "active_start_hour": 9, "active_end_hour": 17},
            format="json",
        )
        assert response.status_code == 200
        layout.refresh_from_db()
        assert layout.active_days == [0, 4]
