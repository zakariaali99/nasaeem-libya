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

from apps.core.models import User
from apps.core.pagination import StandardPagination
from apps.core.views import CsrfProtectedAPIView

from . import otp as otp_module
from .permissions import IsAdminRole
from .phone import normalise_phone
from .serializers import (
    AdminUserUpdateSerializer,
    LoginSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserSerializer,
    AddressSerializer,
    ProfileUpdateSerializer,
)
from .throttling import LoginThrottle, PasswordResetThrottle, RegisterThrottle

logger = logging.getLogger(__name__)

# Sent whether or not the phone belongs to an account. Telling the caller that a
# number is unknown is the same oracle the login endpoint refuses to be.
RESET_SENT = "إذا كان الرقم مسجّلاً لدينا فسيصلك رمز التحقق برسالة نصية"
RESET_INVALID = "رمز التحقق غير صحيح أو منتهي الصلاحية"


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


class PasswordResetRequestView(CsrfProtectedAPIView):
    """Sends an OTP for password reset. Always answers the same way."""

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]
    otp_provider = None  # tests inject a provider here

    def get_provider(self):
        return self.otp_provider or otp_module.get_provider()

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        phone = normalise_phone(serializer.validated_data["phone_number"])

        request_id = None
        if phone and User.objects.filter(phone_number=phone, is_active=True).exists():
            try:
                provider = self.get_provider()
                request_id = provider.send(phone)
                otp_module.remember_reset(request_id, phone)
            except otp_module.OtpError:
                logger.warning("otp send failed phone=%s", phone)
                # Still answer identically: a provider outage must not become an
                # oracle either.
                request_id = None

        return Response({"data": {"request_id": request_id}, "message": RESET_SENT})


class PasswordResetConfirmView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]
    otp_provider = None

    def get_provider(self):
        return self.otp_provider or otp_module.get_provider()

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request_id = serializer.validated_data["request_id"]
        code = serializer.validated_data["code"]

        expected_phone = otp_module.recall_reset(request_id)
        if not expected_phone:
            return Response({"message": RESET_INVALID}, status=status.HTTP_400_BAD_REQUEST)

        try:
            verified_phone = self.get_provider().verify(request_id, code)
        except otp_module.OtpError:
            return Response({"message": RESET_INVALID}, status=status.HTTP_400_BAD_REQUEST)

        # The provider must confirm the SAME number the reset was opened for.
        if not verified_phone or normalise_phone(verified_phone) != expected_phone:
            return Response({"message": RESET_INVALID}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(phone_number=expected_phone, is_active=True).first()
        if user is None:
            return Response({"message": RESET_INVALID}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data["password"])
        user.save(update_fields=["password", "updated_at"])
        otp_module.forget_reset(request_id)
        logger.info("password reset completed phone=%s", user.phone_number)

        # No session is issued here. The user signs in with the new password,
        # which keeps "a session only ever follows authenticate()" true.
        return Response({"data": None, "message": "تم تغيير كلمة المرور، يمكنك تسجيل الدخول الآن"})


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
    """Allows administrators to set or reset a customer's password (e.g. to '000000')."""
    permission_classes = [IsAdminRole]

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        new_password = str(request.data.get("password", "")).strip()
        if not new_password:
            new_password = "000000"

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
                {"message": "كلمة المرور الحالية غير صحيحة"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password", "updated_at"])
        from django.contrib.auth import update_session_auth_hash
        update_session_auth_hash(request, request.user)

        return Response({"message": "تم تغيير كلمة المرور بنجاح"})


class AddressListCreateView(CsrfProtectedAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        addresses = request.user.addresses.select_related("region__city").all()
        return Response({"data": AddressSerializer(addresses, many=True).data})

    def post(self, request):
        serializer = AddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if serializer.validated_data.get("is_default"):
                request.user.addresses.update(is_default=False)
            address = serializer.save(user=request.user)
        return Response({"data": AddressSerializer(address).data,
                         "message": "تم حفظ العنوان"}, status=status.HTTP_201_CREATED)


class AddressDetailView(CsrfProtectedAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, address_id):
        return request.user.addresses.filter(id=address_id).first()

    def patch(self, request, address_id):
        address = self.get_object(request, address_id)
        if address is None:
            return Response({"message": "العنوان غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        serializer = AddressSerializer(address, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if serializer.validated_data.get("is_default"):
                request.user.addresses.exclude(pk=address.pk).update(is_default=False)
            address = serializer.save()
        return Response({"data": AddressSerializer(address).data, "message": "تم تحديث العنوان"})

    def delete(self, request, address_id):
        address = self.get_object(request, address_id)
        if address is None:
            return Response({"message": "العنوان غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        address.delete()
        return Response(status=204)


class AdminUserListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        users = User.objects.order_by("-date_joined")
        if search := request.query_params.get("search", "").strip():
            users = users.filter(
                Q(phone_number__icontains=search) | Q(name__icontains=search)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(users, request, view=self)
        return paginator.get_paginated_response(UserSerializer(page, many=True).data)


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
