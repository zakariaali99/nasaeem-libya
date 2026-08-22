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

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA shell — LAST. Serves every non-API, non-admin, non-asset path with the
# built index.html, injecting per-product SEO. nginx serves real files (assets,
# fonts, media) directly and only falls through to here for HTML navigations,
# but the negative lookahead keeps Django honest when it is hit directly.
urlpatterns += [
    re_path(
        r"^(?!api/|django-admin/|django-static/|media/)(?P<path>.*)$",
        spa.render_shell,
        name="spa-shell",
    ),
]
