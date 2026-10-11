"""Operator API for the homepage builder.

`PATCH /api/admin/storefront-layouts/<id>/` accepts the layout's scheduling
fields and, when the body carries a `widgets` key, the **entire ordered widget
list** — replace-all semantics. The builder owns the whole page; partial widget
diffs are where reorder bugs hide. Every written widget passes through
`services.normalise_widget_data`, so what an operator saves is the same shape
the storefront renders.

The `post_save`/`post_delete` signals invalidate the Redis-cached layout, which
is exactly why "save → visible immediately" is reachable.
"""

from django.db import transaction
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminRole

from django.utils.dateparse import parse_datetime

from . import services
from .models import StorefrontLayout, Widget, WidgetType
from .services import normalise_widget_data

WEEKDAYS = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")


class WidgetReadSerializer(serializers.ModelSerializer):
    """`data` comes back **populated** (the chosen products, categories and
    collection attached), exactly as the storefront receives it, so the
    builder's preview shows the real thing and its pickers know what is already
    chosen. The extra keys are dropped again by the normaliser on save."""

    data = serializers.SerializerMethodField()

    class Meta:
        model = Widget
        fields = ["id", "type", "order", "data", "is_active", "style", "targeting"]

    def get_data(self, widget):
        from apps.catalog.serializers import (
            CategorySerializer,
            CollectionSerializer,
            ProductListSerializer,
        )

        return services.populate(
            widget,
            user=None,
            serialize_product=lambda products: ProductListSerializer(products, many=True).data,
            serialize_category=lambda categories: CategorySerializer(categories, many=True).data,
            serialize_collection=lambda collection: CollectionSerializer(collection).data,
        )


class LayoutSerializer(serializers.ModelSerializer):
    widgets = WidgetReadSerializer(many=True, read_only=True)
    is_live = serializers.SerializerMethodField()
    has_schedule = serializers.SerializerMethodField()

    class Meta:
        model = StorefrontLayout
        fields = [
            "id", "name", "is_global_active", "is_live", "has_schedule",
            "active_start_date", "active_end_date", "active_days",
            "active_start_hour", "active_end_hour",
            "widgets", "created_at", "updated_at",
        ]

    def get_is_live(self, layout):
        """True for the one layout the homepage is showing right now — being
        switched on is not the same thing (a schedule may be outside its window,
        or a scheduled layout may currently be taking over)."""
        if "live_id" not in self.context:
            live = services.resolve_active_layout()
            self.context["live_id"] = live.id if live else None
        return layout.id == self.context["live_id"]

    def get_has_schedule(self, layout):
        return services.has_schedule(layout)


class AdminLayoutListView(APIView):
    permission_classes = [IsAdminRole]

    def get(self, request):
        layouts = StorefrontLayout.objects.prefetch_related("widgets").order_by("-updated_at")
        return Response({"data": LayoutSerializer(layouts, many=True).data})

    def post(self, request):
        name = str(request.data.get("name") or "").strip()
        if not name:
            return Response({"message": "اسم التخطيط مطلوب"}, status=status.HTTP_400_BAD_REQUEST)
        layout = StorefrontLayout.objects.create(name=name)
        return Response(
            {"data": LayoutSerializer(layout).data, "message": "تم إنشاء التخطيط"},
            status=status.HTTP_201_CREATED,
        )


