"""Core identity and geography models.

`User` lands in Phase 0 rather than Phase 1 because `AUTH_USER_MODEL` points at
it — `manage.py migrate` cannot run on a clean database without it, and running
migrate on a clean database is a Phase 0 gate. The remaining core models
(City, Region, UserAddress) arrived in Phase 1.
"""

import uuid
from decimal import Decimal

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.contrib.auth.base_user import BaseUserManager
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    CUSTOMER = "customer", "عميل"
    STAFF = "staff", "موظف"
    MANAGER = "manager", "مشرف"
    ADMIN = "admin", "مدير"
    OWNER = "owner", "مالك"


ADMIN_ROLES = frozenset({Role.STAFF, Role.MANAGER, Role.ADMIN, Role.OWNER})


class UserManager(BaseUserManager):
    """Creates users through `set_password()`. Never stores a plaintext password."""

    use_in_migrations = True

    def _create_user(self, phone_number, password, **extra):
        if not phone_number:
            raise ValueError("رقم الهاتف مطلوب")
        email = extra.pop("email", None)
        user = self.model(
            phone_number=phone_number,
            email=self.normalize_email(email) if email else None,
            **extra,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone_number, password=None, **extra):
        extra.setdefault("role", Role.CUSTOMER)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._create_user(phone_number, password, **extra)

    def create_superuser(self, phone_number, password=None, **extra):
        extra.setdefault("role", Role.OWNER)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        if extra["is_staff"] is not True:
            raise ValueError("المستخدم الخارق يجب أن يكون is_staff=True")
        if extra["is_superuser"] is not True:
            raise ValueError("المستخدم الخارق يجب أن يكون is_superuser=True")
        return self._create_user(phone_number, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phone_number = models.CharField(
        "رقم الهاتف", max_length=32, unique=True, db_index=True
    )
    phone_verified = models.BooleanField("تم التحقق من الهاتف", default=False)
    name = models.CharField("الاسم", max_length=255, blank=True)
    email = models.EmailField(
        "البريد الإلكتروني", blank=True, null=True, unique=True, default=None
    )
    role = models.CharField(
        "الدور", max_length=20, choices=Role.choices, default=Role.CUSTOMER
    )
    is_active = models.BooleanField("نشط", default=True)
    is_staff = models.BooleanField("موظف", default=False)
    banned = models.BooleanField("محظور", default=False)
    ban_reason = models.TextField("سبب الحظر", blank=True)
    ban_expires_at = models.DateTimeField("ينتهي الحظر في", null=True, blank=True)
    date_joined = models.DateTimeField("تاريخ التسجيل", default=timezone.now)
    legacy_id = models.CharField(
        max_length=64, null=True, blank=True, unique=True, editable=False, default=None
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "مستخدم"
        verbose_name_plural = "المستخدمون"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.name or 'مستخدم'} ({self.phone_number})"

    @property
    def is_banned(self):
        """A ban with no expiry is permanent; one with a future expiry is live."""
        if not self.banned:
            return False
        if self.ban_expires_at is None:
            return True
        return self.ban_expires_at > timezone.now()

    @property
    def is_admin_role(self):
        return self.role in ADMIN_ROLES


class City(models.Model):
    """Libyan city. The id is a courier-supplied string, not a UUID — cities are
    synced from the delivery providers and keyed by their identifiers."""

    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField("المدينة", max_length=100, unique=True, db_index=True)
    code = models.CharField("الرمز", max_length=50, unique=True)
    delivery_fee = models.DecimalField(
        "رسوم التوصيل", max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "مدينة"
        verbose_name_plural = "المدن"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Region(models.Model):
    """A district within a city. The delivery fee comes from the region first,
    falling back to the city."""

    id = models.CharField(primary_key=True, max_length=64)
    name = models.CharField("المنطقة", max_length=100)
    city = models.ForeignKey(
        City, on_delete=models.CASCADE, related_name="regions", verbose_name="المدينة"
    )
    delivery_fee = models.DecimalField(
        "رسوم التوصيل", max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    estimated_delivery_days = models.IntegerField(
        "أيام التوصيل المتوقعة", null=True, blank=True
    )
    is_active = models.BooleanField("نشط", default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "منطقة"
        verbose_name_plural = "المناطق"
        ordering = ["city__name", "name"]

    def __str__(self):
        return f"{self.name} — {self.city.name}"

    @property
    def effective_delivery_fee(self):
        """Region fee when set, otherwise the city's. One place decides this."""
        return self.delivery_fee if self.delivery_fee else self.city.delivery_fee


class UserAddress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name="addresses", verbose_name="المستخدم"
    )
    # PROTECT: deleting a region must never silently orphan a customer's address.
    region = models.ForeignKey(
        Region, on_delete=models.PROTECT, related_name="addresses", verbose_name="المنطقة"
    )
    address = models.TextField("العنوان")
    is_default = models.BooleanField("العنوان الافتراضي", default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "عنوان"
        verbose_name_plural = "العناوين"
        ordering = ["-is_default", "-created_at"]

    def __str__(self):
        return f"{self.user.phone_number} — {self.region.name}"
