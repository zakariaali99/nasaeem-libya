from django.urls import path

from . import views

urlpatterns = [
    path("delivery/methods/", views.DeliveryMethodListView.as_view(), name="delivery-methods"),
    path("delivery/cities/", views.CityListView.as_view(), name="delivery-cities"),
    path("delivery/cities/<str:city_id>/", views.CityDetailView.as_view(), name="delivery-city"),
    path("delivery/cities/<str:city_id>/regions/", views.CityRegionsView.as_view(),
         name="delivery-city-regions"),
    path("delivery/regions/<str:region_id>/", views.RegionDetailView.as_view(),
         name="delivery-region"),
    path("geo/", views.GeoView.as_view(), name="geo"),

    path("admin/orders/<uuid:order_id>/shipment/", views.AdminShipmentCreateView.as_view(),
         name="admin-shipment-create"),
]
