"""Catalogue endpoints.

Public reads opt out of the deny-by-default permission explicitly. Everything
else requires an admin role.

The product queryset is built once, in `product_queryset()`, with every
`select_related`/`prefetch_related` the card needs. N+1 on the catalogue is a
bug, and `assertNumQueries` in the tests is what keeps it one.
"""

from decimal import Decimal, InvalidOperation

from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.core.pagination import StandardPagination
from apps.orders.models import Discount

from . import services
from .models import (
    Category,
    Collection,
    InventoryLog,
    Product,
    ProductVariant,
    VariantOption,
    VariantValue,
)
from .serializers import (
    CategorySerializer,
    CollectionSerializer,
    InventoryAdjustSerializer,
    InventoryLogSerializer,
    ProductDetailSerializer,
    ProductListSerializer,
    ProductVariantSerializer,
    ProductWriteSerializer,
    VariantOptionSerializer,
    VariantValueSerializer,
)

SORTS = {
    "newest": "-created_at",
    "oldest": "created_at",
    "price_asc": "price",
    "price_desc": "-price",
    "name": "name",
}


def product_queryset():
    """One place decides what a product costs to fetch."""
    return (
        Product.objects.all()
        .prefetch_related(
            "images",
            "categories",
            "collections",
            "variants",
            Prefetch("discounts", queryset=Discount.objects.filter(is_active=True)),
        )
    )


def _decimal(value):
    try:
        return Decimal(value)
    except (TypeError, InvalidOperation):
        return None


def filter_products(queryset, params, *, admin=False):
    if not admin:
        queryset = queryset.filter(is_active=True)
    elif (is_active := params.get("is_active")) is not None:
        queryset = queryset.filter(is_active=is_active.lower() in ("1", "true", "yes"))

    searching = False
    if search := params.get("search"):
        queryset = services.search_products(queryset, search)
        searching = True
    if category := params.get("category"):
        queryset = queryset.filter(
            Q(categories__slug=category) | Q(categories__id__in=_as_uuid_list(category))
        )
    if collection := params.get("collection"):
        queryset = queryset.filter(
            Q(collections__slug=collection) | Q(collections__id__in=_as_uuid_list(collection))
        )
    if ids := params.get("ids"):
        queryset = queryset.filter(id__in=[i for i in ids.split(",") if i])
    if (minimum := _decimal(params.get("min_price"))) is not None:
        queryset = queryset.filter(price__gte=minimum)
    if (maximum := _decimal(params.get("max_price"))) is not None:
        queryset = queryset.filter(price__lte=maximum)
    if params.get("in_stock", "").lower() in ("1", "true", "yes"):
        # Must agree with ProductListSerializer.get_in_stock, or the catalogue
        # shows a product as متوفر and then hides it the moment the shopper
        # ticks "المتوفر فقط". Two things the previous filter got wrong:
        #   1. a product with variants carries stock on its VARIANTS, not on
        #      itself, so `stock__gt=0` excluded every variant product;
        #   2. availability is stock MINUS reserved_stock, not stock.
        from django.db.models import F

        queryset = queryset.filter(
            Q(track_quantity=False)
            | Q(has_variants=False, stock__gt=F("reserved_stock"))
            | Q(
                has_variants=True,
                variants__is_active=True,
                variants__stock__gt=F("variants__reserved_stock"),
            )
        )

    sort = params.get("sort") or ""
    if searching and sort not in SORTS:
        # A search with no explicit sort is ordered by relevance, not by date —
        # the closest match first is the whole point of searching.
        return queryset.order_by("-relevance", "-created_at").distinct()
    return queryset.order_by(SORTS.get(sort, "-created_at")).distinct()


def _as_uuid_list(value):
    import uuid as _uuid

    try:
        return [_uuid.UUID(value)]
    except (ValueError, AttributeError):
        return []


