from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import AdminPasswordChangeForm

from .models import City, Region, User, UserAddress


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Phone number is the username. Passwords are only ever set through the
    password form, which calls set_password()."""

    change_password_form = AdminPasswordChangeForm
    ordering = ("-date_joined",)
    list_display = ("phone_number", "name", "role", "is_active", "banned", "date_joined")
    list_filter = ("role", "is_active", "banned", "is_staff", "phone_verified")
    search_fields = ("phone_number", "name", "email")
    readonly_fields = ("id", "legacy_id", "date_joined", "last_login", "created_at", "updated_at")

    fieldsets = (
        (None, {"fields": ("phone_number", "password")}),
        ("المعلومات الشخصية", {"fields": ("name", "email", "phone_verified")}),
        ("الصلاحيات", {"fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("الحظر", {"fields": ("banned", "ban_reason", "ban_expires_at")}),
        ("تواريخ", {"fields": ("date_joined", "last_login", "created_at", "updated_at", "id", "legacy_id")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": ("phone_number", "name", "role", "password1", "password2"),
        }),
    )


class RegionInline(admin.TabularInline):
    model = Region
    extra = 0
    fields = ("id", "name", "delivery_fee", "estimated_delivery_days", "is_active")


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "delivery_fee", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "code")
    inlines = [RegionInline]


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name", "city", "delivery_fee", "estimated_delivery_days", "is_active")
    list_filter = ("is_active", "city")
    search_fields = ("name", "city__name")
    autocomplete_fields = ("city",)


@admin.register(UserAddress)
class UserAddressAdmin(admin.ModelAdmin):
    list_display = ("user", "region", "is_default", "created_at")
    list_filter = ("is_default",)
    search_fields = ("user__phone_number", "address")
    autocomplete_fields = ("user", "region")
