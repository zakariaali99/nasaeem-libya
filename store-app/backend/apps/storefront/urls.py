from django.urls import path

from . import admin_api, views

urlpatterns = [
    path("storefront/layout/", views.StorefrontLayoutView.as_view(), name="storefront-layout"),
    path("admin/storefront-layouts/", admin_api.AdminLayoutListView.as_view(), name="admin-layouts"),
    path(
        "admin/storefront-layouts/<uuid:layout_id>/",
        admin_api.AdminLayoutDetailView.as_view(),
        name="admin-layout-detail",
    ),
]
