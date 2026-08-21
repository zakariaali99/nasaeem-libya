# 03 — API contract

Base path `/api/`. JSON in, JSON out. Session cookie auth. CSRF on every unsafe
method. **Every route below must exist.**

## Conventions

**Success**
```json
{ "data": <payload>, "message": "optional Arabic message" }
```
**List**
```json
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 137, "pages": 7 } }
```
**Error** — message is Arabic, it is shown to the user
```json
{ "message": "رقم الهاتف أو كلمة المرور غير صحيحة", "errors": { "field": ["..."] } }
```

**Status codes.** 200 ok · 201 created · 204 deleted · 400 validation ·
401 unauthenticated · 403 forbidden · 404 missing · 409 conflict (e.g. oversell)
· 429 throttled · 500 server.

**Permissions are deny-by-default.** DRF `DEFAULT_PERMISSION_CLASSES =
["rest_framework.permissions.IsAuthenticated"]`. Public endpoints opt out
explicitly with `AllowAny`. Admin endpoints require a role in
`{staff, manager, admin, owner}`.

---

## Auth — `apps/accounts`

| Method | Path | Auth | Body / Notes |
|---|---|---|---|
| GET | `/api/auth/csrf/` | public | sets the CSRF cookie |
| POST | `/api/auth/register/` | public | `{phone_number, password, name}` → 201 + session |
| POST | `/api/auth/login/` | public | `{phone_number, password}` → 200 + session |
| POST | `/api/auth/logout/` | user | invalidates server-side |
| GET | `/api/auth/me/` | user | 401 anonymous, user JSON authenticated |
| PATCH | `/api/admin/users/<id>/` | admin | role, ban, activate |

**Rules, all mandatory:**
- `login` **must** call `authenticate()`. Never look a user up by phone and log
  them in. See `01-architecture.md`.
- Unknown phone and wrong password return **byte-identical** responses:
  `"رقم الهاتف أو كلمة المرور غير صحيحة"`. No user-enumeration oracle.
- `AUTH_PASSWORD_VALIDATORS` enabled, minimum length 8.
- Throttle login **per phone number**, not only per IP. Brute-forcing a password
  is cheaper than an OTP, so this matters more, not less.
- A banned user gets no session.
- Passwords stored via `set_password()`. Never plaintext, never a custom hash.

---

## Catalog — `apps/catalog`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/products/` | public | `?page,limit,search,category,collection,ids,min_price,max_price,sort,is_active` |
| GET | `/api/products/<slug_or_id>/` | public | resolves by slug **or** UUID |
| POST/PATCH/DELETE | `/api/products/...` | admin | |
| GET | `/api/categories/` | public | tree, `parent` nesting |
| GET | `/api/categories/<id_or_slug>/` | public | |
| GET | `/api/categories/<id>/products/` | public | |
| GET | `/api/collections/` | public | |
| GET | `/api/collections/<id_or_slug>/` | public | |
| GET | `/api/collections/<id>/products/` | public | |
| GET/POST | `/api/options/` | admin | variant options |
| GET/PATCH/DELETE | `/api/options/<id>/` | admin | |
| GET/POST | `/api/options/<id>/values/` | admin | |
| GET/POST | `/api/variants/` | admin | |
| GET/PATCH/DELETE | `/api/variants/<id>/` | admin | |
| GET | `/api/admin/inventory/` | admin | current levels |
| POST | `/api/admin/inventory/adjust/` | admin | `{product_id, variant_id?, change, reason, note}` |
| GET | `/api/admin/inventory/logs/` | admin | append-only history |
| POST | `/api/images/` | admin | multipart upload → renditions |

`GET /api/products/` must return, per product: `id, name, slug, price,
compare_at_price, images[], has_variants, stock, reserved_stock, is_active,
categories[], collections[], discounts[]`. The card needs all of it; do not make
the client fetch twice.

---

## Cart & checkout — `apps/orders`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/cart/` | **public** | guest or user cart |
| POST | `/api/cart/` | **public** | `{product_id, variant_id?, quantity}` |
| PATCH | `/api/cart/<item_id>/` | public | `{quantity}` |
| DELETE | `/api/cart/<item_id>/` | public | |
| GET/PATCH | `/api/cart/details/` | public | notes, address selection |
| POST | `/api/cart/checkout/` | **user** | creates the order |
| GET | `/api/checkout/<order_id>/` | user | checkout state |
| POST | `/api/checkout/` | user | |
| GET | `/api/orders/` | user | own orders; admin sees all |
| GET | `/api/orders/<id>/` | user | own only, unless admin |
| PATCH | `/api/orders/<id>/` | admin | status, shipping, tracking |
| GET/POST | `/api/discounts/` | mixed | validate public, manage admin |
| GET/PATCH/DELETE | `/api/discounts/<id>/` | admin | |

**Guest cart is public by design.** Identify by `session_id`. Merge into the user
cart on login. **Auth is required at checkout, not at add-to-cart.**

**Checkout is the critical section.** In one transaction: lock rows with
`select_for_update()` in a stable order; re-validate every price and every stock
level server-side; apply the discount; compute the delivery fee from the region;
create Order + OrderItems with snapshotted names and prices; reserve stock; empty
the cart. **Never trust a price or a total sent by the client.**

---

## Delivery — `apps/delivery`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/delivery/methods/` | public | enabled couriers |
| GET | `/api/delivery/cities/` | public | |
| GET | `/api/delivery/cities/<id>/` | public | |
| GET | `/api/delivery/cities/<city_id>/regions/` | public | |
| GET | `/api/delivery/regions/<id>/` | public | |
| GET | `/api/geo/` | public | resolve region from request |
| POST/PATCH | `/api/delivery/...` | admin | courier config |

> If the city list is empty the checkout UI **must say so explicitly**. It must
> never render an empty `<select>` with no explanation — the reference did, and a
> customer simply could not complete the order.

---

## Payments — `apps/payments`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/payment_methods/` | public | **safe fields only** |
| GET | `/api/payment_methods/<code>/` | admin | full config |
| PATCH | `/api/payment_methods/<code>/` | admin | |
| GET | `/api/payments/` | user/admin | |
| POST | `/api/payments/` | user | initiate → redirect or instructions |
| POST | `/api/payments/<id>/verify/` | user | confirm |
| POST | `/api/payments/webhook/<provider>/` | **public + signature** | |

**Webhooks:** verify the provider signature before trusting a byte. Make handling
**idempotent** — the same event delivered twice must not double-credit an order.
Log every webhook payload.

---

## Storefront CMS — `apps/storefront`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/storefront/layout/` | public | resolved active layout + widgets |
| GET/POST | `/api/customization/` | admin | layouts |
| GET/PATCH/DELETE | `/api/customization/<id>/` | admin | |
| POST | `/api/customization/<id>/duplicate/` | admin | |

`GET /api/storefront/layout/` resolves which layout is active from
`is_global_active`, date range, `active_days`, and hour window; returns its
widgets ordered by `order`, `is_active` only, with `data` **normalised** and
`product_list` / `category_list` / `collection_showcase` widgets **already
populated** with their objects. One request renders the homepage.

---

## Health

`GET /api/health/` → `{"status": "ok", "database": "ok", "cache": "ok"}`.
Checks real connections. 503 if either is down.
