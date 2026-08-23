from django.urls import path

from . import admin_api

urlpatterns = [
    path("admin/cities/", admin_api.AdminCityListView.as_view(), name="admin-cities"),
    path("admin/cities/<str:city_id>/", admin_api.AdminCityDetailView.as_view(), name="admin-city-detail"),
    path("admin/regions/", admin_api.AdminRegionCreateView.as_view(), name="admin-region-create"),
    path("admin/regions/<str:region_id>/", admin_api.AdminRegionDetailView.as_view(), name="admin-region-detail"),
    path("admin/search/", admin_api.AdminUnifiedSearchView.as_view(), name="admin-unified-search"),
]

