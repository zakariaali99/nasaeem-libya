"""Cart, checkout and order endpoints.

The cart is **public by design** — a guest holds one, keyed on the session.
Authentication is required at checkout, not at add-to-cart.
"""

from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import SimpleRateThrottle
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.catalog.models import Product, ProductVariant
from apps.catalog.visibility import visible_products
from apps.core.language import wants_english
from apps.core.pagination import StandardPagination
from apps.core.store_settings import get_store_settings
from apps.core.views import CsrfProtectedAPIView
from django.utils.translation import gettext as _

from . import services
from .models import (
    Cart,
    CartItem,
    CartPromotion,
    Discount,
    Order,
    OrderStatus,
    ShippingStatus,
)
from .serializers import (
    AdminDiscountWriteSerializer,
    CartAddSerializer,
    CartDetailsSerializer,
    CartPromotionSerializer,
    CartSerializer,
    CartUpdateSerializer,
    CheckoutSerializer,
    DiscountSerializer,
    DashboardStatsSerializer,
    ExecutiveAnalyticsSerializer,
    OrderSerializer,
    OrderTrackSerializer,
)

DETAILS_SESSION_KEY = "checkout_details"


LAST_ORDER_SESSION_KEY = "last_order_id"
# Every order this device placed. Buying needs no password, so the device that
# bought is how a customer finds their orders again ("طلباتي").
DEVICE_ORDERS_SESSION_KEY = "device_order_ids"
DEVICE_SESSION_AGE = 60 * 60 * 24 * 365


def _details(request) -> dict:
    return request.session.get(DETAILS_SESSION_KEY, {}) or {}


def _cart_payload(request, cart, *, region_id=None, discount_code=None):
    details = _details(request)
    region_id = region_id if region_id is not None else details.get("region_id") or None
    discount_code = (
        discount_code if discount_code is not None else details.get("discount_code") or ""
    )

    summary = services.cart_summary(cart, region_id=region_id, discount_code=discount_code)
    data = {
        "id": cart.id if cart else None,
        "items": summary["items"],
        "item_count": sum(item["line"].quantity for item in summary["items"]),
        "subtotal": summary["subtotal"],
        "discount_total": summary["discount_total"],
        "shipping_total": summary["shipping_total"],
        "delivery_discount_amount": summary.get("delivery_discount_amount", 0),
        "total": summary["total"],
        "discount_code": summary["discount"].code if summary["discount"] else "",
        "discount_error": summary["discount_error"],
        "region_id": summary["region"].id if summary["region"] else None,
    }
    return CartSerializer(data, context={"request": request}).data


class CartView(CsrfProtectedAPIView):
    """GET is public and never creates a cart; POST creates one on first add."""

    permission_classes = [AllowAny]

    def get(self, request):
        cart = services.get_or_create_cart(request, create=False)
        return Response({"data": _cart_payload(request, cart)})

    def post(self, request):
        # A stale abandoned draft may be hiding exactly what the customer is
        # asking for; release those before anything is read or judged.
        services.maybe_release_expired_drafts()

        serializer = CartAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        product = visible_products(Product.objects.filter(id=payload["product_id"])).first()
        if product is None:
            return Response({"message": _("المنتج غير موجود")}, status=status.HTTP_404_NOT_FOUND)

        variant = None
        if payload.get("variant_id"):
            variant = ProductVariant.objects.filter(
                id=payload["variant_id"], product=product, is_active=True
            ).first()
            if variant is None:
                return Response({"message": _("الخيار غير موجود")}, status=status.HTTP_404_NOT_FOUND)
        elif product.has_variants:
            return Response(
                {"message": _("يرجى اختيار أحد خيارات المنتج")}, status=status.HTTP_400_BAD_REQUEST
            )

        if not services.has_price(product, variant):
            # No price on the size or the product: it would be sold for 0.00.
            return Response(
                {"message": _("سعر هذا المنتج غير محدد حالياً، يرجى التواصل معنا لطلبه")},
                status=status.HTTP_409_CONFLICT,
            )

        cart = services.get_or_create_cart(request)
        item = cart.items.filter(product=product, variant=variant).first()
        wanted = (item.quantity if item else 0) + payload["quantity"]

        # The basket is checked against stock here as a courtesy; checkout
        # re-checks under a lock, and that is the check that decides.
        stock = services.available_stock(product, variant)
        if stock is not None and wanted > stock:
            p_name = getattr(product, "name_en", "") or product.name if wants_english(request) else product.name
            return Response(
                {"message": _("الكمية المتوفرة من «%(name)s» هي %(count)s فقط") % {"name": p_name, "count": max(stock, 0)}},
                status=status.HTTP_409_CONFLICT,
            )

        if item:
            item.quantity = wanted
            item.save(update_fields=["quantity", "updated_at"])
        else:
            CartItem.objects.create(
                cart=cart, product=product, variant=variant, quantity=payload["quantity"]
            )

        return Response(
            {"data": _cart_payload(request, cart), "message": _("تمت الإضافة إلى السلة")},
            status=status.HTTP_201_CREATED,
        )


