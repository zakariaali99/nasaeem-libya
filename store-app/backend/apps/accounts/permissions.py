"""Role permissions. Admin endpoints are gated on granular roles, never on `is_staff`
alone — a customer must never reach an admin endpoint.
"""

from rest_framework.permissions import BasePermission

from apps.core.models import Role, ADMIN_ROLES


class IsAdminRole(BasePermission):
    """Any administrative role (support, staff, manager, admin, owner)."""

    message = "ليس لديك صلاحية للقيام بهذا الإجراء"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and not user.is_banned
            and user.role in ADMIN_ROLES
        )


class IsAdminOrOwner(BasePermission):
    """Executive only (Admin or Owner) — for financial ledgers, bank secrets and gateway keys."""

    message = "هذا الإجراء مخصص للمدير التنفيذي ومالك المتجر فقط"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and not user.is_banned
            and user.role in (Role.ADMIN, Role.OWNER)
        )


class IsManagerOrAbove(BasePermission):
    """Manager, Admin, Owner — for discount generation, price edits and promotions."""

    message = "هذا الإجراء مخصص للمشرفين والإدارة فقط"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and not user.is_banned
            and user.role in (Role.MANAGER, Role.ADMIN, Role.OWNER)
        )


class IsStaffOrAbove(BasePermission):
    """Staff (Packer), Manager, Admin, Owner — for packing, shipments and inventory."""

    message = "هذا الإجراء مخصص لموظفي المستودع والإدارة"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and not user.is_banned
            and user.role in (Role.STAFF, Role.MANAGER, Role.ADMIN, Role.OWNER)
        )


class IsSupportOrAbove(BasePermission):
    """Customer Care, Staff, Manager, Admin, Owner — for quick orders and lookups."""

    message = "هذا الإجراء مخصص لخدمة العملاء والإدارة"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and not user.is_banned
            and user.role in ADMIN_ROLES
        )
