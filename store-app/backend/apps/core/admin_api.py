"""Operator API for cities and regions — fees, activation, region creation."""

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole
from apps.core.models import City, Region


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["id", "name", "city", "delivery_fee", "estimated_delivery_days", "is_active"]


class CitySerializer(serializers.ModelSerializer):
    regions = RegionSerializer(many=True, read_only=True)

    class Meta:
        model = City
        fields = ["id", "name", "code", "delivery_fee", "is_active", "regions"]


class AdminCityListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        cities = City.objects.prefetch_related("regions").order_by("name")
        return Response({"data": CitySerializer(cities, many=True).data})


class AdminCityDetailView(APIView):
    permission_classes = [IsAdminRole]

    def patch(self, request, city_id):
        city = City.objects.filter(id=city_id).first()
        if city is None:
            return Response({"message": "المدينة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        allowed = {"delivery_fee", "is_active"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for field, value in data.items():
            setattr(city, field, value)
        city.save(update_fields=[*data.keys(), "updated_at"])
        return Response({"data": CitySerializer(city).data, "message": "تم تحديث المدينة"})


class AdminRegionCreateView(APIView):
    permission_classes = [IsAdminRole]

    def post(self, request):
        serializer = RegionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            if Region.objects.filter(
                name__iexact=serializer.validated_data["name"],
                city_id=serializer.validated_data["city"].id,
            ).exists():
                return Response({"message": "توجد منطقة بهذا الاسم في هذه المدينة"},
                                status=status.HTTP_400_BAD_REQUEST)
            region = serializer.save()
        return Response({"data": RegionSerializer(region).data,
                         "message": "تم إنشاء المنطقة"}, status=status.HTTP_201_CREATED)


class AdminRegionDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get_object(self, region_id):
        return Region.objects.filter(id=region_id).first()

    def patch(self, request, region_id):
        region = self.get_object(region_id)
        if region is None:
            return Response({"message": "المنطقة غير موجودة"}, status=status.HTTP_404_NOT_FOUND)
        allowed = {"delivery_fee", "is_active", "estimated_delivery_days"}
        data = {k: v for k, v in request.data.items() if k in allowed}
        for field, value in data.items():
            setattr(region, field, value)
        region.save(update_fields=[*data.keys(), "updated_at"])
        return Response({"data": RegionSerializer(region).data, "message": "تم تحديث المنطقة"})


class AdminUnifiedSearchView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        if not query:
            return Response({"data": {"products": [], "orders": [], "users": [], "pages": []}})

        from django.db.models import Q
        from apps.catalog.models import Product
        from apps.orders.models import Order
        from apps.core.models import User

        # Search Products
        products_qs = (
            Product.objects.filter(
                Q(name__icontains=query)
                | Q(sku__icontains=query)
                | Q(slug__icontains=query)
                | Q(description__icontains=query)
            )
            .prefetch_related("images")[:6]
        )
        products = [
            {
                "id": str(p.id),
                "name": p.name,
                "slug": p.slug,
                "sku": p.sku or "",
                "price": str(p.price) if p.price else None,
                "compare_at_price": str(p.compare_at_price) if p.compare_at_price else None,
                "image_url": p.images.first().url if p.images.exists() else None,
                "stock": p.stock,
                "url": f"/admin/products/{p.slug}",
            }
            for p in products_qs
        ]

        # Search Orders
        orders_qs = (
            Order.objects.filter(
                Q(order_number__icontains=query)
                | Q(user__phone_number__icontains=query)
                | Q(user__name__icontains=query)
                | Q(shipping_address__icontains=query)
            )
            .select_related("user")[:6]
        )
        orders = [
            {
                "id": str(o.id),
                "order_number": o.order_number,
                "customer_name": o.user.name if o.user and o.user.name else "عميل",
                "customer_phone": o.user.phone_number if o.user else "",
                "total": str(o.total),
                "status": o.status,
                "shipping_status": o.shipping_status,
                "created_at": o.created_at.isoformat(),
                "url": f"/admin/orders/{o.order_number}",
            }
            for o in orders_qs
        ]

        # Search Users
        users_qs = (
            User.objects.filter(
                Q(phone_number__icontains=query)
                | Q(name__icontains=query)
                | Q(email__icontains=query)
            )[:6]
        )
        users = [
            {
                "id": str(u.id),
                "name": u.name or "مستخدم",
                "phone_number": u.phone_number,
                "role": u.role,
                "is_active": u.is_active,
                "url": f"/admin/users/{u.id}",
            }
            for u in users_qs
        ]

        # Navigation shortcuts
        all_pages = [
            {"title": "لوحة التحكم الرئيسية", "url": "/admin", "category": "لوحة التحكم", "icon": "LayoutDashboard"},
            {"title": "إدارة الطلبات", "url": "/admin/orders", "category": "المبيعات", "icon": "ShoppingCart"},
            {"title": "إضافة منتج جديد", "url": "/admin/products/new", "category": "الكتالوج", "icon": "Plus"},
            {"title": "كتالوج المنتجات", "url": "/admin/products", "category": "الكتالوج", "icon": "Package"},
            {"title": "التصنيفات والأقسام", "url": "/admin/categories", "category": "الكتالوج", "icon": "FolderTree"},
            {"title": "المجموعات الترويجية", "url": "/admin/collections", "category": "الكتالوج", "icon": "Tag"},
            {"title": "المخزون والكميات", "url": "/admin/inventory", "category": "المخزون", "icon": "Boxes"},
            {"title": "سجلات حركة المخزون", "url": "/admin/inventory/logs", "category": "المخزون", "icon": "History"},
            {"title": "العملاء والمستخدمين", "url": "/admin/users", "category": "العملاء", "icon": "Users"},
            {"title": "كوبونات الخصم", "url": "/admin/discounts", "category": "التسويق", "icon": "Percent"},
            {"title": "إضافة كوبون جديد", "url": "/admin/discounts/new", "category": "التسويق", "icon": "Plus"},
            {"title": "طرق الدفع الإلكتروني", "url": "/admin/payment-methods", "category": "الإعدادات", "icon": "CreditCard"},
            {"title": "شركات التوصيل والشحن", "url": "/admin/delivery-methods", "category": "الإعدادات", "icon": "Truck"},
            {"title": "المدن والمناطق", "url": "/admin/cities", "category": "الإعدادات", "icon": "MapPin"},
            {"title": "تخصيص الواجهة والصفحة الرئيسية", "url": "/admin/customization", "category": "التصميم", "icon": "Palette"},
        ]
        q_lower = query.lower()
        pages = [p for p in all_pages if q_lower in p["title"].lower() or q_lower in p["category"].lower()][:6]

        return Response({
            "data": {
                "products": products,
                "orders": orders,
                "users": users,
                "pages": pages,
            }
        })