class ProductListView(APIView):
    permission_classes = [AllowAny]

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminRole()]

    def get(self, request):
        admin = bool(
            request.user.is_authenticated
            and getattr(request.user, "is_admin_role", False)
        )
        queryset = filter_products(product_queryset(), request.query_params, admin=admin)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = ProductListSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = ProductWriteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        product = serializer.save()
        return Response(
            {"data": ProductDetailSerializer(product, context={"request": request}).data,
             "message": "تم إنشاء المنتج"},
            status=status.HTTP_201_CREATED,
        )


class ProductDetailView(APIView):
    permission_classes = [AllowAny]

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminRole()]

    def get_object(self, lookup, *, admin=False):
        """Resolves by slug OR uuid, per `03-api-contract.md`."""
        queryset = product_queryset()
        if not admin:
            queryset = queryset.filter(is_active=True)
        product = queryset.filter(slug=lookup).first()
        if product is None:
            import uuid as _uuid

            try:
                product = queryset.filter(id=_uuid.UUID(str(lookup))).first()
            except (ValueError, AttributeError):
                product = None
        return product

    def get(self, request, lookup):
        admin = bool(request.user.is_authenticated and getattr(request.user, "is_admin_role", False))
        product = self.get_object(lookup, admin=admin)
        if product is None:
            return Response({"message": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": ProductDetailSerializer(product, context={"request": request}).data})

    def patch(self, request, lookup):
        product = self.get_object(lookup, admin=True)
        if product is None:
            return Response({"message": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProductWriteSerializer(
            product, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث المنتج"})

    def delete(self, request, lookup):
        product = self.get_object(lookup, admin=True)
        if product is None:
            return Response({"message": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        from django.db.models import ProtectedError

        try:
            product.delete()
        except ProtectedError:
            # PROTECT on order lines: deactivate instead of destroying history.
            product.is_active = False
            product.save(update_fields=["is_active", "updated_at"])
            return Response(
                {"data": None, "message": "المنتج مرتبط بطلبات سابقة، تم إخفاؤه بدل حذفه"}
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoryListView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminRole()]

    def get(self, request):
        queryset = Category.objects.all()
        if not (request.user.is_authenticated and getattr(request.user, "is_admin_role", False)):
            queryset = queryset.filter(is_active=True)

        categories = list(queryset.order_by("name"))
        by_parent = {}
        for category in categories:
            by_parent.setdefault(category.parent_id, []).append(category)
        for category in categories:
            category._children = by_parent.get(category.id, [])

        roots = by_parent.get(None, [])
        serializer = CategorySerializer(roots, many=True, context={"request": request})
        return Response({"data": serializer.data, "meta": {"total": len(categories)}})

    def post(self, request):
        serializer = CategorySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم إنشاء التصنيف"},
                        status=status.HTTP_201_CREATED)


class CategoryDetailView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminRole()]

    def get_object(self, lookup):
        category = Category.objects.filter(slug=lookup).first()
        if category is None:
            import uuid as _uuid

            try:
                category = Category.objects.filter(id=_uuid.UUID(str(lookup))).first()
            except (ValueError, AttributeError):
                category = None
        return category

    def get(self, request, lookup):
        category = self.get_object(lookup)
        if category is None:
            return Response({"message": "التصنيف غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": CategorySerializer(category, context={"request": request}).data})

    def patch(self, request, lookup):
        category = self.get_object(lookup)
        if category is None:
            return Response({"message": "التصنيف غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CategorySerializer(category, data=request.data, partial=True,
                                        context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث التصنيف"})

    def delete(self, request, lookup):
        category = self.get_object(lookup)
        if category is None:
            return Response({"message": "التصنيف غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        if category.is_system:
            return Response({"message": "لا يمكن حذف تصنيف نظامي"}, status=status.HTTP_400_BAD_REQUEST)
        category.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CategoryProductsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lookup):
        category = CategoryDetailView().get_object(lookup)
        if category is None:
            return Response({"message": "التصنيف غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        queryset = filter_products(
            product_queryset().filter(categories=category), request.query_params
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(
            ProductListSerializer(page, many=True, context={"request": request}).data
        )


class CollectionListView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminRole()]

    def get(self, request):
        queryset = Collection.objects.all()
        if not (request.user.is_authenticated and getattr(request.user, "is_admin_role", False)):
            queryset = queryset.filter(is_active=True)
        serializer = CollectionSerializer(queryset.order_by("name"), many=True,
                                          context={"request": request})
        return Response({"data": serializer.data, "meta": {"total": queryset.count()}})

    def post(self, request):
        serializer = CollectionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم إنشاء المجموعة"},
                        status=status.HTTP_201_CREATED)


class CollectionDetailView(APIView):
    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdminRole()]

    def get_object(self, lookup):
        collection = Collection.objects.filter(slug=lookup).first()
        if collection is None:
            import uuid as _uuid

            try:
                collection = Collection.objects.filter(id=_uuid.UUID(str(lookup))).first()
            except (ValueError, AttributeError):
                collection = None
        return collection

    def get(self, request, lookup):
        collection = self.get_object(lookup)
        if collection is None:
            return Response({"message": "المجموعة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": CollectionSerializer(collection, context={"request": request}).data})

    def patch(self, request, lookup):
        collection = self.get_object(lookup)
        if collection is None:
            return Response({"message": "المجموعة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CollectionSerializer(collection, data=request.data, partial=True,
                                          context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث المجموعة"})

    def delete(self, request, lookup):
        collection = self.get_object(lookup)
        if collection is None:
            return Response({"message": "المجموعة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        collection.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CollectionProductsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, lookup):
        collection = CollectionDetailView().get_object(lookup)
        if collection is None:
            return Response({"message": "المجموعة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        queryset = filter_products(
            product_queryset().filter(collections=collection), request.query_params
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(
            ProductListSerializer(page, many=True, context={"request": request}).data
        )


# --------------------------------------------------------------------------
# Options and variants — admin only
# --------------------------------------------------------------------------

class VariantOptionListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = VariantOption.objects.prefetch_related("values").order_by("name")
        return Response({"data": VariantOptionSerializer(queryset, many=True).data})

    def post(self, request):
        serializer = VariantOptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم إنشاء الخيار"},
                        status=status.HTTP_201_CREATED)


class VariantOptionDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, option_id):
        option = get_object_or_404(VariantOption.objects.prefetch_related("values"), pk=option_id)
        return Response({"data": VariantOptionSerializer(option).data})

    def patch(self, request, option_id):
        option = get_object_or_404(VariantOption, pk=option_id)
        serializer = VariantOptionSerializer(option, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث الخيار"})

    def delete(self, request, option_id):
        get_object_or_404(VariantOption, pk=option_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VariantOptionValuesView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, option_id):
        option = get_object_or_404(VariantOption, pk=option_id)
        return Response({"data": VariantValueSerializer(option.values.all(), many=True).data})

    def post(self, request, option_id):
        option = get_object_or_404(VariantOption, pk=option_id)
        serializer = VariantValueSerializer(data={**request.data, "option": option.id})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تمت إضافة القيمة"},
                        status=status.HTTP_201_CREATED)


class VariantListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = ProductVariant.objects.select_related("product").prefetch_related("values__option")
        if product_id := request.query_params.get("product"):
            queryset = queryset.filter(product_id=product_id)
        return Response({"data": ProductVariantSerializer(queryset, many=True).data})

    def post(self, request):
        serializer = ProductVariantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم إنشاء الخيار"},
                        status=status.HTTP_201_CREATED)


class VariantDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request, variant_id):
        variant = get_object_or_404(
            ProductVariant.objects.prefetch_related("values__option"), pk=variant_id
        )
        return Response({"data": ProductVariantSerializer(variant).data})

    def patch(self, request, variant_id):
        variant = get_object_or_404(ProductVariant, pk=variant_id)
        serializer = ProductVariantSerializer(variant, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({"data": serializer.data, "message": "تم تحديث الخيار"})

    def delete(self, request, variant_id):
        get_object_or_404(ProductVariant, pk=variant_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VariantMatrixView(APIView):
    """Generates one variant per combination of the supplied option values."""

    permission_classes = [IsAdminRole]

    def post(self, request, lookup):
        product = ProductDetailView().get_object(lookup, admin=True)
        if product is None:
            return Response({"message": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        groups = request.data.get("value_groups") or []
        if not isinstance(groups, list) or not groups:
            return Response(
                {"message": "يجب اختيار قيمة واحدة على الأقل لكل خيار"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = services.generate_variant_matrix(
            product=product, value_groups=groups, defaults=request.data.get("defaults") or {},
        )
        return Response({
            "data": ProductVariantSerializer(created, many=True).data,
            "message": f"تم إنشاء {len(created)} خيار",
        }, status=status.HTTP_201_CREATED)


# --------------------------------------------------------------------------
# Inventory — admin only
# --------------------------------------------------------------------------

class InventoryListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = (
            Product.objects.filter(track_quantity=True)
            .prefetch_related("variants__values__option")
            .order_by("name")
        )
        if search := request.query_params.get("search"):
            queryset = queryset.filter(Q(name__icontains=search) | Q(sku__icontains=search))
        if request.query_params.get("low_stock", "").lower() in ("1", "true", "yes"):
            threshold = int(request.query_params.get("threshold", 5))
            queryset = queryset.filter(stock__lte=threshold)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        rows = [
            {
                "product_id": str(product.id),
                "name": product.name,
                "sku": product.sku,
                "has_variants": product.has_variants,
                "stock": product.stock,
                "reserved_stock": product.reserved_stock,
                "available_stock": product.stock - product.reserved_stock,
                "variants": [
                    {
                        "variant_id": str(v.id),
                        "sku": v.sku,
                        "label": " / ".join(value.value for value in v.values.all()),
                        "stock": v.stock,
                        "reserved_stock": v.reserved_stock,
                        "available_stock": v.stock - v.reserved_stock,
                    }
                    for v in product.variants.all()
                ],
            }
            for product in page
        ]
        return paginator.get_paginated_response(rows)


class InventoryAdjustView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        serializer = InventoryAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        product = Product.objects.filter(pk=data["product_id"]).first()
        if product is None:
            return Response({"message": "المنتج غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        variant = None
        if data.get("variant_id"):
            variant = ProductVariant.objects.filter(pk=data["variant_id"], product=product).first()
            if variant is None:
                return Response({"message": "الخيار غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        try:
            services.adjust_stock(
                product=product, variant=variant, change=data["change"],
                reason=data["reason"], note=data.get("note", ""), user=request.user,
            )
        except services.StockError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        product.refresh_from_db()
        return Response({
            "data": ProductDetailSerializer(product, context={"request": request}).data,
            "message": "تم تعديل المخزون",
        })


class InventoryLogsView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        queryset = InventoryLog.objects.select_related("product", "variant", "user")
        if product_id := request.query_params.get("product"):
            queryset = queryset.filter(product_id=product_id)
        if reason := request.query_params.get("reason"):
            queryset = queryset.filter(reason=reason)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        return paginator.get_paginated_response(InventoryLogSerializer(page, many=True).data)


class ImageUploadView(APIView):
    """Multipart upload → thumb/medium/full WebP renditions on disk."""

    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser]

    MAX_BYTES = 10 * 1024 * 1024

    def post(self, request):
        uploaded = request.FILES.get("file") or request.FILES.get("image")
        if uploaded is None:
            return Response({"message": "لم يتم إرسال أي ملف"}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded.size > self.MAX_BYTES:
            return Response({"message": "حجم الصورة يتجاوز 10 ميغابايت"},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            url = services.store_image(uploaded)
        except ValueError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {"data": {"url": url, "renditions": services.rendition_urls(url)},
             "message": "تم رفع الصورة"},
            status=status.HTTP_201_CREATED,
        )
