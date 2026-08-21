# 04 — Backend specification (Django)

## Stack

Python 3.12+ · Django 5.x · djangorestframework · psycopg[binary] ·
django-redis · Pillow · gunicorn · python-decouple · django-cors-headers ·
pytest + pytest-django.

**`requirements.txt` must be complete.** The reference shipped for months with
`redis` missing, which made the production boot guard unsatisfiable — every
request 500'd because throttling could not reach the cache, and nobody noticed
because nobody had ever run it with `DEBUG=False`. **Run the app with
`DEBUG=False` before declaring any phase complete.**

## `config/settings.py`

Read every secret from the environment via `python-decouple`. No secret literal
in the repo, ever.

```
SECRET_KEY            required, no default in production
DEBUG                 default False
ALLOWED_HOSTS         required when DEBUG=False
DATABASE_URL          postgres://...
REDIS_URL             redis://...
CSRF_TRUSTED_ORIGINS  required when DEBUG=False
MEDIA_ROOT/MEDIA_URL  uploads
```

Mandatory settings:

```python
ATOMIC_REQUESTS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework.authentication.SessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_THROTTLE_CLASSES": [...],
    "DEFAULT_THROTTLE_RATES": {"anon": "60/min", "user": "240/min", "login": "5/min"},
}

AUTH_USER_MODEL = "core.User"
AUTH_PASSWORD_VALIDATORS = [...]   # enabled, min length 8

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = 31536000        # production
X_FRAME_OPTIONS = "DENY"
SECURE_CONTENT_TYPE_NOSNIFF = True
```

**A production boot guard**: if `DEBUG=False` and `SECRET_KEY`, `ALLOWED_HOSTS`,
`DATABASE_URL` or `REDIS_URL` is missing, raise `ImproperlyConfigured` at import.
Fail loudly at boot, never silently at request time.

> **Rule, absolute:** no security bypass may be added in any environment for any
> reason. No test phone numbers, no fixed verification codes, no
> `if DEBUG: skip_auth`. The reference had `OTP_TEST_NUMBERS` and it was a real
> vulnerability. **If a test needs a bypass, the test is wrong.** Use fixtures
> and mocks.

## App-by-app

### `core`
`User` + `UserManager`, `City`, `Region`, `UserAddress`. Register `User` in the
Django admin with a proper admin class. No business logic here — models only.

### `accounts`
Register, login, logout, me, csrf, admin user management.
`throttling.py` holds a `ScopedRateThrottle` keyed on **the submitted phone
number** for login and register.

Serializer rules: `RegisterSerializer` validates the phone with a Libyan-format
regex, runs `validate_password`, and rejects a duplicate phone with a generic
message. `LoginSerializer` never reveals which half of the credential failed.

### `catalog`
Products, categories, collections, variants, options, images, inventory.
`services.py` owns: slug generation (`allow_unicode`), variant matrix
generation, stock adjustment (**always writes an `InventoryLog`**), and image
rendition generation via Pillow.

Product list queries must use `select_related` / `prefetch_related` for images,
categories, collections and discounts. **N+1 on the catalogue is a bug**, and it
is the difference between a fast store and an unusable one on Libyan mobile data.

### `orders`
Cart, checkout, orders, discounts, delivery methods.

**`services.py` is the heart of the system.** It contains `checkout()`, which
must:
1. open a transaction,
2. `select_for_update()` every product and variant row **in a stable order**
   (sort by primary key) to avoid deadlocks,
3. re-read every price from the database — **never from the request**,
4. verify `stock - reserved_stock >= quantity` for each line, else **409**,
5. validate the discount (active, in date, under `usage_limit`, meets
   `min_order_amount`, capped by `max_discount_amount`),
6. compute the delivery fee from the region,
7. create the Order and OrderItems with `product_name` and `unit_price`
   snapshotted,
8. increment `reserved_stock`,
9. clear the cart,
10. return the order.

Order numbers are generated collision-safely — a sequence or a
`select_for_update` counter, not `random`.

### `payments`
`providers/base.py` defines the interface:
`initiate(order, config) -> PaymentIntent` ·
`verify(payment, payload, config) -> PaymentStatus` ·
`handle_webhook(request, config) -> Event`.

`providers/registry.py` maps `method_code` → provider class. Adding a gateway
means adding one file and one registry line — nothing else changes.

Implement, matching the reference: **moamalat**, **bank_cards** (bank cards on
delivery), **manual** (manual transfer with proof upload). The reference also
carries **plutu**, **binance_pay** and **sadad_pay** — port them from
`reference/` where implementations exist; where they do not, scaffold the
provider, register it, and mark it disabled. **Never invent a hash algorithm or
a signing scheme** — copy the reference's exactly, byte for byte. A payment hash
that is "nearly right" fails in production with real money.

### `delivery`
Same provider pattern. `providers/vanex.py` exists in the reference; **nawres**
and **darb_sabeel** are also required by the admin screens. Cities and regions
are synced from the courier API into `core.City` / `core.Region`.

### `storefront`
Layout resolution and widget normalisation, as specified in `03-api-contract.md`.
Cache the resolved layout in Redis for ~1 hour, and **invalidate on any widget or
layout write**.

### `health`
Real connection checks to PostgreSQL and Redis.

## Testing

`pytest` with `pytest-django`. Required coverage:
- **auth**: no session without a password; identical error for unknown phone and
  wrong password; throttle returns 429; banned user rejected; 4-character
  password rejected; password stored hashed.
- **checkout**: concurrent checkout of the last unit — **one succeeds, one gets
  409**. Write it with threads and real DB locking, not mocks. This test is the
  reason `select_for_update` exists.
- **discounts**: every branch — expired, over limit, below minimum, capped.
- **payments**: webhook signature rejection; idempotent double delivery.
- **permissions**: every admin endpoint returns 403 for a customer.

A test that has never failed proves nothing. Write the test, watch it fail, then
make it pass.
