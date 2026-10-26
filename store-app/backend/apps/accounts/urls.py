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
    path("admin/users/export/", views.AdminUserExportCSVView.as_view(), name="admin-users-export"),
    path("admin/users/upcoming-birthdays/", views.AdminUpcomingBirthdaysView.as_view(), name="admin-upcoming-birthdays"),
    path("admin/users/<uuid:user_id>/", views.AdminUserDetailView.as_view(), name="admin-user-detail"),
    path("admin/users/<uuid:user_id>/crm/", views.AdminUserCRMDetailView.as_view(), name="admin-user-crm-detail"),
    path("admin/users/<uuid:user_id>/tags/", views.AdminUserTagManageView.as_view(), name="admin-user-tags"),
    path("admin/users/<uuid:user_id>/interactions/", views.AdminUserInteractionListCreateView.as_view(), name="admin-user-interactions"),
    path("admin/users/<uuid:user_id>/reset-password/", views.AdminUserResetPasswordView.as_view(), name="admin-user-reset-password"),
    path("admin/customer-tags/", views.AdminCustomerTagListView.as_view(), name="admin-customer-tags"),
    path("admin/interactions/<uuid:interaction_id>/", views.AdminCustomerInteractionDetailView.as_view(), name="admin-customer-interaction-detail"),
    path("admin/staff/", views.AdminStaffListView.as_view(), name="admin-staff-list"),
    path("admin/staff/<uuid:user_id>/", views.AdminStaffDetailView.as_view(), name="admin-staff-detail"),
]