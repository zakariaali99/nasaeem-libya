from django.urls import path

from . import views

urlpatterns = [
    path("auth/csrf/", views.csrf, name="auth-csrf"),
    path("auth/register/", views.RegisterView.as_view(), name="auth-register"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", views.MeView.as_view(), name="auth-me"),
    path("me/addresses/", views.AddressListCreateView.as_view(), name="me-addresses"),
    path("me/addresses/<uuid:address_id>/", views.AddressDetailView.as_view(), name="me-address-detail"),
    path("admin/users/", views.AdminUserListView.as_view(), name="admin-users"),
    path(
        "auth/password-reset/request/",
        views.PasswordResetRequestView.as_view(),
        name="auth-password-reset-request",
    ),
    path(
        "auth/password-reset/confirm/",
        views.PasswordResetConfirmView.as_view(),
        name="auth-password-reset-confirm",
    ),
    path("admin/users/<uuid:user_id>/", views.AdminUserDetailView.as_view(), name="admin-user-detail"),
]