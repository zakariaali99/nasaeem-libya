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

from .models import StorefrontLayout, Widget, WidgetType
from .services import normalise_widget_data


class WidgetReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Widget
        fields = ["id", "type", "order", "data", "is_active", "style", "targeting"]


class LayoutSerializer(serializers.ModelSerializer):
    widgets = WidgetReadSerializer(many=True, read_only=True)

    class Meta:
        model = StorefrontLayout
        fields = [
            "id", "name", "is_global_active",
            "active_start_date", "active_end_date", "active_days",
            "active_start_hour", "active_end_hour",
            "widgets", "created_at", "updated_at",
        ]


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
            seen_types: set[str] = set()
            for index, raw in enumerate(widgets_payload):
                if not isinstance(raw, dict) or raw.get("type") not in WidgetType.values:
                    errors.setdefault("widgets", []).append(f"أداة #{index + 1}: نوع غير معروف")
                    continue
                widget_type = raw["type"]
                data = normalise_widget_data(widget_type, raw.get("data"))
                targeting = raw.get("targeting") if isinstance(raw.get("targeting"), dict) else None
                cleaned_widgets.append({
                    "id": raw.get("id"),
                    "type": widget_type,
                    "data": data,
                    "is_active": bool(raw.get("is_active", True)),
                    "targeting": targeting,
                })
                seen_types.add(widget_type)

        field_values = {}
        for field in layout_fields:
            if field in request.data:
                value = request.data[field]
                if field == "name" and not str(value).strip():
                    errors["name"] = ["اسم التخطيط مطلوب"]
                elif field == "active_days":
                    if not isinstance(value, list):
                        errors[field] = ["يجب أن تكون قائمة أيام"]
                elif field.endswith("_hour"):
                    if value is not None and not (0 <= int(value or 0) <= 23):
                        errors[field] = ["الساعة بين 0 و 23"]
                field_values[field] = value

        if errors:
            return Response({"message": "تحتوي البيانات على قيم غير صحيحة", "errors": errors},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for field, value in field_values.items():
                setattr(layout, field, value)
            layout.save()

            if widgets_payload is not None:
                existing = {w.id: w for w in layout.widgets.all()}
                keep_ids: set[str] = set()
                for order_index, item in enumerate(cleaned_widgets):
                    widget_id = item.get("id")
                    if widget_id and widget_id in existing:
                        widget = existing[widget_id]
                        widget.type = item["type"]
                        widget.data = item["data"]
                        widget.is_active = item["is_active"]
                        widget.targeting = item["targeting"]
                        widget.order = order_index
                        widget.save()
                        keep_ids.add(str(widget.id))
                    else:
                        created = Widget.objects.create(
                            layout=layout,
                            type=item["type"],
                            data=item["data"],
                            is_active=item["is_active"],
                            targeting=item["targeting"],
                            order=order_index,
                        )
                        keep_ids.add(str(created.id))
                layout.widgets.exclude(id__in=keep_ids).delete()

        layout.refresh_from_db()
        return Response({"data": LayoutSerializer(self.get_object(layout_id)).data,
                         "message": "تم حفظ التغييرات — الصفحة الرئيسية تعرضها الآن"})

    def delete(self, request, layout_id):
        layout = self.get_object(layout_id)
        if layout is None:
            return Response({"message": "التخطيط غير موجود"}, status=status.HTTP_404_NOT_FOUND)
        layout.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
