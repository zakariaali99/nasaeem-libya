"""Root URL configuration.

Everything the SPA calls lives under `/api/`. The Django admin is mounted at
`/django-admin/` — the operator-facing admin is the React app at `/admin`.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from apps.storefront import spa

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/", include("apps.health.urls")),
    path("api/", include("apps.core.urls")),
    path("api/", include("apps.accounts.urls")),
    path("api/", include("apps.catalog.urls")),
    path("api/", include("apps.storefront.urls")),
    path("api/", include("apps.orders.urls")),
    path("api/", include("apps.delivery.urls")),
    path("api/", include("apps.payments.urls")),
    path("robots.txt", spa.robots_txt, name="robots"),
    path("sitemap.xml", spa.sitemap_xml, name="sitemap"),
]

from django.views.static import serve


def serve_media(request, path, **kwargs):
    """Serve uploaded media with aggressive cache-control headers."""
    response = serve(request, path, document_root=settings.MEDIA_ROOT, **kwargs)
    response["Cache-Control"] = "public, max-age=2592000, immutable"
    return response


urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", serve_media),
]

# SPA shell — LAST. Serves every non-API, non-admin, non-asset path with the
# built index.html, injecting per-product SEO.
urlpatterns += [
    re_path(
        r"^(?!api/|django-admin/|django-static/|media/|assets/|fonts/|brand/|brands/|providers/|favicon\.svg|sw\.js|manifest\.webmanifest)(?P<path>.*)$",
        spa.render_shell,
        name="spa-shell",
    ),
]
