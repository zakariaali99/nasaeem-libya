"""Cart, checkout and order endpoints.

The cart is **public by design** — a guest holds one, keyed on the session.
Authentication is required at checkout, not at add-to-cart.
"""

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.catalog.models import Product, ProductVariant
from apps.core.pagination import StandardPagination
from apps.core.views import CsrfProtectedAPIView

from . import services
from .models import Cart, CartItem, Discount, Order
from .serializers import (
    CartAddSerializer,
    CartDetailsSerializer,
    CartSerializer,
    CartUpdateSerializer,
    CheckoutSerializer,
    DiscountSerializer,
    OrderSerializer,
)

DETAILS_SESSION_KEY = "checkout_details"


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
        serializer = CartAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        product = Product.objects.filter(id=payload["product_id"], is_active=True).first()
        if product is None:
            return Response({"message": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        variant = None
        if payload.get("variant_id"):
            variant = ProductVariant.objects.filter(
                id=payload["variant_id"], product=product, is_active=True
            ).first()
            if variant is None:
                return Response({"message": "الخيار غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        elif product.has_variants:
            return Response(
                {"message": "يرجى اختيار أحد خيارات المنتج"}, status=status.HTTP_400_BAD_REQUEST
            )

        cart = services.get_or_create_cart(request)
        item = cart.items.filter(product=product, variant=variant).first()
        wanted = (item.quantity if item else 0) + payload["quantity"]

        # The basket is checked against stock here as a courtesy; checkout
        # re-checks under a lock, and that is the check that decides.
        stock = services.available_stock(product, variant)
        if stock is not None and wanted > stock:
            return Response(
                {"message": f"الكمية المتوفرة من «{product.name}» هي {max(stock, 0)} فقط"},
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
            {"data": _cart_payload(request, cart), "message": "تمت الإضافة إلى السلة"},
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
            return Response({"message": "العنصر غير موجود في السلة"},
                            status=status.HTTP_404_NOT_FOUND)

        serializer = CartUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        quantity = serializer.validated_data["quantity"]

        stock = services.available_stock(item.product, item.variant)
        if stock is not None and quantity > stock:
            return Response(
                {"message": f"الكمية المتوفرة من «{item.product.name}» هي {max(stock, 0)} فقط"},
                status=status.HTTP_409_CONFLICT,
            )

        item.quantity = quantity
        item.save(update_fields=["quantity", "updated_at"])
        return Response({"data": _cart_payload(request, cart), "message": "تم تحديث الكمية"})

    def delete(self, request, item_id):
        cart, item = self.get_item(request, item_id)
        if item is None:
            return Response({"message": "العنصر غير موجود في السلة"},
                            status=status.HTTP_404_NOT_FOUND)
        item.delete()
        return Response({"data": _cart_payload(request, cart), "message": "تم حذف العنصر"})


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
    """**Auth is required here, and only here.**"""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = {**_details(request), **serializer.validated_data}

        cart = services.get_or_create_cart(request, create=False)
        if cart is None or not cart.items.exists():
            return Response({"message": "السلة فارغة"}, status=status.HTTP_400_BAD_REQUEST)

        # A draft when no address has been chosen yet: `/checkout/:orderId` is
        # where the customer picks one, so the order id must exist first.
        require_delivery = bool(payload.get("address") and payload.get("region_id"))

        try:
            order = services.checkout(
                cart=cart,
                user=request.user,
                region_id=payload.get("region_id") or None,
                address=payload.get("address") or "",
                require_delivery=require_delivery,
                delivery_method_code=payload.get("delivery_method_code") or "",
                payment_method=payload.get("payment_method") or "",
                discount_code=payload.get("discount_code") or "",
                customer_notes=payload.get("customer_notes") or "",
                billing_address=payload.get("billing_address") or "",
            )
        except services.CheckoutError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)

        request.session.pop(DETAILS_SESSION_KEY, None)
        return Response(
            {"data": OrderSerializer(order, context={"request": request}).data,
             "message": "تم إنشاء الطلب"},
            status=status.HTTP_201_CREATED,
        )


def order_queryset():
    return Order.objects.select_related(
        "shipping_region", "shipping_city", "delivery_method", "discount", "user"
    ).prefetch_related("items__product__images", "items__variant__values", "payments")


class CheckoutConfirmView(CsrfProtectedAPIView):
    """`POST /api/checkout/` — the confirm step of `/checkout/:orderId`.

    Applies the address, region, delivery method and payment method to a draft
    order and recomputes the delivery fee and total. The subtotal and discount
    are NOT recomputed: they were fixed when the customer committed to the
    basket, and quietly repricing after that is how a shop charges a number it
    did not quote.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        order_id = request.data.get("order_id")
        order = order_queryset().filter(id=order_id).first() if order_id else None
        if order is None or not _may_see(request.user, order):
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = {**_details(request), **serializer.validated_data}

        try:
            order = services.finalise_order(
                order,
                region_id=payload.get("region_id") or "",
                address=payload.get("address") or "",
                delivery_method_code=payload.get("delivery_method_code") or "",
                payment_method=payload.get("payment_method") or "",
                customer_notes=payload.get("customer_notes") or "",
                billing_address=payload.get("billing_address") or "",
            )
        except services.CheckoutError as exc:
            body = {"message": exc.message}
            if exc.field:
                body["errors"] = {exc.field: [exc.message]}
            return Response(body, status=exc.status)

        request.session.pop(DETAILS_SESSION_KEY, None)
        return Response({"data": OrderSerializer(order, context={"request": request}).data,
                         "message": "تم تأكيد الطلب"})


class CheckoutStateView(APIView):
    """`GET /api/checkout/<order_id>/` — what the checkout screen renders."""

    permission_classes = [IsAuthenticated]

    def get(self, request, order_id):
        order = order_queryset().filter(id=order_id).first()
        if order is None or not _may_see(request.user, order):
            # 404 rather than 403: confirming that someone else's order exists
            # is itself a leak.
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": OrderSerializer(order, context={"request": request}).data})


def _may_see(user, order) -> bool:
    if getattr(user, "is_admin_role", False):
        return True
    return order.user_id == user.id


class OrderListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = order_queryset()
        if not getattr(request.user, "is_admin_role", False):
            queryset = queryset.filter(user=request.user)
        if state := request.query_params.get("status"):
            queryset = queryset.filter(status=state)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(
            OrderSerializer(page, many=True, context={"request": request}).data
        )


class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated]

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
        if order is None or not _may_see(request.user, order):
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": OrderSerializer(order, context={"request": request}).data})

    def patch(self, request, lookup):
        if not getattr(request.user, "is_admin_role", False):
            return Response({"message": "غير مصرح"}, status=status.HTTP_403_FORBIDDEN)
        order = self.get_object(request, lookup)
        if order is None:
            return Response({"message": "الطلب غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        allowed = {"status", "shipping_status", "tracking_number", "tracking_url"}
        for field, value in request.data.items():
            if field in allowed:
                setattr(order, field, value)
        order.save()
        return Response({"data": OrderSerializer(order, context={"request": request}).data,
                         "message": "تم تحديث الطلب"})


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