class CartItemView(CsrfProtectedAPIView):
    """Keyed on the **cart item id**, not the variant id: the same variant can
    legitimately appear twice under different line semantics."""

    permission_classes = [AllowAny]

    def get_item(self, request, item_id):
        cart = services.get_or_create_cart(request, create=False)
        if cart is None:
            return None, None
        return cart, cart.items.filter(id=item_id).first()

    def patch(self, request, item_id):
        cart, item = self.get_item(request, item_id)
        if item is None:
            return Response({"message": _("العنصر غير موجود في السلة")},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = CartUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data["quantity"]

        stock = services.available_stock(item.product, item.variant)
        if stock is not None and quantity > stock:
            p_name = getattr(item.product, "name_en", "") or item.product.name if wants_english(request) else item.product.name
            return Response(
                {"message": _("الكمية المتوفرة من «%(name)s» هي %(count)s فقط") % {"name": p_name, "count": max(stock, 0)}},
                status=status.HTTP_409_CONFLICT,
            )

        item.quantity = quantity
        item.save(update_fields=["quantity", "updated_at"])
        return Response({"data": _cart_payload(request, cart), "message": _("تم تحديث الكمية")})

    def delete(self, request, item_id):
        cart, item = self.get_item(request, item_id)
        if item is None:
            return Response({"message": _("العنصر غير موجود في السلة")},
                            status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response({"data": _cart_payload(request, cart), "message": _("تم حذف العنصر")})


class CartDetailsView(CsrfProtectedAPIView):
    permission_classes = [AllowAny]

    def get(self, request):
        cart = services.get_or_create_cart(request, create=False)
        return Response({"data": {**_details(request), "cart": _cart_payload(request, cart)}})

    def patch(self, request):
        serializer = CartDetailsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        details = {**_details(request), **serializer.validated_data}
        request.session[DETAILS_SESSION_KEY] = details
        request.session.modified = True

        cart = services.get_or_create_cart(request, create=False)
        return Response({"data": {**details, "cart": _cart_payload(request, cart)}})


class CartCheckoutView(CsrfProtectedAPIView):
    """Frictionless checkout: allows guest and authenticated customers alike."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = {**_details(request), **serializer.validated_data}

        cart = services.get_or_create_cart(request, create=False)
        if cart is None or not cart.items.exists():
            return Response({"message": _("السلة فارغة")}, status=status.HTTP_400_BAD_REQUEST)

        services.maybe_release_expired_drafts()

        # A draft when no address has been chosen yet: `/checkout/:orderId` is
        # where the customer picks one, so the order id must exist first.
        require_delivery = bool(
            payload.get("address") and (payload.get("city_id") or payload.get("region_id"))
        )

        try:
            order = services.checkout(
                cart=cart,
                user=request.user if (request.user and request.user.is_authenticated) else None,
                city_id=payload.get("city_id") or None,
                region_id=payload.get("region_id") or None,
                address=payload.get("address") or "",
                require_delivery=require_delivery,
                delivery_method_code=payload.get("delivery_method_code") or "",
                payment_method=payload.get("payment_method") or "",
                discount_code=payload.get("discount_code") or "",
                customer_notes=payload.get("customer_notes") or "",
                billing_address=payload.get("billing_address") or "",
                is_gift=payload.get("is_gift", False),
                gift_wrap_type=payload.get("gift_wrap_type") or "",
                gift_sender_name=payload.get("gift_sender_name") or "",
                gift_recipient_name=payload.get("gift_recipient_name") or "",
                gift_message=payload.get("gift_message") or "",
                hide_invoice_prices=payload.get("hide_invoice_prices", False),
            )
        except services.CheckoutError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)

        request.session["draft_order_id"] = str(order.id)
        request.session.pop(DETAILS_SESSION_KEY, None)
        request.session.modified = True
        return Response(
            {"data": OrderSerializer(order, context={"request": request}).data,
             "message": _("تم إنشاء الطلب")},
            status=status.HTTP_201_CREATED,
        )


def order_queryset():
    return Order.objects.select_related(
        "shipping_region", "shipping_city", "delivery_method", "discount", "user"
    ).prefetch_related(
        "items__product__images", "items__variant__values", "payments",
        "stage_events__changed_by",
    )


class CheckoutConfirmView(CsrfProtectedAPIView):
    """`POST /api/checkout/` — the confirm step of `/checkout/:orderId`.

    Applies destination and payment choices to a draft order and links it to the
    customer's account by phone number, opening one (with no password) for a new
    number. Buying never asks for a password.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        order_id = request.data.get("order_id")
        order = order_queryset().filter(id=order_id).first() if order_id else None
        if order is None or not _may_see(request.user, order, _session_order_ids(request)):
            return Response({"message": _("الطلب غير موجود")}, status=status.HTTP_404_NOT_FOUND)

        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = {**_details(request), **serializer.validated_data}

        # Auto-Registration & Customer Linking for Guests
        customer_phone = (payload.get("customer_phone") or "").strip()
        customer_name = (payload.get("customer_name") or "").strip()
        new_account_created = False

        user = request.user if (request.user and request.user.is_authenticated) else None
        if user is not None and order.user_id is None and not getattr(user, "is_admin_role", False):
            # The basket was started before signing in (cart -> login -> here):
            # without this the order belonged to nobody, so it was missing from
            # the customer's own orders and reached the dashboard with no name
            # or phone number to call.
            order.user = user
            order.save(update_fields=["user", "updated_at"])
        if user is None and customer_phone:
            import re
            from apps.core.models import Role, User
            from django.contrib.auth import login
            clean_digits = re.sub(r"[^\d]", "", customer_phone)
            if clean_digits.startswith("218"):
                std_phone = "0" + clean_digits[3:]
            elif not clean_digits.startswith("0") and len(clean_digits) == 9:
                std_phone = "0" + clean_digits
            else:
                std_phone = clean_digits

            user = User.objects.filter(phone_number=std_phone).first()
            if user is None:
                # No password: the customer never needs one to buy, and this
                # device stays signed in. A shared default ("000000") let anyone
                # who knew a number open that account.
                user = User.objects.create_user(
                    phone_number=std_phone,
                    name=customer_name or "عميل نسائم",
                    password=None,
                    role=Role.CUSTOMER,
                )
                new_account_created = True

            order.user = user
            order.save(update_fields=["user", "updated_at"])
            # Only an account created by THIS request is signed in. A phone
            # number typed into a form proves nothing: signing a guest in to an
            # existing account (a customer's — or the owner's) on the strength
            # of it handed that account to whoever knew the number. The order is
            # still linked to the account so its owner sees it after a real
            # login, and nothing on that account is changed from here.
            if new_account_created:
                login(request, user, backend="django.contrib.auth.backends.ModelBackend")
                request.session.set_expiry(DEVICE_SESSION_AGE)
        elif user is not None and customer_name and user.name != customer_name and not getattr(user, "is_admin_role", False):
            # The signed-in customer's own profile follows their latest order.
            user.name = customer_name
            user.save(update_fields=["name", "updated_at"])

        try:
            order = services.finalise_order(
                order,
                city_id=payload.get("city_id") or "",
                region_id=payload.get("region_id") or "",
                address=payload.get("address") or "",
                delivery_method_code=payload.get("delivery_method_code") or "",
                payment_method=payload.get("payment_method") or "",
                customer_notes=payload.get("customer_notes") or "",
                billing_address=payload.get("billing_address") or "",
                is_gift=payload.get("is_gift", False),
                gift_wrap_type=payload.get("gift_wrap_type") or "",
                gift_sender_name=payload.get("gift_sender_name") or "",
                gift_recipient_name=payload.get("gift_recipient_name") or "",
                gift_message=payload.get("gift_message") or "",
                hide_invoice_prices=payload.get("hide_invoice_prices", False),
            )
        except services.CheckoutError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)

        # Dispatch real-time Telegram / logging alert
        from .notifications import (
            format_bank_transfer_whatsapp_message,
            format_cod_order_whatsapp_message,
            dispatch_realtime_order_alert,
        )
        import re
        import urllib.parse
        dispatch_realtime_order_alert(order)

        def wa_number(phone):
            """`09XXXXXXXX` -> `2189XXXXXXXX`, the form wa.me expects."""
            digits = re.sub(r"[^\d]", "", phone or "")
            if digits.startswith("0"):
                return "218" + digits[1:]
            if digits and not digits.startswith("218"):
                return "218" + digits
            return digits

        # The invoice goes TO the store (the customer sends it from their own
        # WhatsApp); the welcome note goes to the customer's own chat.
        from apps.core.store_settings import get_store_settings
        store_number = wa_number(get_store_settings().whatsapp)

        payment_method = (payload.get("payment_method") or "").lower()
        is_bank = payment_method in ("bank_transfer", "bank")

        if is_bank:
            invoice_msg = format_bank_transfer_whatsapp_message(order)
        else:
            invoice_msg = format_cod_order_whatsapp_message(order)

        whatsapp_link = (
            f"https://wa.me/{store_number}?text={urllib.parse.quote(invoice_msg)}"
            if store_number
            else ""
        )

        # There is no password to send any more, so no welcome message either.
        account_whatsapp_msg = ""
        account_whatsapp_link = ""

        request.session.pop(DETAILS_SESSION_KEY, None)
        request.session.pop("draft_order_id", None)
        # The thank-you page reads the order back; a guest who used the number
        # of an existing account is not signed in, so the session vouches.
        request.session[LAST_ORDER_SESSION_KEY] = str(order.id)
        device_orders = [str(v) for v in request.session.get(DEVICE_ORDERS_SESSION_KEY) or []]
        if str(order.id) not in device_orders:
            device_orders.append(str(order.id))
        request.session[DEVICE_ORDERS_SESSION_KEY] = device_orders[-100:]
        if not request.user.is_authenticated or new_account_created:
            request.session.set_expiry(DEVICE_SESSION_AGE)
        request.session.modified = True

        return Response({
            "data": OrderSerializer(order, context={"request": request}).data,
            "message": "تم تأكيد الطلب بنجاح",
            "whatsapp_link": whatsapp_link,
            "whatsapp_invoice_message": invoice_msg,
            "new_account_created": new_account_created,
            "account_whatsapp_message": account_whatsapp_msg,
            "account_whatsapp_link": account_whatsapp_link,
        })


class CheckoutStateView(APIView):
    """`GET /api/checkout/<order_id>/` — what the checkout screen renders."""

    permission_classes = [AllowAny]

    def get(self, request, order_id):
        order = order_queryset().filter(id=order_id).first()
        if order is None or not _may_see(request.user, order, _session_order_ids(request)):
            return Response({"message": _("الطلب غير موجود")}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": OrderSerializer(order, context={"request": request}).data})


def _session_order_ids(request) -> set[str]:
    """Orders this browser session created: its open draft, its last order and
    every order it placed."""
    ids = {request.session.get("draft_order_id"), request.session.get(LAST_ORDER_SESSION_KEY)}
    ids.update(request.session.get(DEVICE_ORDERS_SESSION_KEY) or [])
    return {str(value) for value in ids if value}


def _may_see(user, order, session_order_ids=()) -> bool:
    if getattr(user, "is_admin_role", False):
        return True
    if user and user.is_authenticated and order.user_id == user.id:
        return True
    # An order that belongs to nobody used to be readable by anyone holding
    # its number, and numbers are sequential. Only the session that created it
    # may read it now.
    if isinstance(session_order_ids, str):
        session_order_ids = {session_order_ids}
    return str(order.id) in {str(value) for value in (session_order_ids or ()) if value}


class OrderListView(APIView):
    """Staff: every placed order. A signed-in customer: their own. A device
    that bought without signing in: the orders it placed (see
    DEVICE_ORDERS_SESSION_KEY) — never anyone else's."""

    permission_classes = [AllowAny]

    def get(self, request):
        from django.db.models import Q

        queryset = order_queryset().placed()
        device_ids = [i for i in _session_order_ids(request) if i]
        if not getattr(request.user, "is_admin_role", False):
            mine = Q(id__in=device_ids)
            if request.user.is_authenticated:
                mine |= Q(user=request.user)
            queryset = queryset.filter(mine)
        if state := request.query_params.get("status"):
            queryset = queryset.filter(status=state)
        # The customer page asks for one customer's orders. Ignored before,
        # so it listed — and totalled — every order in the store.
        if (customer := request.query_params.get("user")) and getattr(request.user, "is_admin_role", False):
            import uuid as _uuid

            try:
                queryset = queryset.filter(user_id=_uuid.UUID(customer))
            except ValueError:
                queryset = queryset.none()
        search =(request.query_params.get("search") or "").strip()
        if search and getattr(request.user, "is_admin_role", False):
            from django.db.models import Q

            queryset = queryset.filter(
                Q(order_number__icontains=search)
                | Q(user__name__icontains=search)
                | Q(user__phone_number__icontains=search)
            )
        if stage := request.query_params.get("stage"):
            from .stage_service import STAGE_FIELDS, stage_filter

            if stage in STAGE_FIELDS:
                queryset = queryset.filter(**stage_filter(stage))

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(
            OrderSerializer(page, many=True, context={"request": request}).data
        )


class OrderDetailView(APIView):
    # A device that bought without signing in reads its own orders here;
    # `_may_see` decides, and changes stay staff-only.
    permission_classes = [AllowAny]

    def get_object(self, request, lookup):
        queryset = order_queryset()
        order = queryset.filter(order_number=lookup).first()
        if order is None:
            import uuid as _uuid

            try:
                order = queryset.filter(id=_uuid.UUID(str(lookup))).first()
            except (ValueError, AttributeError):
                order = None
        return order

    def get(self, request, lookup):
        order = self.get_object(request, lookup)
        if order is None or not _may_see(request.user, order, _session_order_ids(request)):
            return Response({"message": _("الطلب غير موجود")}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": OrderSerializer(order, context={"request": request}).data})

    def patch(self, request, lookup):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object(request, lookup)
        if order is None:
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        allowed_enum_fields = {"status": OrderStatus, "shipping_status": ShippingStatus}
        allowed_text_fields = {"tracking_number": 100, "tracking_url": 255, "admin_notes": 4000}
        errors = {}
        for field, value in request.data.items():
            if field in allowed_enum_fields:
                if value not in allowed_enum_fields[field].values:
                    errors[field] = ["قيمة غير صحيحة"]
            elif field in allowed_text_fields:
                if not isinstance(value, str) or len(value) > allowed_text_fields[field]:
                    errors[field] = ["قيمة غير صحيحة"]
            else:
                errors[field] = ["حقل غير معروف"]
        if errors:
            return Response(
                {"message": "تحتوي البيانات المُرسلة على قيم غير صحيحة", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # A status change from an older screen is translated into a stage and
        # goes through the same engine as every other change.
        from .stage_service import StageError, change_stage, stage_of

        if "status" in request.data or "shipping_status" in request.data:
            probe = Order(
                status=request.data.get("status", order.status),
                shipping_status=request.data.get("shipping_status", order.shipping_status),
            )
            target = stage_of(probe)
            if target != stage_of(order):
                try:
                    change_stage(order, target, by=request.user)
                except StageError as exc:
                    return _stage_error_response(exc)

        text_updates = {k: v.strip() for k, v in request.data.items() if k in allowed_text_fields}
        if text_updates:
            Order.objects.filter(pk=order.pk).update(**text_updates, updated_at=timezone.now())
        order = order_queryset().get(pk=order.pk)
        return Response({"data": OrderSerializer(order, context={"request": request}).data,
                         "message": "تم تحديث الطلب"})


def _stage_error_response(exc):
    body = {"message": exc.message, "code": exc.code, "errors": {"stage": [exc.message]}}
    if exc.details:
        body["details"] = exc.details
    return Response(body, status=exc.status)


class AdminOrderStageView(CsrfProtectedAPIView):
    """`POST /api/admin/orders/<uuid:pk>/stage/` — move an order to a stage.

    Body: `stage`, optional `note`, `damaged_item_ids`, `dry_run` (answer what
    would happen without doing it) and `allow_short` (go ahead although the
    shelf shows less stock than the order needs)."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        from .stage_service import StageError, change_stage, is_backward

        order = get_object_or_404(Order, pk=pk)
        data = request.data
        damaged = data.get("damaged_item_ids") or []
        if not isinstance(damaged, list):
            damaged = []
        try:
            result = change_stage(
                order,
                str(data.get("stage") or ""),
                by=request.user,
                note=str(data.get("note") or ""),
                damaged_item_ids=damaged,
                dry_run=bool(data.get("dry_run")),
                allow_short=bool(data.get("allow_short")),
            )
        except StageError as exc:
            return _stage_error_response(exc)

        preview = {
            "from_stage": result.from_stage,
            "to_stage": result.to_stage,
            "backward": is_backward(result.from_stage, result.to_stage),
            "effects": result.effects,
            "shortages": result.shortages,
        }
        if not result.applied:
            return Response({"data": preview})
        order = order_queryset().get(pk=order.pk)
        return Response({
            "data": OrderSerializer(order, context={"request": request}).data,
            "meta": preview,
            "message": "تم تحديث مرحلة الطلب",
        })


class AdminOrderStageCountsView(CsrfProtectedAPIView):
    """`GET /api/admin/orders/stage-counts/` — how many placed orders sit in
    each stage, for the list's filter chips."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from .stage_service import STAGE_FIELDS, stage_filter

        placed = Order.objects.placed()
        counts = {stage: placed.filter(**stage_filter(stage)).count() for stage in STAGE_FIELDS}
        counts["all"] = placed.count()
        return Response({"data": counts})


class AdminOrderEditView(CsrfProtectedAPIView):
    """`PUT /api/admin/orders/<uuid:pk>/edit/` — change an order's lines,
    destination, address, notes and courier until it leaves with the courier.

    Prices are never taken from the request: kept lines keep the price the
    customer was quoted, new lines are priced from the catalogue."""

    permission_classes = [IsAdminRole]

    def put(self, request, pk):
        order = get_object_or_404(Order, pk=pk)
        data = request.data
        items = data.get("items")
        if not isinstance(items, list):
            return Response(
                {"message": "قائمة الأصناف مطلوبة", "errors": {"items": ["قائمة الأصناف مطلوبة"]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        def text(field, limit):
            value = data.get(field)
            if value is None:
                return None
            if not isinstance(value, str) or len(value) > limit:
                raise services.CheckoutError("قيمة غير صحيحة", field=field)
            return value

        shipping_total = None
        if data.get("shipping_total") not in (None, ""):
            try:
                shipping_total = Decimal(str(data["shipping_total"]))
            except Exception:
                shipping_total = Decimal("-1")
            if not shipping_total.is_finite() or not 0 <= shipping_total <= 9999:
                return Response(
                    {"message": "سعر التوصيل غير صحيح", "errors": {"shipping_total": ["سعر التوصيل غير صحيح"]}},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            services.edit_order(
                order,
                shipping_total=shipping_total,
                items=[row for row in items if isinstance(row, dict)],
                city_id=text("city_id", 64) or None,
                region_id=text("region_id", 64) or None,
                address=text("address", 500),
                customer_notes=text("customer_notes", 1000),
                delivery_method_code=text("delivery_method_code", 50) or None,
            )
        except services.CheckoutError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)

        order = order_queryset().get(pk=order.pk)
        return Response({"data": OrderSerializer(order, context={"request": request}).data,
                         "message": "تم حفظ تعديلات الطلب"})


class DiscountListView(CsrfProtectedAPIView):
    """Validation is public (the cart screen checks a code); management is admin."""

    permission_classes = [AllowAny]

    def get_permissions(self):
        return [IsAdminRole()] if self.request.method != "POST" else [AllowAny()]

    def get(self, request):
        return Response({"data": DiscountSerializer(Discount.objects.all(), many=True).data})

    def post(self, request):
        """Validate a code against the caller's own cart. Deliberately narrow:
        it answers only "does this code apply, and for how much" — it never
        reveals a discount's limits or usage count to a customer."""
        code = str(request.data.get("code") or "").strip()
        if not code:
            return Response({"message": "أدخل كود الخصم"}, status=status.HTTP_400_BAD_REQUEST)

        cart = services.get_or_create_cart(request, create=False)
        summary = services.cart_summary(cart, discount_code=code)
        if summary["discount"] is None:
            return Response(
                {"message": summary["discount_error"] or "كود الخصم غير صحيح"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        details = {**_details(request), "discount_code": code}
        request.session[DETAILS_SESSION_KEY] = details
        request.session.modified = True

        return Response({
            "data": {
                "code": summary["discount"].code,
                "name": summary["discount"].name,
                "discount_total": summary["discount_total"],
                "cart": _cart_payload(request, cart, discount_code=code),
            },
            "message": "تم تطبيق كود الخصم",
        })


class DiscountDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, discount_id):
        return Response({"data": DiscountSerializer(
            get_object_or_404(Discount, pk=discount_id)).data})

    def patch(self, request, discount_id):
        discount = get_object_or_404(Discount, pk=discount_id)
        serializer = DiscountSerializer(discount, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث الخصم"})

    def delete(self, request, discount_id):
        get_object_or_404(Discount, pk=discount_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminDiscountCreateView(CsrfProtectedAPIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        serializer = AdminDiscountWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        discount = serializer.save()
        return Response(
            {"data": DiscountSerializer(discount).data, "message": "تم إنشاء الخصم"},
            status=status.HTTP_201_CREATED,
        )


class DashboardStatsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        days = request.GET.get("days")
        timeframe = request.GET.get("timeframe")
        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")
        stats = DashboardStatsSerializer().build(
            days=days,
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
        )
        return Response({"data": stats})


class ExecutiveAnalyticsView(APIView):
    """Executive Business Intelligence & Profitability Telemetry."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        days = request.GET.get("days")
        timeframe = request.GET.get("timeframe")
        start_date = request.GET.get("start_date")
        end_date = request.GET.get("end_date")
        data = ExecutiveAnalyticsSerializer().build(
            days=days,
            timeframe=timeframe,
            start_date=start_date,
            end_date=end_date,
        )
        return Response({"data": data})


class ActiveCartPromotionView(APIView):
    """Public endpoint to fetch active cart promotion (e.g. Free Shipping threshold)."""

    permission_classes = [AllowAny]

    def get(self, request):
        cached = cache.get("store:promotions:active")
        if cached is not None:
            return Response({"data": cached})
        promo = CartPromotion.objects.filter(is_active=True).first()
        if promo is None:
            return Response({"data": None})
        serialized_data = CartPromotionSerializer(promo).data
        cache.set("store:promotions:active", serialized_data, 43200)
        return Response({"data": serialized_data})


class AdminCartPromotionView(CsrfProtectedAPIView):
    """Admin endpoint to fetch and update cart promotion settings."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        promo = CartPromotion.objects.first()
        if promo is None:
            # Opening the settings screen must not switch free delivery on.
            promo = CartPromotion.objects.create(
                title="توصيل مجاني لجميع المدن",
                message="أضف {remaining} للحصول على توصيل مجاني!",
                success_message="تهانينا! لقد حصلت على توصيل مجاني لكافة المدن 🚀",
                min_order_amount=200.00,
                is_active=False,
            )
        return Response({"data": CartPromotionSerializer(promo).data})

    def put(self, request):
        promo = CartPromotion.objects.first()
        if promo is None:
            promo = CartPromotion.objects.create()
        serializer = CartPromotionSerializer(promo, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        cache.delete("store:promotions:active")
        return Response({
            "data": serializer.data,
            "message": "تم تحديث إعدادات عرض السلة والتوصيل المجاني بنجاح",
        })


# --------------------------------------------------------------------------
# Plan 01 — Operational Velocity & Quick Order Entry Views
# --------------------------------------------------------------------------

class AdminQuickOrderCreateView(CsrfProtectedAPIView):
    """`POST /api/admin/orders/quick-create/` — Instant order entry for phone and WhatsApp sales."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        data = request.data
        customer_name = str(data.get("customer_name") or "").strip()
        customer_phone = str(data.get("customer_phone") or "").strip()
        customer_email = str(data.get("customer_email") or "").strip()
        shipping_city_id = data.get("shipping_city_id") or None
        shipping_region_id = data.get("shipping_region_id") or None
        shipping_address = str(data.get("shipping_address") or "").strip()
        delivery_method_code = str(data.get("delivery_method_code") or "").strip()
        payment_method_code = str(data.get("payment_method_code") or "manual_payment").strip()
        discount_code = str(data.get("discount_code") or "").strip()
        customer_notes = str(data.get("customer_notes") or "").strip()
        items = data.get("items") or []

        if not isinstance(items, list) or not items:
            return Response(
                {"message": "يجب إضافة منتج واحد على الأقل للطلب", "errors": {"items": ["قائمة المنتجات فارغة"]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not customer_phone:
            return Response(
                {"message": "رقم هاتف العميل مطلوب", "errors": {"customer_phone": ["رقم الهاتف مطلوب"]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            order = services.quick_create_admin_order(
                customer_name=customer_name,
                customer_phone=customer_phone,
                customer_email=customer_email,
                shipping_city_id=shipping_city_id,
                shipping_region_id=shipping_region_id,
                shipping_address=shipping_address,
                delivery_method_code=delivery_method_code,
                payment_method_code=payment_method_code,
                discount_code=discount_code,
                customer_notes=customer_notes,
                items=items,
                operator_user=request.user,
            )
        except services.CheckoutError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)

        return Response(
            {
                "data": OrderSerializer(order, context={"request": request}).data,
                "message": f"تم إنشاء الطلب #{order.order_number} بنجاح وحجز المخزون",
            },
            status=status.HTTP_201_CREATED,
        )


class AdminCustomerLookupView(APIView):
    """`GET /api/admin/customers/lookup/?phone=...` — Instant autocomplete for customer phone."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        phone = request.query_params.get("phone", "").strip()
        if len(phone) < 3:
            return Response({"data": []})

        import re
        from apps.core.models import User
        clean = re.sub(r"[^0-9+]", "", phone)
        users = list(
            User.objects.filter(phone_number__icontains=clean)
            .order_by("-date_joined")[:8]
        )

        results = []
        for u in users:
            last_order = u.orders.order_by("-created_at").first()
            results.append({
                "id": str(u.id),
                "name": u.name,
                "phone_number": u.phone_number,
                "email": u.email,
                "last_city_id": str(last_order.shipping_city_id) if last_order and last_order.shipping_city_id else None,
                "last_city_name": last_order.shipping_city.name if last_order and last_order.shipping_city else "",
                "last_region_id": str(last_order.shipping_region_id) if last_order and last_order.shipping_region_id else None,
                "last_address": last_order.shipping_address if last_order else "",
                "orders_count": u.orders.count(),
            })

        return Response({"data": results})


class AdminBulkOrderActionView(CsrfProtectedAPIView):
    """`POST /api/admin/orders/bulk-action/` — Mass status update on selected orders."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        order_ids = request.data.get("order_ids") or []
        action = str(request.data.get("action") or "").strip()
        notes = str(request.data.get("notes") or "").strip()

        if not isinstance(order_ids, list) or not order_ids:
            return Response(
                {"message": "لم يتم تحديد أي طلبات"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from .stage_service import STAGE_FIELDS

        if action not in services.BULK_ACTION_STAGES and action not in STAGE_FIELDS:
            return Response(
                {"message": f"الإجراء المحدد غير صالح ({action})"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = services.execute_bulk_order_action(
            order_ids=order_ids,
            action=action,
            operator_user=request.user,
            notes=notes,
        )

        return Response({"data": result, "message": result["message"]})


def get_order_by_lookup(lookup):
    queryset = order_queryset()
    order = queryset.filter(order_number=lookup).first()
    if order is None:
        import uuid as _uuid
        try:
            order = queryset.filter(id=_uuid.UUID(str(lookup))).first()
        except (ValueError, AttributeError):
            order = None
    return order


class AdminOrderWaybillView(APIView):
    """`GET /api/admin/orders/<lookup>/waybill/` — Thermal shipping waybill (4x6 / 80mm)."""

    permission_classes = [IsAdminRole]

    def get(self, request, lookup):
        order = get_order_by_lookup(lookup)
        if not order:
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        waybill_data = services.build_order_waybill_data(order)
        return Response({"data": waybill_data})


class AdminOrderInvoiceView(APIView):
    """`GET /api/admin/orders/<lookup>/invoice/` — Official A4 Tax/Sales Invoice data."""

    permission_classes = [IsAdminRole]

    def get(self, request, lookup):
        order = get_order_by_lookup(lookup)
        if not order:
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        invoice_data = services.build_order_invoice_data(order)
        return Response({"data": invoice_data})


class AdminBatchWaybillsView(APIView):
    """`POST /api/admin/orders/batch-waybills/` — Batch thermal waybills for multiple orders."""

    permission_classes = [IsAdminRole]

    def post(self, request):
        order_ids = request.data.get("order_ids") or []
        if not isinstance(order_ids, list) or not order_ids:
            return Response(
                {"message": "يجب تحديد طلب واحد على الأقل لطباعة البوالص"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        waybills = services.build_batch_waybills_data(order_ids)
        return Response({"data": waybills, "count": len(waybills)})


class LoyaltySummaryView(APIView):
    """`GET /api/orders/loyalty/me/` — Customer VIP tier, points balance, value in LYD, perks and ledger."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not settings.FEATURE_LOYALTY:
            return Response({"message": "برنامج النقاط متوقف مؤقتاً"}, status=status.HTTP_404_NOT_FOUND)
        user = request.user
        points = user.loyalty_points
        spend = user.lifetime_spend
        tier = user.vip_tier

        tier_labels = {
            "SILVER": "المستوى الفضي 🥈",
            "GOLD": "المستوى الذهبي 🥇",
            "DIAMOND": "المستوى الماسي 💎",
        }

        if tier == "SILVER":
            next_tier = "GOLD"
            target_spend = Decimal("1000.00")
            spend_to_next = max(Decimal("0.00"), target_spend - spend)
            progress_percent = min(100, int((spend / target_spend) * 100)) if target_spend > 0 else 0
            perks = [
                "اكتساب 1 نقطة لكل 10 د.ل من المشتريات",
                "عينة عطرية مجانية في المناسبات السنوية",
                "استبدال النقاط مباشرة (100 نقطة = 10 د.ل)",
            ]
        elif tier == "GOLD":
            next_tier = "DIAMOND"
            target_spend = Decimal("2500.00")
            spend_to_next = max(Decimal("0.00"), target_spend - spend)
            progress_percent = min(100, int((spend / target_spend) * 100)) if target_spend > 0 else 0
            perks = [
                "اكتساب 1.5x نقطة مضاعفة لكل 10 د.ل",
                "خصم دائم 5% على كافة الطلبات",
                "شحن مجاني دائم لجميع المدن الليبية",
                "باقة عينات عطرية حصرية مع كل طلب",
            ]
        else:
            next_tier = None
            spend_to_next = Decimal("0.00")
            progress_percent = 100
            perks = [
                "اكتساب 2x نقطة مضاعفة لكل 10 د.ل",
                "خصم دائم 10% على كافة العطور",
                "شحن مجاني فوري وتغليف ملكي مجاني",
                "أولوية حجز الإصدارات الخاصة والمحدودة",
                "مدير حساب شخصي ومستشار عطري VIP عبر الواتساب",
            ]

        transactions = [
            {
                "id": str(t.id),
                "points_change": t.points_change,
                "transaction_type": t.transaction_type,
                "transaction_type_label": t.get_transaction_type_display(),
                "description": t.description,
                "created_at": t.created_at.isoformat(),
            }
            for t in user.loyalty_transactions.all()[:15]
        ]

        return Response({
            "data": {
                "loyalty_points": points,
                "points_value_lyd": str(round(Decimal(points) * Decimal("0.10"), 2)),
                "lifetime_spend": str(spend),
                "vip_tier": tier,
                "vip_tier_label": tier_labels.get(tier, "المستوى الفضي 🥈"),
                "next_tier": next_tier,
                "spend_to_next_tier": str(spend_to_next),
                "progress_percent": progress_percent,
                "perks": perks,
                "recent_transactions": transactions,
            }
        })


class AdminAbandonedCartsView(APIView):
    """`GET /api/admin/marketing/abandoned-carts/` — Abandoned baskets with recovery telemetry & WhatsApp links."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from datetime import timedelta
        from django.db.models import Count, Q
        from django.utils import timezone
        import urllib.parse

        # Baskets with items not updated for N minutes (default 15) and not yet checked out
        minutes_param = request.query_params.get("minutes", "15")
        try:
            minutes = max(0, int(minutes_param))
        except (ValueError, TypeError):
            minutes = 15

        status_filter = request.query_params.get("status", "all").strip().lower()
        search_query = request.query_params.get("q", "").strip()

        cutoff = timezone.now() - timedelta(minutes=minutes)
        carts_qs = (
            Cart.objects.annotate(num_items=Count("items"))
            .filter(num_items__gt=0, updated_at__lte=cutoff)
            .distinct()
            .select_related("user")
            .prefetch_related("items__product")
        )

        if status_filter == "recovered":
            carts_qs = carts_qs.filter(is_recovered=True)
        elif status_filter == "reminded":
            carts_qs = carts_qs.filter(is_recovered=False, recovery_sms_sent_at__isnull=False)
        elif status_filter == "pending":
            carts_qs = carts_qs.filter(is_recovered=False, recovery_sms_sent_at__isnull=True)

        if search_query:
            carts_qs = carts_qs.filter(
                Q(customer_name__icontains=search_query)
                | Q(phone_number__icontains=search_query)
                | Q(user__name__icontains=search_query)
                | Q(user__phone_number__icontains=search_query)
                | Q(items__product__name__icontains=search_query)
            ).distinct()

        total_abandoned_val = Decimal("0.00")
        cart_rows = []

        for cart in carts_qs:
            items_list = []
            cart_total = Decimal("0.00")
            for ci in cart.items.all():
                price = ci.product.price or Decimal("0.00")
                line_val = price * ci.quantity
                cart_total += line_val
                items_list.append({
                    "id": str(ci.id),
                    "product_name": ci.product.name,
                    "quantity": ci.quantity,
                    "unit_price": str(price),
                    "total_price": str(line_val),
                })

            total_abandoned_val += cart_total
            phone = cart.phone_number or (cart.user.phone_number if cart.user else "")
            name = cart.customer_name or (cart.user.name if cart.user else "زائر المتجر")

            clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
            if clean_phone.startswith("09"):
                clean_phone = "218" + clean_phone[1:]
            elif not clean_phone.startswith("218") and len(clean_phone) == 9:
                clean_phone = "218" + clean_phone

            first_item_name = items_list[0]["product_name"] if items_list else "العطور"
            cart_url = f"{get_store_settings().site_url.rstrip('/')}/cart"
            msg = (
                f"مرحباً {name} ✨\n"
                f"لاحظنا في نسائم ليبيا أنك تركت {first_item_name} في سلتك.\n"
                f"عطورك في انتظارك مع توصيل سريع لمدينتك! استخدم كود الخصم الحصري (NASAEEM5) للحصول على خصم إضافي 5% والشحن المجاني.\n"
                f"أكمل طلبك الآن: {cart_url}"
            )
            encoded_msg = urllib.parse.quote(msg)
            wa_link = f"https://wa.me/{clean_phone}?text={encoded_msg}" if clean_phone else ""

            cart_rows.append({
                "id": str(cart.id),
                "customer_name": name,
                "phone_number": phone,
                "items_count": len(items_list),
                "items": items_list,
                "cart_total": str(cart_total),
                "is_recovered": cart.is_recovered,
                "recovery_sms_sent_at": cart.recovery_sms_sent_at.isoformat() if cart.recovery_sms_sent_at else None,
                "recovery_discount_code": cart.recovery_discount_code or "NASAEEM5",
                "whatsapp_link": wa_link,
                "last_activity_at": cart.updated_at.isoformat(),
            })

        recovered_count = sum(1 for c in cart_rows if c["is_recovered"])
        total_count = len(cart_rows)
        recovery_rate = round((recovered_count / total_count * 100), 1) if total_count > 0 else 0.0

        return Response({
            "data": {
                "carts": cart_rows,
                "stats": {
                    "total_abandoned_value": str(total_abandoned_val),
                    "abandoned_count": total_count,
                    "recovered_count": recovered_count,
                    "recovery_rate_percent": recovery_rate,
                }
            }
        })


class AdminSendAbandonedCartWhatsAppView(APIView):
    """Record recovery WhatsApp reminder and return direct launch data."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        from django.utils import timezone
        import urllib.parse
        from apps.orders.models import Discount, DiscountType

        cart = Cart.objects.filter(id=pk).first()
        if cart is None:
            return Response({"message": "السلة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)

        # Ensure NASAEEM5 recovery discount code is active in the database
        Discount.objects.get_or_create(
            code="NASAEEM5",
            defaults={
                "name": "كوبون استرجاع السلة 5%",
                "type": DiscountType.PERCENTAGE,
                "percentage": Decimal("5.00"),
                "is_active": True,
            },
        )

        cart.recovery_sms_sent_at = timezone.now()
        cart.recovery_discount_code = "NASAEEM5"
        cart.save(update_fields=["recovery_sms_sent_at", "recovery_discount_code", "updated_at"])

        phone = cart.phone_number or (cart.user.phone_number if cart.user else "")
        name = cart.customer_name or (cart.user.name if cart.user else "عميلنا العزيز")
        clean_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if clean_phone.startswith("09"):
            clean_phone = "218" + clean_phone[1:]
        elif not clean_phone.startswith("218") and len(clean_phone) == 9:
            clean_phone = "218" + clean_phone

        first_item = cart.items.first()
        item_title = first_item.product.name if first_item else "عطورك المختارة"
        cart_url = f"{get_store_settings().site_url.rstrip('/')}/cart"
        msg = (
            f"مرحباً {name} ✨\n"
            f"لاحظنا في نسائم ليبيا أنك تركت {item_title} في سلتك.\n"
            f"عطورك في انتظارك مع توصيل سريع لمدينتك! استخدم كود الخصم الحصري (NASAEEM5) للحصول على خصم إضافي 5% والشحن المجاني.\n"
            f"أكمل طلبك الآن: {cart_url}"
        )
        wa_link = f"https://wa.me/{clean_phone}?text={urllib.parse.quote(msg)}" if clean_phone else ""

        return Response({
            "message": "تم تجهيز رسالة الاسترجاع بالواتساب وتسجيل التذكير في النظام بنجاح",
            "whatsapp_link": wa_link,
            "discount_code": "NASAEEM5",
        })


class AdminMarkAbandonedCartRecoveredView(APIView):
    """Mark an abandoned cart as recovered."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        cart = Cart.objects.filter(id=pk).first()
        if cart is None:
            return Response({"message": "السلة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)

        cart.is_recovered = True
        cart.save(update_fields=["is_recovered", "updated_at"])
        return Response({"message": "تم تحديث حالة السلة إلى مسترجعة بنجاح"})



class OrderTrackThrottle(SimpleRateThrottle):
    """Per address, signed in or not."""

    scope = "order_track"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class OrderTrackView(APIView):
    """Public order tracking by phone number, order number, or both.

    Anyone may look an order up (store decision), so the answer carries only
    what tracking needs: number, date, stage, items and total. No name,
    phone, address, notes or payment details ever leave through here, and
    the lookup is rate-limited so numbers cannot be walked in bulk.
    """

    permission_classes = [AllowAny]
    throttle_classes = [OrderTrackThrottle]
    LIMIT = 20

    # POST, so a phone number never lands in a URL or an access log.
    def post(self, request):
        from apps.accounts.phone import normalise_phone

        raw_phone = str(request.data.get("phone") or "").strip()
        number = str(request.data.get("number") or "").strip().lstrip("#").upper()
        if not raw_phone and not number:
            return Response({"message": _("أدخل رقم الهاتف أو رقم الطلب")}, status=status.HTTP_400_BAD_REQUEST)

        queryset = order_queryset().placed()
        if raw_phone:
            phone = normalise_phone(raw_phone)
            if not phone:
                return Response({"message": _("رقم الهاتف غير صحيح")}, status=status.HTTP_400_BAD_REQUEST)
            queryset = queryset.filter(user__phone_number=phone)
        if number:
            queryset = queryset.filter(order_number__iexact=number)

        orders = list(queryset.order_by("-created_at")[: self.LIMIT])
        return Response({"data": OrderTrackSerializer(orders, many=True, context={"request": request}).data})
