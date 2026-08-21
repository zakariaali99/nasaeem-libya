"""Readiness probe — checks real connections, not configuration."""

from django.db import connection
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from django.core.cache import cache


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([])
def health(request):
    database = "ok"
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception as exc:  # noqa: BLE001 - the probe reports, it does not raise
        database = f"error: {exc.__class__.__name__}"

    cache_state = "ok"
    try:
        cache.set("health:probe", "1", 5)
        if cache.get("health:probe") != "1":
            cache_state = "error: readback mismatch"
    except Exception as exc:  # noqa: BLE001
        cache_state = f"error: {exc.__class__.__name__}"

    healthy = database == "ok" and cache_state == "ok"
    return Response(
        {"status": "ok" if healthy else "degraded", "database": database, "cache": cache_state},
        status=200 if healthy else 503,
    )
