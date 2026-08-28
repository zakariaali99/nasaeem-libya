from django.urls import path

from . import views

urlpatterns = [
    # The cart is public: a guest holds one. Auth is required at checkout only.
    path("cart/", views.CartView.as_view(), name="cart"),
    path("cart/details/", views.CartDetailsView.as_view(), name="cart-details"),
    path("cart/checkout/", views.CartCheckoutView.as_view(), name="cart-checkout"),
    path("cart/promotions/active/", views.ActiveCartPromotionView.as_view(), name="active-cart-promotion"),
    path("cart/<uuid:item_id>/", views.CartItemView.as_view(), name="cart-item"),

    path("checkout/", views.CheckoutConfirmView.as_view(), name="checkout-confirm"),
    path("checkout/<uuid:order_id>/", views.CheckoutStateView.as_view(), name="checkout-state"),

    path("orders/", views.OrderListView.as_view(), name="order-list"),
    path("orders/<str:lookup>/", views.OrderDetailView.as_view(), name="order-detail"),

    path("discounts/", views.DiscountListView.as_view(), name="discount-list"),
    path("discounts/<uuid:discount_id>/", views.DiscountDetailView.as_view(), name="discount-detail"),

    path("admin/discounts/", views.AdminDiscountCreateView.as_view(), name="admin-discount-create"),
    path("admin/discounts/<uuid:discount_id>/", views.DiscountDetailView.as_view(), name="admin-discount-detail"),
    path("admin/cart-promotions/", views.AdminCartPromotionView.as_view(), name="admin-cart-promotions"),
    path("admin/dashboard/", views.DashboardStatsView.as_view(), name="admin-dashboard"),
    path("admin/analytics/executive/", views.ExecutiveAnalyticsView.as_view(), name="admin-analytics-executive"),

    # Plan 01 — Operational Velocity & Quick Order Entry
    path("admin/orders/quick-create/", views.AdminQuickOrderCreateView.as_view(), name="admin-quick-order-create"),
    path("admin/customers/lookup/", views.AdminCustomerLookupView.as_view(), name="admin-customer-lookup"),
    path("admin/orders/bulk-action/", views.AdminBulkOrderActionView.as_view(), name="admin-bulk-order-action"),

    # Plan 02 — Thermal Waybills & Official Invoicing Suite
    path("admin/orders/<str:lookup>/waybill/", views.AdminOrderWaybillView.as_view(), name="admin-order-waybill"),
    path("admin/orders/<str:lookup>/invoice/", views.AdminOrderInvoiceView.as_view(), name="admin-order-invoice"),
    path("admin/orders/batch-waybills/", views.AdminBatchWaybillsView.as_view(), name="admin-batch-waybills"),

    # Plan 08 — VIP Loyalty Engine & Abandoned Cart Recovery
    path("loyalty/me/", views.LoyaltySummaryView.as_view(), name="loyalty-me"),
    path("orders/loyalty/me/", views.LoyaltySummaryView.as_view(), name="orders-loyalty-me"),
    path("admin/marketing/abandoned-carts/", views.AdminAbandonedCartsView.as_view(), name="admin-abandoned-carts"),
    path("admin/marketing/abandoned-carts/<uuid:pk>/send-whatsapp/", views.AdminSendAbandonedCartWhatsAppView.as_view(), name="admin-abandoned-cart-send-wa"),
    path("admin/marketing/abandoned-carts/<uuid:pk>/mark-recovered/", views.AdminMarkAbandonedCartRecoveredView.as_view(), name="admin-abandoned-cart-mark-recovered"),
    path("orders/admin/marketing/abandoned-carts/", views.AdminAbandonedCartsView.as_view(), name="orders-admin-abandoned-carts"),
    path("orders/admin/marketing/abandoned-carts/<uuid:pk>/send-whatsapp/", views.AdminSendAbandonedCartWhatsAppView.as_view(), name="orders-admin-abandoned-cart-send-wa"),
    path("orders/admin/marketing/abandoned-carts/<uuid:pk>/mark-recovered/", views.AdminMarkAbandonedCartRecoveredView.as_view(), name="orders-admin-abandoned-cart-mark-recovered"),
]
