from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf/", views.csrf, name="auth-csrf"),
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("me/change-password/", views.ChangePasswordView.as_view(), name="me-change-password"),
    path("me/addresses/", views.AddressListCreateView.as_view(), name="me-addresses"),
    path("me/addresses/<uuid:address_id>/", views.AddressDetailView.as_view(), name="me-address-detail"),
    path("admin/users/", views.AdminUserListView.as_view(), name="admin-users"),
    path("admin/users/<uuid:user_id>/", views.AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<uuid:user_id>/reset-password/", views.AdminUserResetPasswordView.as_view(), name="admin-user-reset-password"),
    # The customer file (CRM). Every path is by id.
    path("admin/customers/", views.AdminCustomerListView.as_view(), name="admin-customers"),
    path("admin/customers/birthdays/", views.AdminCustomerBirthdaysView.as_view(), name="admin-customer-birthdays"),
    path("admin/customers/export.csv", views.AdminCustomerExportView.as_view(), name="admin-customers-export"),
    path("admin/customers/<uuid:user_id>/", views.AdminCustomerProfileView.as_view(), name="admin-customer-profile"),
    path("admin/customers/<uuid:user_id>/interactions/", views.AdminCustomerInteractionsView.as_view(), name="admin-customer-interactions"),
    path("admin/customers/<uuid:user_id>/interactions/<uuid:interaction_id>/", views.AdminCustomerInteractionDetailView.as_view(), name="admin-customer-interaction-detail"),
    path("admin/customers/<uuid:user_id>/whatsapp/", views.AdminCustomerWhatsAppView.as_view(), name="admin-customer-whatsapp"),
    path("admin/customer-tags/", views.AdminCustomerTagListView.as_view(), name="admin-customer-tags"),
    path("admin/customer-tags/<uuid:tag_id>/", views.AdminCustomerTagDetailView.as_view(), name="admin-customer-tag-detail"),
    path("admin/staff/", views.AdminStaffListView.as_view(), name="admin-staff-list"),
    path("admin/staff/<uuid:user_id>/", views.AdminStaffDetailView.as_view(), name="admin-staff-detail"),
]