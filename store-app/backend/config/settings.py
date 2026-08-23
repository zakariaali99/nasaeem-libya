"""
Django settings — نسائم ليبيا

Every secret is read from the environment via python-decouple. No secret literal
lives in this repo, ever.
"""

from pathlib import Path

import dj_database_url
from decouple import Csv, config
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

DEBUG = config("DEBUG", default=False, cast=bool)
SECRET_KEY = config("SECRET_KEY", default="")
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="", cast=Csv())
DATABASE_URL = config("DATABASE_URL", default="")
REDIS_URL = config("REDIS_URL", default="")
CSRF_TRUSTED_ORIGINS = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())


# --------------------------------------------------------------------------
# Production boot guard
#
# Fail loudly at import, never silently at request time. The reference system
# shipped for months with `redis` missing from requirements, so its production
# boot guard could not be satisfied and every request 500'd — undetected,
# because nobody had ever run it with DEBUG=False.
# --------------------------------------------------------------------------
if not DEBUG:
    missing = [
        name
        for name, value in (
            ("SECRET_KEY", SECRET_KEY),
            ("ALLOWED_HOSTS", ALLOWED_HOSTS),
            ("DATABASE_URL", DATABASE_URL),
            ("REDIS_URL", REDIS_URL),
            ("CSRF_TRUSTED_ORIGINS", CSRF_TRUSTED_ORIGINS),
        )
        if not value
    ]
    if missing:
        raise ImproperlyConfigured(
            "DEBUG=False requires these environment variables: " + ", ".join(missing)
        )

if DEBUG and not SECRET_KEY:
    SECRET_KEY = "dev-only-insecure-key-never-used-when-debug-is-false"


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "rest_framework",
    "corsheaders",
    "apps.core",
    "apps.accounts",
    "apps.catalog",
    "apps.orders",
    "apps.payments",
    "apps.delivery",
    "apps.storefront",
    "apps.health",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# --------------------------------------------------------------------------
# Database — ATOMIC_REQUESTS makes every request a transaction. Never weaken it.
# --------------------------------------------------------------------------
DATABASES = {
    "default": dj_database_url.parse(
        DATABASE_URL or "postgres://localhost/nasaim_dev",
        conn_max_age=600,
    )
}
DATABASES["default"]["ATOMIC_REQUESTS"] = True

CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_URL or "redis://127.0.0.1:6379/0",
        "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"


# --------------------------------------------------------------------------
# Identity — a Libyan phone number is the username.
# --------------------------------------------------------------------------
AUTH_USER_MODEL = "core.User"

# Arabic-messaged subclasses of Django's validators — see apps/accounts/validators.py
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "apps.accounts.validators.UserAttributeSimilarityValidator"},
    {
        "NAME": "apps.accounts.validators.MinimumLengthValidator",
        "OPTIONS": {"min_length": 8},
    },
    {"NAME": "apps.accounts.validators.CommonPasswordValidator"},
    {"NAME": "apps.accounts.validators.NumericPasswordValidator"},
]


# --------------------------------------------------------------------------
# DRF — deny by default. Public endpoints opt out explicitly with AllowAny.
# --------------------------------------------------------------------------
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "1000/min" if DEBUG else "60/min",
        "user": "5000/min" if DEBUG else "240/min",
        "login": "5/min",
        "register": "5/min",
        "password_reset": "3/min",
    },
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "UNAUTHENTICATED_USER": "django.contrib.auth.models.AnonymousUser",
}


# --------------------------------------------------------------------------
# Cookies and transport security
# --------------------------------------------------------------------------
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = False  # the SPA must read it to set X-CSRFToken
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 0 if DEBUG else 31_536_000
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"
CSRF_FAILURE_VIEW = "apps.core.views.csrf_failure"

CORS_ALLOW_CREDENTIALS = True
CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5183,http://127.0.0.1:5183",
    cast=Csv(),
)


# --------------------------------------------------------------------------
# Locale — Arabic only, RTL, Libya.
# --------------------------------------------------------------------------
LANGUAGE_CODE = "ar"
TIME_ZONE = "Africa/Tripoli"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/django-static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(config("MEDIA_ROOT", default=str(BASE_DIR / "media")))

# --------------------------------------------------------------------------
# SEO shell
#
# Rule 1 forbids a Node runtime, so crawlers cannot be handed a JS-rendered
# page. Django instead serves the built SPA `index.html` and injects per-route
# <title>, <meta>, Open Graph and JSON-LD before </head> — see apps.storefront.spa.
#
# SITE_URL is the canonical origin used in absolute URLs (og:url, canonical,
# image src, sitemap). SPA_INDEX_CANDIDATES is searched in order; the built
# dist file wins in production, the source shell is the dev fallback.
# --------------------------------------------------------------------------
SITE_URL = config("SITE_URL", default="https://nasaeem.ly").rstrip("/")
CURRENCY = config("CURRENCY", default="LYD")

_FRONTEND_DIR = BASE_DIR.parent / "frontend"
SPA_INDEX_CANDIDATES = [
    _FRONTEND_DIR / "dist" / "index.html",
    _FRONTEND_DIR / "index.html",
]

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {"simple": {"format": "{levelname} {asctime} {name} {message}", "style": "{"}},
    "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "simple"}},
    "root": {"handlers": ["console"], "level": config("LOG_LEVEL", default="INFO")},
}
