from django.contrib import admin

from .models import StorefrontLayout, Widget


class WidgetInline(admin.TabularInline):
    model = Widget
    extra = 0
    fields = ("order", "type", "is_active")
    ordering = ("order",)


@admin.register(StorefrontLayout)
class StorefrontLayoutAdmin(admin.ModelAdmin):
    """The operator authors layouts in the React widget builder; this exists for
    inspection and emergency edits."""

    list_display = ("name", "is_global_active", "active_start_date", "active_end_date", "updated_at")
    list_filter = ("is_global_active",)
    search_fields = ("name",)
    inlines = [WidgetInline]


@admin.register(Widget)
class WidgetAdmin(admin.ModelAdmin):
    list_display = ("layout", "type", "order", "is_active")
    list_filter = ("type", "is_active")
    search_fields = ("layout__name",)
