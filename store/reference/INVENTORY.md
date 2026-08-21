# reference/INVENTORY.md — what the legacy system actually contains

Produced by inventorying `store/reference/system/commerce-main/` (unzipped from
`reference/commerce-main.zip`) on 2026-08-21. **Every number below was counted by
a command, not estimated.** Commands are recorded so any count can be re-run.

Legacy stack: Next.js 15 App Router + Drizzle ORM + better-auth + PostgreSQL,
deployed as a Docker image. 686 files, 6.9 MB.

---

## 1. Headline counts

| Thing | Count | Command |
|---|---|---|
| Pages (`page.tsx`) | **44** | `find src/app -name page.tsx \| wc -l` |
| API route handlers (`route.ts`) | **77** | `find src/app/api -name route.ts \| wc -l` |
| Components (`.tsx` under `src/components`) | **84** | `find src/components -name '*.tsx' \| wc -l` |
| Drizzle tables (`schema.ts`) | **46** | `grep -cE 'pgTable\(' src/lib/db/schema.ts` |
| Auth tables (`auth-schema.ts`) | **4** | `grep -cE 'pgTable\(' src/lib/db/auth-schema.ts` |
| Payment provider factories | **6** | `ls src/modules/payments/factories` |
| Delivery provider factories | **3** | `ls src/modules/delivery/factories` |
| Domain modules | **19** | `ls src/modules` |
| Files containing Arabic text | **193** | `grep -rlP '[\x{0600}-\x{06FF}]' src` |
| Unique Arabic string literals | **1,440** | 1,010 double-quoted + 430 single-quoted, deduped |
| Automated tests | **1** | `find tests -type f` (a Playwright repro script, not a suite) |

**The reference has essentially no test coverage.** `tests/moamalat.spec.ts` is a
single hand-written reproduction of a Lightbox console error, and it asserts that
an error *occurs*. There is nothing to port as a test suite.

---

## 2. Routes — reference vs. this build's 44

The reference has 44 pages. `06-routes-and-pages.md` also specifies 44. **They are
not the same 44.** The delta is deliberate and must be respected.

### In the reference, NOT to be built (out of scope per `00-mission.md`)
| Route | Why |
|---|---|
| `/admin/vouchers` | Voucher engine — explicitly cut |

### Specified for this build, ABSENT from the reference (new work, no design to port)
| Route | Note |
|---|---|
| `/forgot-password` | Reference had no password reset page at all |
| `/me/addresses` | Address management existed only inline in checkout |
| `/categories/:slug` | Reference filtered via `/products?category=` |
| `/collections/:slug` | Reference filtered via `/products?collection=` |
| `/search` | Reference had a search *button* + panel, no results page |

For these five, there is no reference layout to copy. Design them consistently
with the screens that do exist, and say so rather than inventing a "port".

### Present in both (39)
`/` · `/products` · `/products/[productSlug]` · `/cart` · `/checkout/[orderId]` ·
`/checkout/complete` · `/checkout/redirect` · `/login` · `/register` ·
`/developers/api` · `/me` · `/me/orders` · `/me/orders/[orderId]` · `/admin` ·
`/admin/products` · `/admin/products/new` · `/admin/products/new/variants` ·
`/admin/products/[productSlugOrId]` · `/admin/categories` · `/admin/collections` ·
`/admin/inventory` · `/admin/inventory/logs` · `/admin/orders` ·
`/admin/orders/[orderIdOrNumber]` · `/admin/users` · `/admin/users/[userId]` ·
`/admin/discounts` · `/admin/discounts/new` · `/admin/discounts/[id]` ·
`/admin/cities` · `/admin/delivery` (+ `vanex`, `nawres`, `darb_sabeel`) ·
`/admin/payment_methods` (+ `moamalat`, `plutu`, `binance_pay`, `sadad_pay`,
`manual_payment`, `bank_cards_on_delivery`) · `/admin/customization` ·
`/admin/customization/[layoutId]`

---

## 3. API surface — 77 handlers, of which 18 are out of scope

