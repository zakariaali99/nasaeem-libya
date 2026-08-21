# 08 — Features

## Storefront widget CMS

The homepage is **entirely CMS-driven**. An operator composes it from widgets in
`/admin/customization/:layoutId`. **No layout means no homepage** — so the empty
state matters enormously.

### Layout resolution
A layout is active when `is_global_active` is true **and** now falls inside
`active_start_date`/`active_end_date` (when set) **and** today is in
`active_days` (when set) **and** the hour is inside
`active_start_hour`/`active_end_hour` (when set). If several match, the most
recently updated wins. If none match, fall back to the global default.

### The 14 widget types and their `data` shape

| Type | `data` |
|---|---|
| `carousel` | `{slides: [{imageUrl, linkUrl?, title?, subtitle?}], carouselStyle: "hero"\|"normal"}` |
| `text_block` | `{content}` |
| `image` | `{imageUrl, altText, linkUrl?}` |
| `product_list` | `{title, productIds: [], layout: "grid"\|"slider"}` |
| `collection_showcase` | `{collectionId, layout}` |
| `category_list` | `{title, categoryIds: [], layout}` |
| `photo_link_grid` | `{title?, items: [{imageUrl, linkUrl, label?}]}` |
| `hero_cta` | `{title, subtitle, buttonLabel, buttonUrl, alignment: "start"\|"center"\|"end", backgroundImageUrl}` |
| `announcement_bar` | `{title, message, linkLabel?, linkUrl?, dismissible, icon}` |
| `spacer` | `{height}` |
| `recently_viewed` | `{title, limit, layout}` |
| `buy_again` | `{title, limit, layout}` |
| `recommended_for_you` | `{title, limit, layout}` |
| `trending_near_you` | `{title, limit, layout}` |

**Normalise on write.** The reference accepted `imageUrl`, `image_url` and `url`
for the same field and normalised on every read, in the client. Pick one shape,
enforce it in the serializer, and let the client trust it.

`style` carries per-widget presentation (background, padding, alignment).
`targeting` carries visibility rules: `{isGuest?, segment?, region?}`. The four
personalised widgets are populated server-side from the user's history; for a
guest, they fall back to popular products rather than rendering empty.

---

## Payments

Six gateways. All follow `providers/base.py`.

| `method_code` | Description |
|---|---|
| `moamalat` | Card gateway (Libya). Hosted redirect + webhook. |
| `plutu` | Aggregator — Sadad, Adfali, local wallets. |
| `sadad_pay` | Sadad direct. |
| `binance_pay` | Crypto. |
| `manual_payment` | Bank transfer; customer uploads proof; operator verifies. |
| `bank_cards_on_delivery` | Card machine at the door. |

### Rules that are not negotiable

1. **Copy the reference's hash and signature algorithms exactly.** The Moamalat
   hash in `reference/` was validated against a real processed payment. A
   "nearly right" HMAC fails silently with real money. Do not re-derive it, do
   not tidy it, do not change the field order.
2. **Verify every webhook signature** before trusting any of the payload.
3. **Webhooks must be idempotent.** The same event delivered twice must not
   credit an order twice. Key on the provider event id.
4. **The order total is computed server-side, always.** Never accept an amount
   from the client.
5. **Never expose `config_data`** to a non-admin client.
6. Log every provider request and response, with **secrets redacted**.
7. A payment moves the order to `processing` **only** on confirmed capture.
   `manual_payment` sits at `waiting_for_verification` until an operator acts.

### Flow
`POST /api/payments/` → provider `initiate()` → either a redirect URL (hosted
gateways) or instructions (manual) → customer pays → provider calls the webhook
→ signature verified → payment `completed` → stock decremented from
`reserved_stock` → order `processing` → customer sees `/checkout/complete`.

`/checkout/redirect` handles the browser's return leg — which may arrive **before
or after** the webhook. Handle both orders; never double-apply.

---

## Delivery

Three couriers: **Vanex**, **Nawres**, **Darb Sabeel**. Same provider pattern
(`apps/delivery/providers/`), configured per courier in the admin, credentials in
`DeliveryMethod.configuration`.

Each provider implements: `list_cities()` · `list_regions(city)` ·
`quote(order)` · `create_shipment(order)` · `track(tracking_number)`.

Cities and regions sync from the courier API into `core.City` / `core.Region`.
The delivery fee comes from the **region**, falling back to the city.

> **The empty-city failure.** In the reference, the city list was populated only
> from a live courier API, and it was empty. Checkout rendered an empty dropdown
> with no explanation and the customer could not proceed. Requirements: seed
> cities so the store works before any courier is configured; if the list is
> empty, **say so in Arabic** and offer a fallback; never render an empty select.

---

## Discounts

Types: `percentage` and `fixed`, per `DiscountType`.

Validation, all server-side, every time:
`is_active` · now within `start_date`/`end_date` · `usage_count < usage_limit` ·
order subtotal ≥ `min_order_amount` · computed discount capped at
`max_discount_amount` · product scope respected when `products` is non-empty.

`usage_count` increments **inside the checkout transaction**, under the same lock,
so a limited-use code cannot be over-redeemed by concurrent checkouts.

Product-level promotional pricing uses `compare_at_price`: the card and the
detail page show the current price with `compare_at_price` struck through. **The
badge, the struck price and the charged price must always agree.**

---

## Inventory

`stock` and `reserved_stock` per product and per variant.
**Available = `stock - reserved_stock`.**

- Checkout **reserves** (increments `reserved_stock`).
- Payment confirmation **commits** (decrements both `stock` and `reserved_stock`).
- Cancellation, expiry or failure **releases** (decrements `reserved_stock`).
- Every change writes an `InventoryLog` row with reason and actor.
- `track_quantity=False` means unlimited — skip all stock checks.
- Low-stock threshold surfaces on the admin dashboard.

Overselling is prevented by `select_for_update()` in checkout, and is covered by
a concurrency test that must genuinely fail without the lock.

---

## Search

`/search` and the header search box. Postgres full-text over product name and
description, with `unaccent` and Arabic-aware normalisation. Debounced
autocomplete via a Combobox. Empty results get a designed state with suggestions.

---

## Accounts

Phone + password only. **No OTP login.** Marsol OTP is retained **solely** for
password reset — without it a forgotten password needs manual admin intervention.

- `/forgot-password` → OTP to the phone → set a new password.
- Rate-limit reset requests per phone.
- Addresses: multiple per user, one default, city → region cascade.
- Roles per `core.Role`; admin UI is gated on
  `{staff, manager, admin, owner}`.

> Never issue a session from a phone number alone. See `01-architecture.md`.
