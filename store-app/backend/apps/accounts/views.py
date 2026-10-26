"""Auth endpoints.

Every response uses the `{data, message}` envelope from `03-api-contract.md`.
Every error message is Arabic, because the client shows it verbatim.
"""

import logging

from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.db import transaction
from django.db.models import Q
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import User, Role, CustomerTag, CustomerInteraction
from apps.core.pagination import StandardPagination
from apps.core.views import CsrfProtectedAPIView
from django.utils.translation import gettext as _

from .permissions import IsAdminRole, IsManagerOrAbove
from .phone import normalise_phone
from .serializers import (
    AdminUserUpdateSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    AddressSerializer,
    ProfileUpdateSerializer,
    CustomerTagSerializer,
    CustomerInteractionSerializer,
)
from .throttling import LoginThrottle, RegisterThrottle

logger = logging.getLogger(__name__)

# Sent whether or not the phone belongs to an account. Telling the caller that a
# number is unknown is the same oracle the login endpoint refuses to be.


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def csrf(request):
    """Sets the CSRF cookie. The SPA calls this before its first unsafe request."""
    return Response({"data": {"csrfToken": get_token(request)}})


def _capture_guest_session(request):
    """The session key a guest basket would be filed under, if there is one."""
    return request.session.session_key


def _adopt_guest_cart(session_key, user):
    """Fold the guest basket into the user's own, and never let a failure here
    break signing in: a merge problem must not lock someone out of their
    account."""
    if not session_key:
        return
    try:
        from apps.orders.services import merge_guest_cart

        merge_guest_cart(session_key=session_key, user=user)
    except Exception:  # pragma: no cover - defensive
        logger.exception("guest cart merge failed for user=%s", user.pk)


class RegisterView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        guest_session = _capture_guest_session(request)
        django_login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        _adopt_guest_cart(guest_session, user)
        logger.info("account registered phone=%s", user.phone_number)
        return Response(
            {"data": UserSerializer(user).data, "message": "تم إنشاء الحساب بنجاح"},
            status=status.HTTP_201_CREATED,
        )


class LoginView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        # Captured BEFORE django_login: `login()` cycles the session key, and
        # the guest basket is keyed on the old one. Read it afterwards and the
        # cart the customer just filled is orphaned.
        guest_session = _capture_guest_session(request)
        # The session is created here and only here, from an authenticate() result.
        django_login(request, user)
        _adopt_guest_cart(guest_session, user)
        return Response({"data": UserSerializer(user).data, "message": "تم تسجيل الدخول"})


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # flush() deletes the server-side session record, so a replayed cookie
        # authenticates nobody.
        django_logout(request)
        return Response({"data": None, "message": "تم تسجيل الخروج"})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({"data": UserSerializer(request.user).data})

    def patch(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": UserSerializer(request.user).data,
                         "message": "تم تحديث الملف الشخصي"})


class AdminUserDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": UserSerializer(user).data})

    def patch(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if "name" in data and str(data["name"]).strip():
            user.name = str(data["name"]).strip()
            user.save(update_fields=["name", "updated_at"])

        if "phone_number" in data:
            new_phone = str(data["phone_number"]).strip()
            if new_phone and not User.objects.filter(phone_number=new_phone).exclude(pk=user.pk).exists():
                user.phone_number = new_phone
                user.save(update_fields=["phone_number", "updated_at"])

        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data.get("banned") and not user.ban_expires_at:
            serializer.validated_data.setdefault("ban_expires_at", None)
        serializer.save()
        logger.info(
            "admin updated user id=%s by=%s at=%s",
            user.id, request.user.phone_number, timezone.now().isoformat(),
        )
        return Response({"data": UserSerializer(user).data, "message": "تم تحديث بيانات المستخدم بنجاح"})


class AdminUserResetPasswordView(APIView):
    """An administrator sets a customer's password, or (empty) gets a new random
    six-digit one to pass on. There is no shared default: "000000" let anyone
    who knew a customer's number open their account."""
    permission_classes = [IsAdminRole]

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        new_password = str(request.data.get("password", "")).strip()
        if not new_password:
            import secrets

            new_password = f"{secrets.randbelow(10**6):06d}"
        if new_password == "000000":
            return Response(
                {"message": "هذه الكلمة مستخدمة على نطاق واسع ولا يُسمح بها، اختر غيرها"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(new_password) < 6:
            return Response(
                {"message": "كلمة المرور يجب أن تكون 6 خانات على الأقل"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        logger.info(
            "admin reset password for user id=%s by=%s at=%s",
            user.id, request.user.phone_number, timezone.now().isoformat(),
        )
        return Response({
            "message": f"تم تعيين كلمة المرور بنجاح ({new_password})",
            "password": new_password,
        })


class ChangePasswordView(CsrfProtectedAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password", "")
        new_password = str(request.data.get("new_password", "")).strip()

        if len(new_password) < 6:
            return Response(
                {"message": "كلمة المرور الجديدة يجب أن تكون 6 خانات على الأقل"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if request.user.has_usable_password() and not request.user.check_password(current_password):
            return Response(
                {"message": _("كلمة المرور الحالية غير صحيحة")},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password", "updated_at"])
        from django.contrib.auth import update_session_auth_hash
        update_session_auth_hash(request, request.user)

        return Response({"message": _("تم تغيير كلمة المرور بنجاح")})


class AddressListCreateView(CsrfProtectedAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        addresses = request.user.addresses.select_related("city", "region__city").all()
        return Response({"data": AddressSerializer(addresses, many=True).data})

    def post(self, request):
        serializer = AddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if serializer.validated_data.get("is_default"):
                request.user.addresses.update(is_default=False)
            address = serializer.save(user=request.user)
        return Response({"data": AddressSerializer(address).data,
                         "message": _("تم حفظ العنوان")}, status=status.HTTP_201_CREATED)


class AddressDetailView(CsrfProtectedAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, address_id):
        return request.user.addresses.filter(id=address_id).first()

    def patch(self, request, address_id):
        address = self.get_object(request, address_id)
        if address is None:
            return Response({"message": _("العنوان غير موجود")}, status=status.HTTP_404_NOT_FOUND)
        serializer = AddressSerializer(address, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if serializer.validated_data.get("is_default"):
                request.user.addresses.exclude(pk=address.pk).update(is_default=False)
            address = serializer.save()
        return Response({"data": AddressSerializer(address).data, "message": _("تم تحديث العنوان")})

    def delete(self, request, address_id):
        address = self.get_object(request, address_id)
        if address is None:
            return Response({"message": _("العنوان غير موجود")}, status=status.HTTP_404_NOT_FOUND)
        address.delete()
        return Response(status=204)


class AdminUserListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        role = request.query_params.get("role", "").strip()
        if role:
            users = User.objects.filter(role=role)
        else:
            users = User.objects.all()

        from . import crm
        users = crm.filter_and_annotate_users_queryset(users, request.query_params)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(users, request, view=self)
        return paginator.get_paginated_response(UserSerializer(page, many=True).data)


class AdminUserCRMDetailView(APIView):
    """Full CRM customer dossier for CustomerDrawer and User Detail page."""

    permission_classes = [IsAdminRole]

    def get(self, request, user_id):
        user = (
            User.objects.filter(pk=user_id)
            .prefetch_related("tags", "addresses__city")
            .first()
        )
        if user is None:
            return Response(
                {"message": _("المستخدم غير موجود")}, status=status.HTTP_404_NOT_FOUND
            )

        from . import crm
        from apps.orders.models import Discount, Order
        from apps.orders.stage_service import stage_of

        metrics = crm.compute_customer_metrics(user)

        from apps.orders.models import OrderStage
        orders = (
            Order.objects.filter(user=user)
            .select_related("shipping_city")
            .order_by("-created_at")[:15]
        )
        recent_orders = [
            {
                "id": str(o.id),
                "order_number": o.order_number,
                "stage": stage_of(o),
                "stage_label": OrderStage(stage_of(o)).label if stage_of(o) in OrderStage.values else stage_of(o),
                "total": str(o.total),
                "total_amount": str(o.total),
                "city": o.shipping_city.name if o.shipping_city else "",
                "created_at": o.created_at.isoformat(),
            }
            for o in orders
        ]

        interactions = (
            user.interactions.select_related("staff")
            .order_by("-created_at")[:50]
        )

        active_coupons = (
            Discount.objects.filter(is_active=True)
            .values("id", "code", "type", "value", "min_order_amount")[:15]
        )

        return Response({
            "data": {
                "user": UserSerializer(user).data,
                "crm": metrics,
                "recent_orders": recent_orders,
                "interactions": CustomerInteractionSerializer(interactions, many=True).data,
                "active_coupons": list(active_coupons),
            }
        })


class AdminUserExportCSVView(APIView):
    """Export customers list as CSV with UTF-8 BOM. Gated to Manager, Admin, Owner."""

    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        role = request.query_params.get("role", "customer").strip()
        users = User.objects.filter(role=role) if role else User.objects.all()

        from . import crm
        annotated = crm.filter_and_annotate_users_queryset(users, request.query_params)
        return crm.export_customers_csv(annotated)


class AdminCustomerTagListView(APIView):
    """List and create CRM customer tags."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from django.db.models import Count
        tags = CustomerTag.objects.all().annotate(users_count=Count("users")).order_by("name")
        return Response({
            "data": [
                {
                    "id": str(t.id),
                    "name": t.name,
                    "color": t.color,
                    "users_count": t.users_count,
                }
                for t in tags
            ]
        })

    def post(self, request):
        name = str(request.data.get("name") or "").strip()
        color = str(request.data.get("color") or "#64748b").strip()
        if not name:
            return Response(
                {"message": "اسم الوسم مطلوب"}, status=status.HTTP_400_BAD_REQUEST
            )
        tag, created = CustomerTag.objects.get_or_create(
            name=name, defaults={"color": color}
        )
        if not created and color and tag.color != color:
            tag.color = color
            tag.save(update_fields=["color"])
        return Response(
            {"data": CustomerTagSerializer(tag).data, "message": "تم حفظ الوسم بنجاح"},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class AdminUserTagManageView(APIView):
    """Assign or remove a tag from a customer."""

    permission_classes = [IsAdminRole]

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(
                {"message": _("المستخدم غير موجود")}, status=status.HTTP_404_NOT_FOUND
            )

        tag_id = request.data.get("tag_id")
        action = str(request.data.get("action") or "add").strip().lower()
        tag = CustomerTag.objects.filter(pk=tag_id).first()
        if tag is None:
            return Response(
                {"message": "الوسم غير موجود"}, status=status.HTTP_404_NOT_FOUND
            )

        if action == "remove":
            user.tags.remove(tag)
        else:
            user.tags.add(tag)

        return Response({
            "data": CustomerTagSerializer(user.tags.all(), many=True).data,
            "message": "تم تحديث وسوم العميل بنجاح",
        })


class AdminUserInteractionListCreateView(APIView):
    """View and log customer communications/notes."""

    permission_classes = [IsAdminRole]

    def get(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(
                {"message": _("المستخدم غير موجود")}, status=status.HTTP_404_NOT_FOUND
            )
        interactions = user.interactions.select_related("staff").order_by("-created_at")
        return Response({
            "data": CustomerInteractionSerializer(interactions, many=True).data
        })

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response(
                {"message": _("المستخدم غير موجود")}, status=status.HTTP_404_NOT_FOUND
            )

        notes = str(request.data.get("notes") or "").strip()
        interaction_type = str(request.data.get("interaction_type") or "note").strip()

        if not notes:
            return Response(
                {"message": "يرجى كتابة نص الملاحظة أو التواصل"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_types = [c[0] for c in CustomerInteraction.InteractionType.choices]
        if interaction_type not in valid_types:
            interaction_type = CustomerInteraction.InteractionType.NOTE

        interaction = CustomerInteraction.objects.create(
            customer=user,
            staff=request.user,
            interaction_type=interaction_type,
            notes=notes,
        )
        return Response(
            {
                "data": CustomerInteractionSerializer(interaction).data,
                "message": "تم تسجيل التواصل بنجاح",
            },
            status=status.HTTP_201_CREATED,
        )


class AdminCustomerInteractionDetailView(APIView):
    """Manager, Admin, Owner can delete a communication note."""

    permission_classes = [IsManagerOrAbove]

    def delete(self, request, interaction_id):
        interaction = CustomerInteraction.objects.filter(pk=interaction_id).first()
        if interaction is None:
            return Response(
                {"message": "سجل التواصل غير موجود"}, status=status.HTTP_404_NOT_FOUND
            )
        interaction.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUpcomingBirthdaysView(APIView):
    """Upcoming customer birthdays this week (handling year wraparound)."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from . import crm
        birthdays = crm.get_upcoming_birthdays_this_week()
        return Response({"data": birthdays})


class AdminStaffListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        staff_roles = [Role.SUPPORT, Role.STAFF, Role.MANAGER, Role.ADMIN, Role.OWNER]
        qs = User.objects.filter(Q(role__in=staff_roles) | Q(is_staff=True)).order_by("-date_joined")

        if search := request.query_params.get("search", "").strip():
            qs = qs.filter(
                Q(phone_number__icontains=search) | Q(name__icontains=search) | Q(email__icontains=search)
            )

        if role := request.query_params.get("role", "").strip():
            qs = qs.filter(role=role)

        data = UserSerializer(qs, many=True).data
        return Response({"items": data, "total": len(data)})

    def post(self, request):
        # Only admin or owner can create new staff
        if request.user.role not in (Role.ADMIN, Role.OWNER) and not request.user.is_superuser:
            return Response(
                {"error": "فقط مدير النظام يمكنه إنشاء حسابات موظفين جديدة."},
                status=status.HTTP_403_FORBIDDEN,
            )

        phone = request.data.get("phone_number", "").strip()
        name = request.data.get("name", "").strip()
        email = request.data.get("email", "").strip() or None
        role = request.data.get("role", Role.STAFF).strip()
        password = request.data.get("password", "").strip()

        if not phone or not password or not name:
            return Response(
                {"error": "الاسم، ورقم الهاتف، وكلمة المرور مطلوبة لإنشاء حساب الموظف."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(phone_number=phone).exists():
            return Response(
                {"error": "رقم الهاتف مسجل مسبقاً في النظام."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if email and User.objects.filter(email=email).exists():
            return Response(
                {"error": "البريد الإلكتروني مسجل مسبقاً."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_roles = [Role.SUPPORT, Role.STAFF, Role.MANAGER, Role.ADMIN]
        if role not in valid_roles:
            role = Role.STAFF

        user = User.objects.create(
            phone_number=phone,
            name=name,
            email=email,
            role=role,
            is_staff=True,
            is_active=True,
            phone_verified=True,
        )
        user.set_password(password)
        user.save()

        logger.info("New staff created id=%s phone=%s by=%s", user.id, user.phone_number, request.user.phone_number)
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class AdminStaffDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, user_id):
        if request.user.role not in (Role.ADMIN, Role.OWNER) and not request.user.is_superuser:
            return Response(
                {"error": "فقط مدير النظام يمكنه تعديل حسابات وصلاحيات الموظفين."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = User.objects.filter(pk=user_id).first()
        if not user:
            return Response({"error": "الموظف غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if "name" in data:
            user.name = data["name"].strip()
        if "email" in data:
            email_val = data["email"].strip() if data["email"] else None
            if email_val and User.objects.filter(email=email_val).exclude(pk=user.pk).exists():
                return Response({"error": "البريد الإلكتروني مستخدم بالفعل."}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email_val
        if "role" in data and data["role"] in [Role.SUPPORT, Role.STAFF, Role.MANAGER, Role.ADMIN]:
            user.role = data["role"]
        if "is_active" in data:
            if user.pk == request.user.pk and not data["is_active"]:
                return Response({"error": "لا يمكنك تعطيل حسابك الشخصي."}, status=status.HTTP_400_BAD_REQUEST)
            user.is_active = bool(data["is_active"])
        if "password" in data and data["password"].strip():
            user.set_password(data["password"].strip())

        user.save()
        return Response(UserSerializer(user).data)

    def delete(self, request, user_id):
        if request.user.role not in (Role.ADMIN, Role.OWNER) and not request.user.is_superuser:
            return Response(
                {"error": "فقط مدير النظام يمكنه حذف حسابات الموظفين."},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = User.objects.filter(pk=user_id).first()
        if not user:
            return Response({"error": "الموظف غير موجود."}, status=status.HTTP_404_NOT_FOUND)

        if user.pk == request.user.pk:
            return Response({"error": "لا يمكنك حذف حسابك الشخصي الحالي."}, status=status.HTTP_400_BAD_REQUEST)

        if user.role == Role.OWNER or user.is_superuser:
            return Response({"error": "لا يمكن حذف حساب مالك النظام."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_active = False
        user.role = Role.CUSTOMER
        user.is_staff = False
        user.save(update_fields=["is_active", "role", "is_staff"])
        return Response({"deleted": True, "message": "تم إيقاف حساب الموظف وسحب الصلاحيات الإدارية."})