class AdminLayoutDetailView(APIView):
    permission_classes = [IsAdminRole]

    def get_object(self, layout_id):
        return (
            StorefrontLayout.objects.prefetch_related("widgets")
            .filter(id=layout_id)
            .first()
        )

    def get(self, request, layout_id):
        layout = self.get_object(layout_id)
        if layout is None:
            return Response({"message": "التخطيط غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        return Response({"data": LayoutSerializer(layout).data})

    def patch(self, request, layout_id):
        layout = self.get_object(layout_id)
        if layout is None:
            return Response({"message": "التخطيط غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        layout_fields = {
            "name", "is_global_active", "active_start_date", "active_end_date",
            "active_days", "active_start_hour", "active_end_hour",
        }
        errors: dict[str, list[str]] = {}

        widgets_payload = request.data.get("widgets")
        if widgets_payload is not None and not isinstance(widgets_payload, list):
            return Response({"message": "قائمة الأدوات غير صالحة"}, status=status.HTTP_400_BAD_REQUEST)

        cleaned_widgets = []
        if widgets_payload is not None:
            for index, raw in enumerate(widgets_payload):
                if not isinstance(raw, dict) or raw.get("type") not in WidgetType.values:
                    errors.setdefault("widgets", []).append(f"أداة #{index + 1}: نوع غير معروف")
                    continue
                item = {
                    "id": str(raw["id"]) if raw.get("id") else None,
                    "type": raw["type"],
                    "data": normalise_widget_data(raw["type"], raw.get("data")),
                    "is_active": bool(raw.get("is_active", True)),
                }
                # Style and targeting have no editor yet: a save that does not
                # mention them must keep what the widget already has, not wipe it.
                for key in ("style", "targeting"):
                    if key in raw:
                        item[key] = raw[key] if isinstance(raw[key], dict) else None
                cleaned_widgets.append(item)

        field_values = {}
        for field in layout_fields:
            if field not in request.data:
                continue
            value = request.data[field]
            if field == "name":
                value = str(value or "").strip()
                if not value:
                    errors["name"] = ["اسم التخطيط مطلوب"]
            elif field == "is_global_active":
                value = bool(value)
            elif field == "active_days":
                if not isinstance(value, list) or any(str(day).lower() not in WEEKDAYS for day in value):
                    errors[field] = ["أيام غير صحيحة"]
                else:
                    value = [str(day).lower() for day in value]
            elif field.endswith("_hour"):
                if value in ("", None):
                    value = None
                else:
                    try:
                        value = int(value)
                    except (TypeError, ValueError):
                        value = -1
                    if not 0 <= value <= 23:
                        errors[field] = ["الساعة بين 0 و 23"]
            elif field.endswith("_date"):
                if value in ("", None):
                    value = None
                else:
                    value = parse_datetime(str(value))
                    if value is None:
                        errors[field] = ["تاريخ غير صحيح"]
            field_values[field] = value

        start = field_values.get("active_start_date", layout.active_start_date)
        end = field_values.get("active_end_date", layout.active_end_date)
        if start and end and "active_start_date" not in errors and "active_end_date" not in errors and end <= start:
            errors["active_end_date"] = ["تاريخ النهاية يجب أن يكون بعد تاريخ البداية"]

        if errors:
            return Response({"message": "تحتوي البيانات على قيم غير صحيحة", "errors": errors},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for field, value in field_values.items():
                setattr(layout, field, value)
            layout.save()

            # One everyday homepage. Switching on a layout that has no schedule
            # switches the other unscheduled ones off, so the homepage is never
            # decided by which layout happened to be saved last. Scheduled
            # layouts are left alone: they take over only inside their window.
            if layout.is_global_active and not services.has_schedule(layout):
                for other in StorefrontLayout.objects.filter(is_global_active=True).exclude(id=layout.id):
                    if not services.has_schedule(other):
                        other.is_global_active = False
                        other.save(update_fields=["is_global_active", "updated_at"])

            if widgets_payload is not None:
                existing = {str(w.id): w for w in layout.widgets.all()}
                keep_ids: set[str] = set()
                for order_index, item in enumerate(cleaned_widgets):
                    widget = existing.get(item["id"]) if item["id"] else None
                    if widget is None:
                        widget = Widget(layout=layout)
                    widget.type = item["type"]
                    widget.data = item["data"]
                    widget.is_active = item["is_active"]
                    widget.order = order_index
                    for key in ("style", "targeting"):
                        if key in item:
                            setattr(widget, key, item[key])
                    widget.save()
                    keep_ids.add(str(widget.id))
                layout.widgets.exclude(id__in=keep_ids).delete()

        layout = self.get_object(layout_id)
        data = LayoutSerializer(layout).data
        if data["is_live"]:
            message = "تم الحفظ — الصفحة الرئيسية تعرض هذا التخطيط الآن"
        elif layout.is_global_active:
            message = "تم الحفظ — التخطيط مفعّل لكنه خارج وقت جدولته، أو يحلّ محله تخطيط مجدول آخر الآن"
        else:
            message = "تم الحفظ — التخطيط غير معروض على المتجر حتى تفعّله"
        return Response({"data": data, "message": message})

    def delete(self, request, layout_id):
        layout = self.get_object(layout_id)
        if layout is None:
            return Response({"message": "التخطيط غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        layout.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminLayoutDuplicateView(APIView):
    """`POST /api/admin/storefront-layouts/<id>/duplicate/` — deep clone a layout."""

    permission_classes = [IsAdminRole]

    def post(self, request, layout_id):
        layout = StorefrontLayout.objects.prefetch_related("widgets").filter(id=layout_id).first()
        if layout is None:
            return Response({"message": "التخطيط غير موجود"}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            new_layout = StorefrontLayout.objects.create(
                name=f"{layout.name} (نسخة)",
                is_global_active=False,
                active_start_date=layout.active_start_date,
                active_end_date=layout.active_end_date,
                active_days=layout.active_days,
                active_start_hour=layout.active_start_hour,
                active_end_hour=layout.active_end_hour,
            )
            for widget in layout.widgets.all():
                Widget.objects.create(
                    layout=new_layout,
                    type=widget.type,
                    data=widget.data,
                    is_active=widget.is_active,
                    style=widget.style,
                    targeting=widget.targeting,
                    order=widget.order,
                )

        return Response(
            {"data": LayoutSerializer(new_layout).data, "message": "تم استنساخ التخطيط بنجاح"},
            status=status.HTTP_201_CREATED,
        )