Out-of-scope handlers to **read but not port** (RFM/analytics, wallets, vouchers,
partner API):

`/admin/analytics/overview` · `/admin/analytics/rfm/{config,run,schedule,scores}` ·
`/admin/segments` · `/admin/users/[userId]/wallet` ·
`/admin/users/[userId]/wallet/transactions` · `/admin/vouchers` ·
`/admin/vouchers/[id]` · `/admin/vouchers/partners` ·
`/admin/vouchers/partners/[id]` · `/partner/v1/*` (5 handlers) ·
`/vouchers/redeem` · `/wallets/me` · `/wallets/me/topups` ·
`/wallets/me/transactions` · `/analytics/events`

That leaves **~59 in-scope handlers**, which map cleanly onto the endpoint table
in `03-api-contract.md`. Notable shape differences to be aware of when porting:

- Reference uses `PUT` where the contract specifies `PATCH` (products,
  categories, collections, variants, options, discounts, payment methods).
- Reference cart is keyed by **`variantId`** (`/api/cart/[variantId]`); the
  contract keys by **cart item id** (`/api/cart/<item_id>/`). The contract wins —
  a cart can hold the same variant twice under different line semantics.
- Reference has `/api/auth/[...all]` (better-auth catch-all). Django replaces this
  entirely with explicit `register`/`login`/`logout`/`me`/`csrf` endpoints.
- Reference has `/api/uploads/[...file]` serving media through Node. **nginx
  serves `/media/` directly here** — this handler has no Django equivalent.
- Reference has `/api/customization/revalidate` (Next.js ISR). Replaced by Redis
  cache invalidation on widget/layout write.

---

## 4. Data model — 50 tables, of which 15 are out of scope

**In scope (35)**, mapping to `02-data-model.md`:
`user` · `session` · `account` · `verification` (→ Django auth/sessions) ·
`userAddresses` · `authLogs` · `cities` · `regions` · `categories` · `products` ·
`productImages` · `variantOptions` · `variantValues` · `productVariants` ·
`productVariantOptions` · `productToCategory` · `collections` ·
`productToCollection` · `inventoryTransactions` · `discounts` ·
`productDiscounts` · `regionalDiscounts` · `collectionDiscounts` ·
`deliveryMethods` · `carts` · `cartItems` · `orders` · `orderItems` · `payments` ·
`paymentMethodConfigurations` · `storefrontLayouts` · `widgets` ·
`adminActivityLogs` · `notifications` · `emailTemplates`

**Out of scope (15)** — present in the reference, do not build:
`analyticsIdentities` · `analyticsEvents` · `analyticsRfmConfigs` ·
`analyticsRfmScores` · `walletAccounts` · `walletTransactions` ·
`voucherCampaigns` · `vouchers` · `partnerApps` · `partnerRequestLog` ·
`securityAuditEvents` · `productReviews` · `wishlists` · `wishlistItems` ·
`productVariantOptions` (folded into a Django M2M)

**Tables the reference has that `02-data-model.md` omits** — flag, do not
silently add: `productReviews`, `wishlists`/`wishlistItems`, `regionalDiscounts`,
`collectionDiscounts`, `notifications`, `emailTemplates`, `authLogs`,
`adminActivityLogs`. The spec's model list is normative; these are noted here so
their absence is a recorded decision rather than an oversight.

---

## 5. Byte-exact artefacts extracted

### 5.1 Moamalat secure hash — VERIFIED

Source: `src/modules/payments/factories/moamalatFactory.ts:16-45`.

```
1. filter out null / undefined / '' values   (when filter=true)
2. sort remaining keys lexicographically      (when sort=true)
3. join as  key=value&key=value
4. hex-decode the secret key into bytes
5. HMAC-SHA256 over the joined string with that key
6. uppercase hex digest
```

Ported to Python and checked against
`reference/fixtures/moamalat/synthetic-hash-vector.json`:

