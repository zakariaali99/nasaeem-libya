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


class PaymentRefundSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    operator_name = serializers.CharField(source="operator.name", read_only=True, default="")

    class Meta:
        from apps.payments.models import PaymentRefund
        model = PaymentRefund
        fields = [
            "id",
            "payment",
            "order",
            "order_number",
            "amount",
            "reason",
            "provider_refund_id",
            "status",
            "operator",
            "operator_name",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["id", "order", "status", "provider_refund_id", "operator", "created_at", "completed_at"]


class LedgerAccountSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.payments.models import LedgerAccount
        model = LedgerAccount
        fields = ["id", "code", "name", "account_type", "balance", "is_active", "created_at", "updated_at"]


class LedgerEntrySerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source="account.code", read_only=True)
    account_name = serializers.CharField(source="account.name", read_only=True)
    account_type = serializers.CharField(source="account.account_type", read_only=True)

    class Meta:
        from apps.payments.models import LedgerEntry
        model = LedgerEntry
        fields = ["id", "account", "account_code", "account_name", "account_type", "entry_type", "amount"]


class LedgerTransactionSerializer(serializers.ModelSerializer):
    entries = LedgerEntrySerializer(many=True, read_only=True)

    class Meta:
        from apps.payments.models import LedgerTransaction
        model = LedgerTransaction
        fields = ["id", "reference_type", "reference_id", "description", "entries", "created_at"]
