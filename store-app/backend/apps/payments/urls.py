from django.urls import path

from . import admin_api, views

urlpatterns = [
    # Public payment methods for checkout
    path("payment_methods/", views.PublicPaymentMethodListView.as_view(), name="payment-methods"),

    # Payment lifecycle & webhooks
    path("payments/", views.PaymentInitiateView.as_view(), name="payment-initiate"),
    path("payments/webhook/<str:method_code>/", views.PaymentWebhookView.as_view(), name="payment-webhook"),
    path("payments/redirect/<uuid:order_id>/", views.PaymentRedirectView.as_view(), name="payment-redirect"),

    # Admin ledger & manual verification
    path("admin/payments/", views.AdminPaymentListView.as_view(), name="admin-payments-list"),
    path("admin/payments/<uuid:payment_id>/verify/", views.AdminPaymentVerifyView.as_view(), name="admin-payment-verify"),

    # Admin payment gateway configuration
    path("admin/payment_methods/", admin_api.AdminPaymentMethodListView.as_view(), name="admin-payment-methods"),
    path("admin/payment_methods/<str:method_code>/", admin_api.AdminPaymentMethodDetailView.as_view(), name="admin-payment-method-detail"),
]