```
param string : Amount=50000&DateTimeLocalTrxn=202608151200&MerchantId=M12345&MerchantReference=REF-998877&TerminalId=T67890
computed     : A31CFBE420C3326CFBDC75DC94645910ADFAA5CC8BCC5304CB53A4DBADF5B962
expected     : A31CFBE420C3326CFBDC75DC94645910ADFAA5CC8BCC5304CB53A4DBADF5B962
MATCH
```

> **Provenance caveat, recorded deliberately.** `08-features.md` and
> `store/reference/README.md` both state the Moamalat hash "was validated against
> a real processed payment." The only fixture in the repo says the opposite of
> itself: *"SYNTHETIC. Generated by this repo's own implementation, not captured
> from Moamalat. Proves determinism only."* So what is proven is that the Python
> port reproduces the TypeScript implementation exactly — **not** that either one
> satisfies Moamalat. There is no live capture, and per the same fixture the
> production database holding gateway credentials is unrecoverable. Phase 6's
> gate "each gateway initiates and reaches its provider (sandbox)" therefore has
> no credentials to run against and will have to be struck with a reason.

Backend query hash uses only three fields — `DateTimeLocalTrxn`, `MerchantId`,
`TerminalId` — with `sort=true, filter=true`. Timestamp format for the backend
query is `YYMMDDHHMMSS`; the fixture's `DateTimeLocalTrxn` is `YYYYMMDDHHMM`.
Both formats appear in the reference; preserve each at its own call site.

### 5.2 Order number format

Source: `src/modules/cart/services/cartService.ts:346-353`.

```
`${YYYY}${MM}${PAYMENT_CODE_3}${RANDOM_4}`     e.g. 202608MOA1234
```

`PAYMENT_CODE_3` is the first three characters of the payment method code,
uppercased; `'UNK'` when no method is set.

> **Deliberate deviation.** `04-backend-spec.md` requires collision-safe
> generation and forbids `random`. Keep the *format* (`YYYYMM` + 3 chars + 4
> digits) so existing order numbers stay recognisable, but source the 4 digits
> from a locked per-month sequence rather than `Math.floor(1000 + Math.random()*9000)`.
> Recorded here so the divergence is visible.

### 5.3 Digit and money convention — DECIDED, with evidence

`07-design-system.md` requires the digit system be chosen once and recorded.

The reference formats through `Intl.NumberFormat('ar-LY')`
(`src/lib/utils.ts:23`). Measured:

```
$ node -e "console.log(new Intl.NumberFormat('ar-LY').resolvedOptions().numberingSystem)"
latn
$ node -e "console.log((12345.5).toLocaleString('ar-LY'))"
12.345,5
```

**Decision: Western digits (`0123456789`).** Libya's CLDR locale resolves to
`latn`, the reference rendered Western digits everywhere, and Libyan commerce
uses them. Arabic-Indic (`٠١٢٣`) is an Egypt/Gulf convention, not a Maghreb one.

Two things the reference got wrong that are **not** being ported:
- `ar-LY` renders `12.345,5` — dot as thousands separator, comma as decimal.
  That is confusing next to a `د.ل` price. Use an explicit formatter:
  `1,234.50 د.ل`.
- `formatPrice` set `minimumFractionDigits: 0`, so `10.50 د.ل` displayed as
  `11 د.ل` in some paths. Prices are `Decimal(10,2)`; always show 2 decimals.

One formatter, `lib/format.ts`, used by every price in the app.

### 5.4 Widget types — 14, exactly matching the spec

`src/modules/customization/types/customizationTypes.ts:3-20` defines all 14 values
in `02-data-model.md`, plus three commented out (`product_carousel`,
`category_carousel`, `collection_carousel`). Do not resurrect the commented ones.

---

## 6. Known defects — measured, confirming `store/reference/README.md`

Every claim in the spec was re-counted against the unzipped source. The spec is
accurate; small differences are regex phrasing, not disagreement.

