"""Root URL configuration.

Everything the SPA calls lives under `/api/`. The Django admin is mounted at
`/django-admin/` — the operator-facing admin is the React app at `/admin`.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include("apps.health.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.storefront.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.delivery.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
