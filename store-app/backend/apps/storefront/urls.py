from django.urls import path

from . import views

urlpatterns = [
    path("storefront/layout/", views.StorefrontLayoutView.as_view(), name="storefront-layout"),
]
