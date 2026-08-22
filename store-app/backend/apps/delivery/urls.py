from django.urls import path

from . import admin_api, views

urlpatterns = [
    path("delivery/methods/", views.DeliveryMethodListView.as_view(), name="delivery-methods"),
    path("delivery/cities/", views.CityListView.as_view(), name="delivery-cities"),
    path("delivery/cities/<str:city_id>/", views.CityDetailView.as_view(), name="delivery-city"),
    path("delivery/cities/<str:city_id>/regions/", views.CityRegionsView.as_view(),
         name="delivery-city-regions"),
    path("delivery/regions/<str:region_id>/", views.RegionDetailView.as_view(),
         name="delivery-region"),
    path("geo/", views.GeoView.as_view(), name="geo"),

    # Admin shipment & courier configuration
    path("admin/orders/<uuid:order_id>/shipment/", views.AdminShipmentCreateView.as_view(),
         name="admin-shipment-create"),
    path("admin/delivery/methods/", admin_api.AdminDeliveryMethodListView.as_view(),
         name="admin-delivery-methods"),
    path("admin/delivery/methods/<str:method_code>/", admin_api.AdminDeliveryMethodDetailView.as_view(),
         name="admin-delivery-method-detail"),
    path("admin/delivery/sync/<str:method_code>/", admin_api.AdminDeliverySyncView.as_view(),
         name="admin-delivery-sync"),
]
