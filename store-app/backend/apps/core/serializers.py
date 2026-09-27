import re
from rest_framework import serializers

from apps.accounts.phone import normalise_phone
from apps.core.models import BankAccount, City, Region, StoreSettings


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ["id", "name", "delivery_fee", "estimated_delivery_days", "is_active"]


class RegionSerializer(serializers.ModelSerializer):
    city_name = serializers.ReadOnlyField(source="city.name")

    class Meta:
        model = Region
        fields = [
            "id",
            "name",
            "city",
            "city_name",
            "delivery_fee",
            "estimated_delivery_days",
            "is_active",
        ]


class StoreSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreSettings
        fields = [
            "store_name",
            "legal_name",
            "legal_name_en",
            "cr_number",
            "address",
            "site_url",
            "phone",
            "whatsapp",
            "email",
            "bank_transfer_note",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]

    def validate_phone(self, value):
        if value:
            norm = normalise_phone(value)
            if not norm:
                raise serializers.ValidationError("رقم الهاتف غير صحيح، مثال: 0912345678")
            return norm
        return value

    def validate_whatsapp(self, value):
        if value:
            norm = normalise_phone(value)
            if not norm:
                raise serializers.ValidationError("رقم الواتساب غير صحيح، مثال: 0912345678")
            return norm
        return value


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccount
        fields = [
            "id",
            "bank_name",
            "branch",
            "account_holder",
            "account_number",
            "iban",
            "is_active",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_account_number(self, value):
        if value:
            cleaned = re.sub(r"\s+", "", str(value))
            if not cleaned.isdigit():
                raise serializers.ValidationError("رقم الحساب يجب أن يحتوي على أرقام فقط")
            return cleaned
        return value

    def validate_iban(self, value):
        if value:
            cleaned = re.sub(r"\s+", "", str(value)).upper()
            if not (cleaned.startswith("LY") and len(cleaned) == 25 and cleaned.isalnum()):
                raise serializers.ValidationError("الآيبان يجب أن يبدأ بـ LY ويتكون من 25 خانة")
            return cleaned
        return value
