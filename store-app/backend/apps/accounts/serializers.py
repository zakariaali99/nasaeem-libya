"""Auth serializers.

Two rules govern every message in this file:

1. **No user-enumeration oracle.** An unknown phone and a wrong password produce
   byte-identical responses. Registration with a taken number produces a generic
   message too.
2. **A session is only ever issued by `authenticate()`.** Nothing here looks a
   user up by phone and logs them in. The reference system did exactly that and
   it was a total authentication bypass.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.core.models import User

from .phone import INVALID_PHONE, normalise_phone

# The single credential-failure message. Login uses it for every failure mode:
# unknown phone, wrong password, banned, inactive.
INVALID_CREDENTIALS = "رقم الهاتف أو كلمة المرور غير صحيحة"
PHONE_TAKEN = "تعذّر إنشاء الحساب بهذا الرقم"


class PhoneField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        phone = normalise_phone(value)
        if phone is None:
            raise serializers.ValidationError(INVALID_PHONE)
        return phone


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id", "phone_number", "phone_verified", "name", "email",
            "role", "is_active", "date_joined",
        ]
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    phone_number = PhoneField(max_length=32)
    password = serializers.CharField(write_only=True, max_length=128)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True)

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value

    def validate_phone_number(self, value):
        # Generic message: confirming which numbers are registered is an oracle.
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError(PHONE_TAKEN)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            phone_number=validated_data["phone_number"],
            password=validated_data["password"],
            name=validated_data.get("name", ""),
        )


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=32)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate(self, attrs):
        # Normalise without validating the format: an invalid number must fail
        # exactly like a wrong password, not with a different message.
        phone = normalise_phone(attrs.get("phone_number")) or ""

        user = authenticate(
            request=self.context.get("request"),
            phone_number=phone,
            password=attrs.get("password", ""),
        )

        # authenticate() returns None for unknown phone, wrong password, and
        # is_active=False alike. Banned users are rejected here as well.
        if user is None or user.is_banned:
            raise serializers.ValidationError(INVALID_CREDENTIALS)

        attrs["user"] = user
        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=32)


class PasswordResetConfirmSerializer(serializers.Serializer):
    request_id = serializers.CharField(max_length=128)
    code = serializers.CharField(max_length=12)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages)) from exc
        return value


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Role, ban and activation. Password is deliberately absent: an operator
    cannot set another user's password through this endpoint."""

    class Meta:
        model = User
        fields = ["role", "is_active", "banned", "ban_reason", "ban_expires_at", "name"]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "email"]


class AddressSerializer(serializers.ModelSerializer):
    region_name = serializers.CharField(source="region.name", read_only=True)
    city_name = serializers.CharField(source="region.city.name", read_only=True)

    class Meta:
        from apps.core.models import UserAddress

        model = UserAddress
        fields = [
            "id", "region", "region_name", "city_name", "address",
            "is_default", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
