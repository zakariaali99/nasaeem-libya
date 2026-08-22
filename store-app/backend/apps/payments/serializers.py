from rest_framework import serializers

from apps.orders.models import PaymentMethodConfiguration


class PublicPaymentMethodSerializer(serializers.ModelSerializer):
    """Safe public representation of payment methods for checkout."""

    class Meta:
        model = PaymentMethodConfiguration
        fields = [
            "id",
            "method_code",
            "display_name",
            "description",
            "is_enabled",
            "sort_order",
        ]


class AdminPaymentMethodSerializer(serializers.ModelSerializer):
    """Full representation of payment gateway configuration for operators."""

    class Meta:
        model = PaymentMethodConfiguration
        fields = [
            "id",
            "method_code",
            "display_name",
            "description",
            "config_data",
            "is_enabled",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "method_code", "created_at", "updated_at"]
