"""Auth serializers.

Two rules govern every message in this file:

1. **No user-enumeration oracle.** An unknown phone and a wrong password produce
   byte-identical responses. Registration with a taken number produces a generic
   message too.
2. **A session is only ever issued by `authenticate()`.** Nothing here looks a
   user up by phone and logs them in. The reference system did exactly that and
   it was a total authentication bypass.
"""

from decimal import Decimal

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.core.models import User

from .phone import INVALID_PHONE, normalise_phone

from django.utils.translation import gettext_lazy as _

# The single credential-failure message. Login uses it for every failure mode:
# unknown phone, wrong password, banned, inactive.
INVALID_CREDENTIALS = _("رقم الهاتف أو كلمة المرور غير صحيحة")
PHONE_TAKEN = _("تعذّر إنشاء الحساب بهذا الرقم")


class PhoneField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        phone = normalise_phone(value)
        if phone is None:
            raise serializers.ValidationError(INVALID_PHONE)
        return phone


class CustomerTagSerializer(serializers.ModelSerializer):
    class Meta:
        from apps.core.models import CustomerTag

        model = CustomerTag
        fields = ["id", "name", "color", "created_at"]
        read_only_fields = ["id", "created_at"]


class CustomerInteractionSerializer(serializers.ModelSerializer):
    staff_name = serializers.SerializerMethodField()
    interaction_type_display = serializers.CharField(source="get_interaction_type_display", read_only=True)

    class Meta:
        from apps.core.models import CustomerInteraction

        model = CustomerInteraction
        fields = [
            "id", "customer", "staff", "staff_name",
            "interaction_type", "interaction_type_display",
            "notes", "created_at",
        ]
        read_only_fields = ["id", "customer", "staff", "staff_name", "interaction_type_display", "created_at"]

    def get_staff_name(self, obj) -> str:
        if obj.staff:
            return obj.staff.name or obj.staff.phone_number
        return "النظام"


class UserSerializer(serializers.ModelSerializer):
    tags = CustomerTagSerializer(many=True, read_only=True)
    crm = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "phone_number", "phone_verified", "name", "email",
            "role", "is_active", "date_joined", "birthday", "tags", "crm",
            "loyalty_points", "lifetime_spend", "vip_tier",
            "is_cod_blacklisted", "cod_rejections_count", "cod_blacklist_reason",
            "banned", "ban_reason", "ban_expires_at",
        ]
        read_only_fields = fields

    def get_crm(self, obj):
        from django.utils import timezone
        from .crm import TIER_LABELS, TIER_SHORT_LABELS, compute_customer_metrics, determine_customer_tier

        if hasattr(obj, "crm_lifetime_spend"):
            spend = getattr(obj, "crm_lifetime_spend", Decimal("0.00"))
            total_orders = getattr(obj, "crm_total_orders", 0)
            last_order = getattr(obj, "crm_last_order_date", None)
            tier = determine_customer_tier(total_orders, spend, last_order)
            today = timezone.localdate()
            is_bday = bool(obj.birthday and obj.birthday.month == today.month and obj.birthday.day == today.day)
            city = getattr(obj, "crm_last_city", None) or ""
            if not city:
                addr = obj.addresses.select_related("city").filter(is_default=True).first() or obj.addresses.select_related("city").first()
                city = addr.city.name if addr and addr.city else ""
            return {
                "total_orders": total_orders,
                "lifetime_spend": f"{Decimal(spend or 0):.2f}",
                "last_order_date": last_order.isoformat() if last_order else None,
                "tier": tier,
                "tier_label": TIER_LABELS.get(tier, tier),
                "tier_short_label": TIER_SHORT_LABELS.get(tier, tier),
                "city": city,
                "is_birthday_today": is_bday,
                "birthday": obj.birthday.isoformat() if obj.birthday else None,
            }
        # Five queries per user otherwise — and this serializer answers every
        # /auth/me/ and login. The figures are computed only where asked for.
        if self.context.get("crm"):
            return compute_customer_metrics(obj)
        return None


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


class AdminUserUpdateSerializer(serializers.ModelSerializer):
    """Role, ban and activation. Password is deliberately absent: an operator
    cannot set another user's password through this endpoint."""

    class Meta:
        model = User
        fields = [
            "role", "is_active", "banned", "ban_reason", "ban_expires_at", "name",
            "birthday", "is_cod_blacklisted", "cod_blacklist_reason",
        ]


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["name", "email", "birthday"]


class AddressSerializer(serializers.ModelSerializer):
    region_name = serializers.SerializerMethodField()
    city_name = serializers.SerializerMethodField()

    class Meta:
        from apps.core.models import UserAddress

        model = UserAddress
        fields = [
            "id", "city", "region", "region_name", "city_name", "address",
            "is_default", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def _city(self, obj):
        return obj.city or (obj.region.city if obj.region_id else None)

    def get_city_name(self, obj) -> str:
        city = self._city(obj)
        return city.name if city else ""

    def get_region_name(self, obj) -> str:
        return obj.region.name if obj.region_id else ""

    def validate(self, attrs):
        instance = self.instance
        region = attrs.get("region", instance.region if instance else None)
        city = attrs.get("city", instance.city if instance else None)
        if "city" in attrs and "region" not in attrs and instance and instance.region_id:
            # the city changed and no region was sent: the old region no longer applies
            if instance.region.city_id != getattr(city, "id", None):
                region = None
                attrs["region"] = None
        if city is None and region is not None:
            city = region.city
            attrs["city"] = city
        if city is None:
            raise serializers.ValidationError({"city": [_("اختر المدينة")]})
        if region is not None and region.city_id != city.id:
            raise serializers.ValidationError({"region": [_("المنطقة لا تتبع المدينة المختارة")]})
        return attrs
