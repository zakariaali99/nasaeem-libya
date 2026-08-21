"""Identity and geography model behaviour."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.db import IntegrityError
from django.utils import timezone

from apps.core.models import ADMIN_ROLES, City, Role, User, UserAddress

pytestmark = pytest.mark.django_db


class TestUser:
    def test_password_is_hashed_never_plaintext(self, customer):
        customer.refresh_from_db()
        assert customer.password != "CorrectHorse9"
        assert customer.password.startswith("pbkdf2_sha256$")
        assert customer.check_password("CorrectHorse9")

    def test_phone_number_is_the_username_field(self):
        assert User.USERNAME_FIELD == "phone_number"

    def test_phone_number_is_unique(self, customer):
        with pytest.raises(IntegrityError):
            User.objects.create_user(phone_number="0911111111", password="Another9xy")

    def test_create_user_requires_a_phone_number(self):
        with pytest.raises(ValueError):
            User.objects.create_user(phone_number="", password="Whatever9x")

    def test_superuser_gets_owner_role_and_staff_flags(self, owner):
        assert owner.role == Role.OWNER
        assert owner.is_staff and owner.is_superuser
        assert owner.is_admin_role

    def test_customer_is_not_an_admin_role(self, customer):
        assert customer.role == Role.CUSTOMER
        assert not customer.is_admin_role
        assert Role.CUSTOMER not in ADMIN_ROLES

    def test_ban_without_expiry_is_permanent(self, customer):
        customer.banned = True
        assert customer.is_banned

    def test_ban_with_a_future_expiry_is_live(self, customer):
        customer.banned = True
        customer.ban_expires_at = timezone.now() + timedelta(days=1)
        assert customer.is_banned

    def test_ban_with_a_past_expiry_has_lapsed(self, customer):
        customer.banned = True
        customer.ban_expires_at = timezone.now() - timedelta(days=1)
        assert not customer.is_banned

    def test_email_may_be_null_for_many_users(self):
        """Unique-but-nullable: a phone-only store must not collide on empty email."""
        User.objects.create_user(phone_number="0921111111", password="Password9x")
        User.objects.create_user(phone_number="0922222222", password="Password9x")
        assert User.objects.filter(email__isnull=True).count() == 2


class TestGeography:
    def test_region_fee_wins_when_set(self, region):
        assert region.effective_delivery_fee == Decimal("5.00")

    def test_region_falls_back_to_the_city_fee(self, region_without_fee):
        assert region_without_fee.effective_delivery_fee == Decimal("15.00")

    def test_city_name_is_unique(self, city):
        with pytest.raises(IntegrityError):
            City.objects.create(id="other", name="طرابلس", code="OTH")

    def test_address_region_is_protected(self, customer, region):
        """Deleting a region must not silently orphan a saved address."""
        from django.db.models import ProtectedError

        UserAddress.objects.create(user=customer, region=region, address="شارع النصر")
        with pytest.raises(ProtectedError):
            region.delete()
