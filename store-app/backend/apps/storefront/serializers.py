"""Storefront CMS serializers.

`data` is **normalised on write** (`services.normalise_widget_data`) so the read
side hands the client exactly one shape per widget type and the client never has
to guess between `imageUrl` / `image_url` / `url`.
"""

from rest_framework import serializers

from apps.catalog.serializers import (
    CategorySerializer,
    CollectionSerializer,
    ProductListSerializer,
)

from . import services
from .models import StorefrontLayout, Widget


class WidgetSerializer(serializers.ModelSerializer):
    data = serializers.SerializerMethodField()

    class Meta:
        model = Widget
        fields = ["id", "type", "order", "is_active", "style", "targeting", "data"]

    def get_data(self, widget):
        context = self.context
        return services.populate(
            widget,
            user=context.get("user"),
            recent_ids=context.get("recent_ids", ()),
            serialize_product=lambda products: ProductListSerializer(
                products, many=True, context=context
            ).data,
            serialize_category=lambda categories: CategorySerializer(
                categories, many=True, context=context
            ).data,
            serialize_collection=lambda collection: CollectionSerializer(
                collection, context=context
            ).data,
        )


class StorefrontLayoutSerializer(serializers.ModelSerializer):
    widgets = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontLayout
        fields = ["id", "name", "updated_at", "widgets"]

    def get_widgets(self, layout):
        widgets = self.context.get("widgets", [])
        return WidgetSerializer(widgets, many=True, context=self.context).data


class WidgetWriteSerializer(serializers.ModelSerializer):
    """Admin writes (Phase 8). Normalisation happens here, once."""

    class Meta:
        model = Widget
        fields = ["id", "layout", "type", "data", "order", "is_active", "style", "targeting"]

    def validate(self, attrs):
        widget_type = attrs.get("type") or getattr(self.instance, "type", None)
        if "data" in attrs or self.instance is None:
            attrs["data"] = services.normalise_widget_data(widget_type, attrs.get("data"))
        return attrs
