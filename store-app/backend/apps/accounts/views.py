"""Auth endpoints.

Every response uses the `{data, message}` envelope from `03-api-contract.md`.
Every error message is Arabic, because the client shows it verbatim.
"""

import logging

from django.contrib.auth import login as django_login
from django.contrib.auth import logout as django_logout
from django.middleware.csrf import get_token
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import User
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

        serializer = AdminUserUpdateSerializer(user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data.get("banned") and not user.ban_expires_at:
            serializer.validated_data.setdefault("ban_expires_at", None)
        serializer.save()
        logger.info(
            "admin updated user id=%s by=%s at=%s",
            user.id, request.user.phone_number, timezone.now().isoformat(),
        )
        return Response({"data": UserSerializer(user).data, "message": "تم تحديث المستخدم"})
