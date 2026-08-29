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
        return []

    def get_perfume_details(self, obj):
        if hasattr(obj, "perfume_details") and obj.perfume_details is not None:
            return PerfumeAttributeSerializer(obj.perfume_details).data
        return None


class ProductWriteSerializer(serializers.ModelSerializer):
    category_ids = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), many=True, required=False, write_only=True,
    )
    collection_ids = serializers.PrimaryKeyRelatedField(
        queryset=Collection.objects.all(), many=True, required=False, write_only=True,
    )
    images = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, write_only=True)
    perfume_details = serializers.DictField(required=False, allow_null=True, write_only=True)
    sizes = serializers.ListField(child=serializers.DictField(), required=False, allow_null=True, write_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "slug", "description", "price", "compare_at_price",
            "sku", "barcode", "is_active", "has_variants", "track_quantity",
            "meta_title", "meta_description", "width", "length", "height", "weight",
            "category_ids", "collection_ids", "images", "perfume_details", "sizes",
        ]
        extra_kwargs = {"slug": {"required": False}}
        # `stock` is deliberately absent: stock only ever moves through
        # services.adjust_stock(), which writes an InventoryLog row.

    def to_internal_value(self, data):
        if hasattr(data, "copy"):
            data = data.copy()
        elif isinstance(data, dict):
            data = dict(data)
        for field in ("price", "compare_at_price"):
            if field in data and data[field] is not None:
                val = str(data[field]).strip()
                # Normalize Eastern Arabic digits: ٠١٢٣٤٥٦٧٨٩ -> 0123456789
                for i, d in enumerate("٠١٢٣٤٥٦٧٨٩"):
                    val = val.replace(d, str(i))
                # Normalize Arabic comma and European comma to dot
                val = val.replace("،", ".").replace(",", ".")
                data[field] = val if val else None

        for list_field in ("category_ids", "collection_ids", "images", "sizes"):
            if list_field in data and data[list_field] is None:
                data[list_field] = []

        if "sizes" in data and data["sizes"] and (not data.get("price") or str(data.get("price")).strip() in ("", "0", "0.00")):
            valid_prices = [float(s["price"]) for s in data["sizes"] if s.get("price")]
            if valid_prices:
                data["price"] = str(min(valid_prices))

        return super().to_internal_value(data)

    def validate(self, attrs):
        price = attrs.get("price", getattr(self.instance, "price", None))
        compare_at = attrs.get("compare_at_price", getattr(self.instance, "compare_at_price", None))
        if price is not None and compare_at is not None and Decimal(compare_at) <= Decimal(price):
            raise serializers.ValidationError({
                "compare_at_price": ["السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي"]
            })
        return attrs

    def _apply_relations(self, product, categories, collections, images, perfume_details=None, sizes=None):
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
        if isinstance(perfume_details, dict) and perfume_details:
            from .models import PerfumeAttribute
            defaults = {
                "fragrance_family": perfume_details.get("fragrance_family", "شرقي فاخر"),
                "gender": perfume_details.get("gender", "UNISEX"),
                "concentration": perfume_details.get("concentration", "Eau de Parfum"),
                "origin_country": perfume_details.get("origin_country", "فرنسا"),
                "top_notes": perfume_details.get("top_notes", []),
                "heart_notes": perfume_details.get("heart_notes", []),
                "base_notes": perfume_details.get("base_notes", []),
                "longevity_score": int(perfume_details.get("longevity_score") or 5),
                "longevity_hours": str(perfume_details.get("longevity_hours") or "12 إلى 18 ساعة"),
                "sillage_score": int(perfume_details.get("sillage_score") or 4),
                "seasons": perfume_details.get("seasons", []),
                "occasions": perfume_details.get("occasions", []),
            }
            PerfumeAttribute.objects.update_or_create(
                product=product,
                defaults=defaults,
            )

        if sizes is not None and isinstance(sizes, list):
            from .models import VariantOption, VariantValue, ProductVariant, InventoryLog
            size_option, _ = VariantOption.objects.get_or_create(name="الحجم")

            existing_variants = {}
            for v in product.variants.prefetch_related("values").all():
                for val in v.values.all():
                    existing_variants[val.value.strip()] = v

            current_size_names = set()
            for s in sizes:
                if not isinstance(s, dict):
                    continue
                size_name = str(s.get("size") or s.get("name") or "").strip()
                if not size_name:
                    continue
                current_size_names.add(size_name)

                val_obj, _ = VariantValue.objects.get_or_create(option=size_option, value=size_name)

                raw_price = s.get("price") or product.price
                try:
                    price_val = Decimal(str(raw_price))
                except Exception:
                    price_val = product.price

                compare_val = None
                if s.get("compare_at_price"):
                    try:
                        compare_val = Decimal(str(s["compare_at_price"]))
                    except Exception:
                        compare_val = None

                stock_val = int(s.get("stock") or 0)
                sku_val = str(s.get("sku") or f"{product.sku or 'NAS'}-{size_name}").strip()
                is_active_val = bool(s.get("is_active", True))

                if size_name in existing_variants:
                    variant = existing_variants[size_name]
                    variant.price = price_val
                    variant.compare_at_price = compare_val
                    variant.sku = sku_val
                    variant.is_active = is_active_val
                    if stock_val != variant.stock:
                        delta = stock_val - variant.stock
                        variant.stock = stock_val
                        InventoryLog.objects.create(
                            product=product,
                            variant=variant,
                            change=delta,
                            reason=InventoryLog.Reason.MANUAL,
                            note=f"تعديل مخزون السعة {size_name}",
                        )
                    variant.save()
                else:
                    variant = ProductVariant.objects.create(
                        product=product,
                        price=price_val,
                        compare_at_price=compare_val,
                        sku=sku_val,
                        stock=stock_val,
                        is_active=is_active_val,
                    )
                    variant.values.set([val_obj])
                    if stock_val > 0:
                        InventoryLog.objects.create(
                            product=product,
                            variant=variant,
                            change=stock_val,
                            reason=InventoryLog.Reason.MANUAL,
                            note=f"المخزون الأولي للسعة {size_name}",
                        )

            # Deactivate or remove sizes not present anymore
            for old_size_name, old_variant in existing_variants.items():
                if old_size_name not in current_size_names:
                    if old_variant.reserved_stock > 0:
                        old_variant.is_active = False
                        old_variant.save(update_fields=["is_active", "updated_at"])
                    else:
                        old_variant.delete()

            from django.db.models import Sum
            total_variants = ProductVariant.objects.filter(product=product)
            if total_variants.exists():
                product.has_variants = True
                product.stock = total_variants.aggregate(s=Sum("stock"))["s"] or 0
                active_variants = total_variants.filter(is_active=True, price__isnull=False)
                if active_variants.exists():
                    product.price = min(v.price for v in active_variants)
                product.save(update_fields=["has_variants", "stock", "price", "updated_at"])
            else:
                product.has_variants = False
                product.save(update_fields=["has_variants", "updated_at"])

    def create(self, validated_data):
        categories = validated_data.pop("category_ids", None)
        collections = validated_data.pop("collection_ids", None)
        images = validated_data.pop("images", None)
        perfume_details = validated_data.pop("perfume_details", None)
        sizes = validated_data.pop("sizes", None)
        validated_data.setdefault("slug", unique_slug(Product, validated_data["name"]))
        product = Product.objects.create(**validated_data)
        self._apply_relations(product, categories, collections, images, perfume_details, sizes)
        return product

    def update(self, instance, validated_data):
        categories = validated_data.pop("category_ids", None)
        collections = validated_data.pop("collection_ids", None)
        images = validated_data.pop("images", None)
        perfume_details = validated_data.pop("perfume_details", None)
        sizes = validated_data.pop("sizes", None)
        product = super().update(instance, validated_data)
        self._apply_relations(product, categories, collections, images, perfume_details, sizes)
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

