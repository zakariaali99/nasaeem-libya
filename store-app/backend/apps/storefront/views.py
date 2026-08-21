"""`GET /api/storefront/layout/` — one request renders the homepage.

No layout means no homepage, so this endpoint answers 200 with a null layout and
an empty widget list rather than 404: the client shows a designed empty state,
never an error page.
"""

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import StorefrontLayoutSerializer, WidgetSerializer


class StorefrontLayoutView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        layout, widgets = services.cached_layout_rows()
        visible = [w for w in widgets if services.widget_is_visible(w, user=request.user)]

        # Browsing history lives client-side; `?recent=<id>,<id>` feeds the
        # recently-viewed widget. There is no server-side view-tracking table.
        recent = [
            value for value in (request.query_params.get("recent") or "").split(",") if value
        ][:24]

        context = {"request": request, "user": request.user, "recent_ids": recent,
                   "widgets": visible}

        if layout is None:
            return Response({"data": {"layout": None, "widgets": []}})

        payload = StorefrontLayoutSerializer(layout, context=context).data
        return Response({
            "data": {
                "layout": {"id": payload["id"], "name": payload["name"],
                           "updated_at": payload["updated_at"]},
                "widgets": payload["widgets"],
            }
        })


__all__ = ["StorefrontLayoutView", "WidgetSerializer"]
