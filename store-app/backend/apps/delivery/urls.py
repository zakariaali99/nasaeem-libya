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

    # Plan 04 — COD Statement Excel Reconciliation & Discrepancy Engine
    path("admin/delivery/reconcile-statement/upload/", admin_api.AdminCODReconcileUploadView.as_view(),
         name="admin-delivery-cod-upload"),
    path("admin/delivery/reconcile-statements/", admin_api.AdminCODReconcileListView.as_view(),
         name="admin-delivery-cod-list"),
    path("admin/delivery/reconcile-statements/<str:statement_id>/", admin_api.AdminCODReconcileDetailView.as_view(),
         name="admin-delivery-cod-detail"),
    path("admin/delivery/reconcile-statements/<str:statement_id>/commit/", admin_api.AdminCODReconcileCommitView.as_view(),
         name="admin-delivery-cod-commit"),

    # Plan 04 — Order Live Tracking Timeline & Multi-Branch Hubs
    path("admin/orders/<str:lookup>/tracking-timeline/", admin_api.AdminOrderTrackingTimelineView.as_view(),
         name="admin-order-tracking-timeline"),
    path("admin/delivery/warehouse-hubs/", admin_api.AdminWarehouseHubListView.as_view(),
         name="admin-delivery-warehouse-hubs"),

    # Public Webhook
    path("delivery/webhook/<str:courier_code>/", admin_api.PublicCourierWebhookView.as_view(),
         name="delivery-courier-webhook"),
]
