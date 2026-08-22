from django.urls import path

from . import views

urlpatterns = [
    path("payments/", views.PaymentInitiateView.as_view(), name="payment-initiate"),
    path("payments/webhook/<str:method_code>/", views.PaymentWebhookView.as_view(), name="payment-webhook"),
    path("payments/redirect/<uuid:order_id>/", views.PaymentRedirectView.as_view(), name="payment-redirect"),
    path("admin/payments/", views.AdminPaymentListView.as_view(), name="admin-payments-list"),
    path("admin/payments/<uuid:payment_id>/verify/", views.AdminPaymentVerifyView.as_view(), name="admin-payment-verify"),
]