| Defect | Spec claims | Measured | Command |
|---|---|---|---|
| Physical-direction classes | 562 | **552** | `grep -rEo '\b(ml\|mr\|pl\|pr)-[0-9]+\|\b(left\|right)-[0-9]+\|text-(left\|right)' src --include='*.tsx' \| wc -l` |
| Logical-direction classes | 5 | **4** | same, `(ms\|me\|ps\|pe)` / `(start\|end)` |
| `dark:` classes with no provider | 246 | **246** | `grep -rEo 'dark:[a-z-]+' src --include='*.tsx' \| wc -l` |
| Files repeating `dir="rtl"` | 87 | **87** | `grep -rc 'dir="rtl"' src --include='*.tsx' \| grep -v ':0' \| wc -l` |
| Raw palette classes | 1158 | **1135** | `grep -rEo '(bg\|text\|border)-(white\|black\|slate\|gray\|…)-?[0-9]*' src --include='*.tsx' \| wc -l` |
| Hardcoded hex colours | 78 | **78** | `grep -rEo '#[0-9a-fA-F]{6}' src --include='*.tsx' \| wc -l` |

Confirmed structurally as well:
- `tailwind.config.ts` **exists at the repo root** alongside Tailwind v4 — the
  palette it defines never compiled.
- `src/components/ui/` holds 41 files, of which **7 are composites, not
  primitives**: `ProductCard`, `HeroCarousel`, `NormalCarousel`, `CarouselEditor`,
  `ImageEditor`, `PhotoLinkGridEditor`, `GsapCarouselPlugin`.
- Both form libraries are present: `src/components/forms/FormikField.tsx`
  (formik) alongside `react-hook-form` in `ui/form.tsx`.
- `src/components/storefront/` contains exactly **one** component. The storefront
  layer was never factored out.
- A live security bypass is present in the auth path — see `10-agent-protocol.md`
  rule 6. Do not port any of it.

---

## 7. Where the value is — what to actually mine, file by file

| Need | Read |
|---|---|
| Moamalat hash + Lightbox flow | `src/modules/payments/factories/moamalatFactory.ts` (14 KB) |
| Plutu (largest gateway) | `src/modules/payments/factories/plutuFactory.ts` (16 KB) |
| Binance Pay | `src/modules/payments/factories/binancePayFactory.ts` (11 KB) |
| Sadad / manual / cards-on-delivery | `sadadPayFactory.ts`, `manualPaymentFactory.ts`, `bankCardsOnDeliveryFactory.ts` (4–5 KB each) |
| Couriers | `nawresFactory.ts` (16 KB), `darbSabeelFactory.ts` (15 KB), `vanexDeliveryFactory.ts` (12 KB) |
| Checkout + order creation | `src/modules/cart/services/cartService.ts` (425 lines) |
| Order queries and status | `src/modules/orders/services/orderService.ts` (409 lines) |
| Discount maths | `src/modules/discounts/services/discountFactory.ts` (226 lines) |
| Widget contract and normalisation | `src/modules/customization/` |
| Arabic copy | 193 files; the densest are `src/app/admin/**` and `src/components/ui/**` |
| Seed data shape | `src/lib/seeders/` (5 seeders) |
| OTP for password reset | `src/lib/marsol.ts`, `src/lib/marsol-client.ts` |

---

## 8. What this inventory changes about the plan

1. **Five storefront screens have no reference design.** `/forgot-password`,
   `/me/addresses`, `/categories/:slug`, `/collections/:slug`, `/search` are new
   design work, not ports. Budget for that.
2. **There is no test suite to port.** Every test in `11-gates-and-testing.md` is
   written from scratch.
3. **Phase 6's sandbox gate is unrunnable as written** — no credentials exist.
   Plan to strike it with a recorded reason and substitute the strongest
   achievable check: hash/signature vectors, webhook signature rejection, and
   idempotency, all of which *can* fail.
4. **The cart API is re-keyed** from `variantId` to cart-item id. Anything ported
   from `cartService.ts` needs that translation applied deliberately.
5. **`PUT` → `PATCH`** across the admin surface. Mechanical, but pervasive.
