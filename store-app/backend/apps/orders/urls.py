from django.urls import path

from . import views

urlpatterns = [
    # The cart is public: a guest holds one. Auth is required at checkout only.
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/details/", views.CartDetailsView.as_view(), name="cart-details"),
    path("cart/checkout/", views.CartCheckoutView.as_view(), name="cart-checkout"),
    path("cart/<uuid:item_id>/", views.CartItemView.as_view(), name="cart-item"),

    path("checkout/", views.CheckoutConfirmView.as_view(), name="checkout-confirm"),
    path("checkout/<uuid:order_id>/", views.CheckoutStateView.as_view(), name="checkout-state"),

    path("orders/", views.OrderListView.as_view(), name="order-list"),
    path("orders/<str:lookup>/", views.OrderDetailView.as_view(), name="order-detail"),

    path("discounts/", views.DiscountListView.as_view(), name="discount-list"),
    path("discounts/<uuid:discount_id>/", views.DiscountDetailView.as_view(), name="discount-detail"),
]
