"""Auth endpoints.

Every response uses the `{data, message}` envelope from `03-api-contract.md`.
Every error message is Arabic, because the client shows it verbatim.
"""

import logging
from decimal import Decimal

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

from apps.core.models import User, Role
from apps.core.pagination import StandardPagination
from apps.core.views import CsrfProtectedAPIView
from django.utils.translation import gettext as _

from .permissions import IsAdminRole
from .phone import normalise_phone
from .serializers import (
    AdminUserUpdateSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    AddressSerializer,
    ProfileUpdateSerializer,
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


# ---------------------------------------------------------------------------
# The customer file (CRM) — plan 8, phase د. Numbers come from the orders at
# request time (`crm.py`); nothing is stored but what staff type.
# ---------------------------------------------------------------------------

from django.http import HttpResponse  # noqa: E402

from apps.core.models import CustomerInteraction, CustomerTag, ADMIN_ROLES  # noqa: E402
from apps.core.store_settings import get_store_settings  # noqa: E402

from . import crm  # noqa: E402
from .permissions import IsAdminOrOwner, IsManagerOrAbove  # noqa: E402
from .serializers import CustomerInteractionSerializer, CustomerTagSerializer  # noqa: E402


def _customer_row(user, settings, now):
    return {
        "id": str(user.id),
        "name": user.name,
        "phone_number": user.phone_number,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "date_joined": user.date_joined,
        "birthday": user.birthday,
        "birthday_today": crm.birthday_is_today(user.birthday),
        "city": user.last_city or "",
        "orders_count": user.orders_count,
        "spend": str(Decimal(user.spend or 0).quantize(Decimal("0.01"))),
        "last_order_at": user.last_order_at,
        "segment": crm.segment_of(user.orders_count, user.spend, user.last_order_at, settings, now),
        "tags": CustomerTagSerializer(user.tags.all(), many=True).data,
    }


def _customer_queryset(request):
    """The list and the export read the same filters, so what is exported is
    what is on the screen."""
    users = crm.annotate_numbers(User.objects.all()).prefetch_related("tags")
    params = request.query_params
    role = params.get("role", "").strip()
    if role == "customer":
        users = users.filter(role=Role.CUSTOMER)
    elif role == "staff":
        users = users.filter(role__in=ADMIN_ROLES)
    if search := params.get("search", "").strip():
        users = users.filter(Q(phone_number__icontains=search) | Q(name__icontains=search) | Q(email__icontains=search))
    if tag := params.get("tag", "").strip():
        users = users.filter(tags__id=tag)
    if city := params.get("city", "").strip():
        users = users.filter(orders__shipping_city_id=city).distinct()
    ordering = params.get("ordering", "").strip()
    order_by = {
        "spend": "spend", "-spend": "-spend",
        "last_order": "last_order_at", "-last_order": F_desc("last_order_at"),
        "orders": "orders_count", "-orders": "-orders_count",
    }.get(ordering, "-date_joined")
    users = users.order_by(order_by, "-date_joined")
    return users


def F_desc(field):
    """NULLs (customers with no order yet) last when sorting by last order."""
    from django.db.models import F

    return F(field).desc(nulls_last=True)


def _segment_filter(rows, segment):
    return [r for r in rows if r["segment"] == segment] if segment else rows


class AdminCustomerListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        settings = get_store_settings()
        now = timezone.now()
        users = _customer_queryset(request)
        segment = request.query_params.get("segment", "").strip()
        if segment in crm.SEGMENT_LABELS:
            # The segment is a rule over three numbers, so it is applied to the
            # annotated rows rather than translated into SQL: it is one pass
            # over a list that already fits in memory for a store this size.
            rows = _segment_filter([_customer_row(u, settings, now) for u in users], segment)
            paginator = StandardPagination()
            page = paginator.paginate_queryset(rows, request, view=self)
            return paginator.get_paginated_response(page)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(users, request, view=self)
        return paginator.get_paginated_response([_customer_row(u, settings, now) for u in page])


class AdminCustomerBirthdaysView(APIView):
    """Today's birthdays and the coming week's, for the strip above the list."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        today = timezone.localdate()
        rows = crm.birthdays_in_week(User.objects.filter(role=Role.CUSTOMER), today)
        return Response({"data": [
            {
                "id": str(u.id), "name": u.name, "phone_number": u.phone_number,
                "birthday": u.birthday, "today": crm.birthday_is_today(u.birthday, today),
            }
            for u in rows
        ]})


class AdminCustomerExportView(APIView):
    """The filtered list as CSV (decision 3: manager and above)."""

    permission_classes = [IsManagerOrAbove]

    def get(self, request):
        settings = get_store_settings()
        now = timezone.now()
        users = _customer_queryset(request)
        segment = request.query_params.get("segment", "").strip()
        if segment in crm.SEGMENT_LABELS:
            users = [u for u in users if crm.segment_of(u.orders_count, u.spend, u.last_order_at, settings, now) == segment]
        body = crm.export_csv(users, settings)
        response = HttpResponse(body, content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="customers-{now:%Y-%m-%d}.csv"'
        return response


class AdminCustomerProfileView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, user_id):
        user = crm.annotate_numbers(User.objects.filter(pk=user_id)).prefetch_related("tags").first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        settings = get_store_settings()
        row = _customer_row(user, settings, timezone.now())
        row.update({
            "average_order": str(crm.average_order(user.spend, user.orders_count)),
            "favourite_city": crm.favourite_city(user),
            "recent_orders": crm.recent_orders(user),
            "interactions": CustomerInteractionSerializer(
                user.interactions.select_related("staff")[:50], many=True
            ).data,
            "whatsapp_number": crm.whatsapp_number(user.phone_number),
            "templates": [
                {"key": key, "label": crm.TEMPLATE_LABELS[key], "text": crm.template_text(settings, key)}
                for key in crm.TEMPLATE_KEYS
            ],
            "coupons": [{"code": d.code, "name": d.name} for d in crm.active_coupons()[:20]],
            "can_export": request.user.role in (Role.MANAGER, Role.ADMIN, Role.OWNER),
            "can_delete_interactions": request.user.role in (Role.ADMIN, Role.OWNER),
        })
        return Response({"data": row})


class AdminCustomerInteractionsView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomerInteractionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        interaction = serializer.save(customer=user, staff=request.user)
        return Response(
            {"data": CustomerInteractionSerializer(interaction).data, "message": "تم تسجيل التواصل"},
            status=status.HTTP_201_CREATED,
        )


class AdminCustomerInteractionDetailView(APIView):
    """Deleting a log line is the administrator's alone; nobody edits one."""

    permission_classes = [IsAdminOrOwner]

    def delete(self, request, user_id, interaction_id):
        deleted, _ = CustomerInteraction.objects.filter(pk=interaction_id, customer_id=user_id).delete()
        if not deleted:
            return Response({"message": "السجل غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminCustomerWhatsAppView(APIView):
    """Builds the wa.me link for one of the three templates and writes the
    contact log line. Nothing is sent: the operator presses «إرسال» in WhatsApp."""

    permission_classes = [IsAdminRole]

    def post(self, request, user_id):
        user = User.objects.filter(pk=user_id).first()
        if user is None:
            return Response({"message": "المستخدم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        template = str(request.data.get("template", "")).strip()
        if template not in crm.TEMPLATE_KEYS:
            return Response({"message": "القالب غير معروف"}, status=status.HTTP_400_BAD_REQUEST)
        settings = get_store_settings()
        coupon = ""
        if code := str(request.data.get("coupon", "")).strip():
            discount = crm.active_coupons().filter(code=code).first()
            if discount is None:
                return Response({"message": "هذا الكوبون غير فعّال"}, status=status.HTTP_400_BAD_REQUEST)
            coupon = discount.code
        order_number = ""
        if order_id := str(request.data.get("order", "")).strip():
            from apps.orders.models import Order

            order = Order.objects.filter(pk=order_id, user=user).first()
            order_number = order.order_number if order else ""
        text = crm.render_template(
            crm.template_text(settings, template),
            name=user.name, store=settings.store_name, coupon=coupon, order_number=order_number,
        )
        from urllib.parse import quote

        url = f"https://wa.me/{crm.whatsapp_number(user.phone_number)}?text={quote(text)}"
        interaction = CustomerInteraction.objects.create(
            customer=user, staff=request.user, kind="whatsapp",
            text=f"واتساب: {crm.TEMPLATE_LABELS[template]}" + (f" ({coupon})" if coupon else ""),
        )
        return Response({"data": {
            "url": url, "text": text,
            "interaction": CustomerInteractionSerializer(interaction).data,
        }})


class AdminCustomerTagListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        return Response({"data": CustomerTagSerializer(CustomerTag.objects.all(), many=True).data})

    def post(self, request):
        serializer = CustomerTagSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tag = serializer.save()
        return Response({"data": CustomerTagSerializer(tag).data, "message": "تمت إضافة الوسم"}, status=status.HTTP_201_CREATED)


class AdminCustomerTagDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, tag_id):
        tag = CustomerTag.objects.filter(pk=tag_id).first()
        if tag is None:
            return Response({"message": "الوسم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CustomerTagSerializer(tag, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث الوسم"})

    def delete(self, request, tag_id):
        deleted, _ = CustomerTag.objects.filter(pk=tag_id).delete()
        if not deleted:
            return Response({"message": "الوسم غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
