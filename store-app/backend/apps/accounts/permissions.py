"""Role permissions. Admin endpoints are gated on the role, never on `is_staff`
alone — a customer must never reach an admin endpoint."""

from rest_framework.permissions import BasePermission

from apps.core.models import ADMIN_ROLES


class IsAdminRole(BasePermission):
    """staff · manager · admin · owner."""

    message = "ليس لديك صلاحية للقيام بهذا الإجراء"

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and not user.is_banned
            and user.role in ADMIN_ROLES
        )
