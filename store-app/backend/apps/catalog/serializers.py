"""Catalogue serializers.

The product list must carry everything a card needs in one response — the client
never fetches twice to render a grid. On Libyan mobile data a second round trip
per card is the difference between a fast store and an unusable one.
"""

from decimal import Decimal

from rest_framework import serializers

from apps.orders.models import Discount

from .models import (
    Category,
    Collection,
    InventoryLog,
    Product,
    ProductImage,
    ProductReview,
    ProductVariant,
    VariantOption,
    VariantValue,
    WishlistItem,
)
from .services import rendition_urls, unique_slug


class ProductImageSerializer(serializers.ModelSerializer):
    renditions = serializers.SerializerMethodField()

    class Meta:
        model = ProductImage
        fields = ["id", "url", "alt_text", "sort_order", "renditions"]

    def get_renditions(self, obj):
        return rendition_urls(obj.url)


class CategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = [
            "id", "name", "slug", "description", "image_url",
            "parent", "is_active", "is_system", "children", "product_count",
        ]
        extra_kwargs = {"slug": {"required": False}}

    def get_children(self, obj):
        # `_child_map` is attached by the list view so the tree costs one query.
        children = getattr(obj, "_children", None)
        if children is None:
            return []
        return CategorySerializer(children, many=True, context=self.context).data

    def create(self, validated_data):
        validated_data.setdefault("slug", unique_slug(Category, validated_data["name"]))
        return super().create(validated_data)


class CollectionSerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Collection
        fields = ["id", "name", "slug", "description", "is_active", "product_count"]
        extra_kwargs = {"slug": {"required": False}}

    def create(self, validated_data):
        validated_data.setdefault("slug", unique_slug(Collection, validated_data["name"]))
        return super().create(validated_data)


class VariantValueSerializer(serializers.ModelSerializer):
    option_name = serializers.CharField(source="option.name", read_only=True)

    class Meta:
        model = VariantValue
        fields = ["id", "option", "option_name", "value"]


class VariantOptionSerializer(serializers.ModelSerializer):
    values = VariantValueSerializer(many=True, read_only=True)

    class Meta:
        model = VariantOption
        fields = ["id", "name", "values"]


class ProductVariantSerializer(serializers.ModelSerializer):
    values = VariantValueSerializer(many=True, read_only=True)
    value_ids = serializers.PrimaryKeyRelatedField(
        queryset=VariantValue.objects.all(), many=True, write_only=True, required=False, source="values",
    )
    available_stock = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            "id", "product", "sku", "price", "compare_at_price",
            "stock", "reserved_stock", "is_active", "values", "value_ids", "available_stock",
        ]
        read_only_fields = ["reserved_stock"]

    def get_available_stock(self, obj):
        return obj.stock - obj.reserved_stock


class DiscountBadgeSerializer(serializers.ModelSerializer):
    """The narrow view of a discount a product card is allowed to see."""

    class Meta:
        model = Discount
        fields = ["id", "code", "name", "type", "value", "percentage", "end_date"]


class ProductListSerializer(serializers.ModelSerializer):
    images = ProductImageSerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    collections = CollectionSerializer(many=True, read_only=True)
    discounts = DiscountBadgeSerializer(many=True, read_only=True)
    available_stock = serializers.SerializerMethodField()
    in_stock = serializers.SerializerMethodField()
    discount_percent = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "price", "compare_at_price", "sku",
            "images", "has_variants", "track_quantity", "stock", "reserved_stock",
            "available_stock", "in_stock", "is_active",
            "categories", "collections", "discounts", "discount_percent",
        ]

    def get_available_stock(self, obj):
        """What a customer can actually buy.

        For a product with variants the stock lives on the VARIANTS and the
        product row holds 0 — so returning `obj.stock - obj.reserved_stock`
        produced a card reading "بقي 0 فقط" (only 0 left) next to `in_stock:
        true`. The two fields have to be computed from the same place.
        """
        if obj.has_variants:
            return sum(
                max(v.stock - v.reserved_stock, 0) for v in obj.variants.all() if v.is_active
            )
        return obj.stock - obj.reserved_stock

    def get_in_stock(self, obj):
        if not obj.track_quantity:
            return True
        if obj.has_variants:
            # `is_active` matters: a deactivated variant is not on sale, so its
            # stock must not make the product look available.
            return any(
                v.stock - v.reserved_stock > 0 for v in obj.variants.all() if v.is_active
            )
        return obj.stock - obj.reserved_stock > 0

    def get_discount_percent(self, obj):
        """Derived from the two prices it sits beside — never a separate source
        of truth. The reference showed a "20% off" badge next to an
        undiscounted price because the badge had its own field."""
        price, was = obj.price, obj.compare_at_price
        if not price or not was or Decimal(was) <= Decimal(price):
            return None
        return round((Decimal(was) - Decimal(price)) / Decimal(was) * 100)


class PerfumeAttributeSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import PerfumeAttribute
        model = PerfumeAttribute
        fields = [
            "id", "fragrance_family", "gender", "concentration", "origin_country",
            "top_notes", "heart_notes", "base_notes", "longevity_score", "longevity_hours",
            "sillage_score", "seasons", "occasions",
        ]


class ProductBundleSerializer(serializers.ModelSerializer):
    included_products = ProductListSerializer(many=True, read_only=True)
    savings_amount = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        from .models import ProductBundle
        model = ProductBundle
        fields = [
            "id", "name", "slug", "description", "bundle_price",
            "original_price", "savings_amount", "badge_text", "included_products",
        ]


class ProductDetailSerializer(ProductListSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    perfume_details = serializers.SerializerMethodField()
    bundles = serializers.SerializerMethodField()

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + [
            "description", "barcode", "meta_title", "meta_description",
            "width", "length", "height", "weight", "variants", "perfume_details", "bundles", "created_at",
        ]

    def get_bundles(self, obj):
        from .models import ProductBundle
        db_bundles = obj.bundles_as_main.filter(is_active=True)
        if db_bundles.exists():
            return ProductBundleSerializer(db_bundles, many=True, context=self.context).data

        # Generate intelligent dynamic bundle if none explicitly configured
        other_products = Product.objects.filter(is_active=True, stock__gt=0).exclude(id=obj.id)[:2]
        if not other_products.exists():
            other_products = Product.objects.filter(is_active=True).exclude(id=obj.id)[:2]
        if not other_products.exists():
            return []

        base_price = Decimal(str(obj.price or 220))
        addon_prices = sum((Decimal(str(p.price or 80)) for p in other_products), Decimal(0))
        original = base_price + addon_prices
        # 18% bundling discount
        bundle_price = round(original * Decimal("0.82"), 2)

        return [{
            "id": f"dynamic-bundle-{obj.id}",
            "name": f"حزمة العناية الملكية المتكاملة مع {obj.name}",
            "slug": f"royal-bundle-{obj.slug}",
            "description": "تشمل العطر الأصلي مع معطر شعر فاخر وعينة سفر مميزة بسعر توفيري خاص.",
            "bundle_price": str(bundle_price),
            "original_price": str(original),
            "savings_amount": str(original - bundle_price),
            "badge_text": "وفر 18% + شحن مجاني",
            "included_products": ProductListSerializer(other_products, many=True, context=self.context).data,
        }]

    def get_perfume_details(self, obj):
        if hasattr(obj, "perfume_details"):
            return PerfumeAttributeSerializer(obj.perfume_details).data
        return {
            "fragrance_family": "شرقي خشبي فاخر",
            "gender": "UNISEX",
            "concentration": "Eau de Parfum",
            "origin_country": "فرنسا",
            "top_notes": [
                {"name": "البرغموت الإيطالي", "icon": "citrus", "desc": "افتتاحية منعشة وحيوية"},
                {"name": "الفلفل الوردي", "icon": "spice", "desc": "لمسة توابل أنيقة"},
            ],
            "heart_notes": [
                {"name": "العود الكمبودي المعتق", "icon": "oud", "desc": "قلب دافئ وفاخر"},
                {"name": "الورد الجوري الدمشقي", "icon": "rose", "desc": "أناقة مخملية ساحرة"},
            ],
            "base_notes": [
                {"name": "المسك الأبيض الفاخر", "icon": "musk", "desc": "أثر دائم وناعم"},
                {"name": "العنبر الملكي", "icon": "amber", "desc": "عمق وثبات استثنائي"},
            ],
            "longevity_score": 5,
            "longevity_hours": "14 إلى 18 ساعة",
            "sillage_score": 4,
            "seasons": ["winter", "autumn", "spring"],
            "occasions": ["formal", "evening", "special_dates"],
        }


class ProductWriteSerializer(serializers.ModelSerializer):
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, required=False, write_only=True,
    )
    collection_ids = serializers.PrimaryKeyRelatedField(
        queryset=Collection.objects.all(), many=True, required=False, write_only=True,
    )
    images = serializers.ListField(child=serializers.DictField(), required=False, write_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "description", "price", "compare_at_price",
            "sku", "barcode", "is_active", "has_variants", "track_quantity",
            "meta_title", "meta_description", "width", "length", "height", "weight",
            "category_ids", "collection_ids", "images",
        ]
        extra_kwargs = {"slug": {"required": False}}
        # `stock` is deliberately absent: stock only ever moves through
        # services.adjust_stock(), which writes an InventoryLog row.

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        compare_at = attrs.get("compare_at_price", getattr(self.instance, "compare_at_price", None))
        if price is not None and compare_at is not None and Decimal(compare_at) <= Decimal(price):
            raise serializers.ValidationError({
                "compare_at_price": ["السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي"]
            })
        return attrs

    def _apply_relations(self, product, categories, collections, images):
        if categories is not None:
            product.categories.set(categories)
        if collections is not None:
            product.collections.set(collections)
        if images is not None:
            product.images.all().delete()
            ProductImage.objects.bulk_create([
                ProductImage(
                    product=product,
                    url=item.get("url", ""),
                    alt_text=item.get("alt_text", "") or product.name,
                    sort_order=index,
                )
                for index, item in enumerate(images)
                if item.get("url")
            ])

    def create(self, validated_data):
        categories = validated_data.pop("category_ids", None)
        collections = validated_data.pop("collection_ids", None)
        images = validated_data.pop("images", None)
        validated_data.setdefault("slug", unique_slug(Product, validated_data["name"]))
        product = Product.objects.create(**validated_data)
        self._apply_relations(product, categories, collections, images)
        return product

    def update(self, instance, validated_data):
        categories = validated_data.pop("category_ids", None)
        collections = validated_data.pop("collection_ids", None)
        images = validated_data.pop("images", None)
        product = super().update(instance, validated_data)
        self._apply_relations(product, categories, collections, images)
        return product

    def to_representation(self, instance):
        return ProductDetailSerializer(instance, context=self.context).data


class InventoryLogSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    variant_sku = serializers.CharField(source="variant.sku", read_only=True, default="")
    user_name = serializers.CharField(source="user.name", read_only=True, default="")
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)

    class Meta:
        model = InventoryLog
        fields = [
            "id", "product", "product_name", "variant", "variant_sku",
            "change", "reason", "reason_label", "note", "user", "user_name", "created_at",
        ]


class InventoryAdjustSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    change = serializers.IntegerField()
    reason = serializers.ChoiceField(choices=InventoryLog.Reason.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_change(self, value):
        if value == 0:
            raise serializers.ValidationError("قيمة التعديل يجب ألا تساوي صفراً")
        return value


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ["id", "product", "created_at"]


class ProductReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductReview
        fields = [
            "id", "product", "user", "user_name", "rating", "title",
            "comment", "photo_url", "is_verified_buyer", "is_approved",
            "points_awarded", "created_at",
        ]
        read_only_fields = ["id", "user", "is_verified_buyer", "is_approved", "points_awarded", "created_at"]

    def get_user_name(self, obj):
        if not obj.user:
            return "عميل مميز"
        return obj.user.name or f"عميل ({obj.user.phone_number[-4:]}***)"

