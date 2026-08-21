from django.contrib import admin

from .models import Payment


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ("order", "method_code", "status", "amount", "verified_at", "created_at")
    list_filter = ("status", "method_code", "created_at")
    search_fields = ("order__order_number", "reference_id")
    readonly_fields = ("id", "provider_payload", "created_at", "updated_at")
    autocomplete_fields = ("order",)
