# 06 — Routes and pages

**44 routes.** Every one must exist and work. Screens must match `reference/` —
same layout, same Arabic copy, same behaviour.

> The reference project's migration silently reduced 44 routes to 9, replacing
> 31 admin pages with a single placeholder that said "this page is now connected
> to the new app". **A placeholder is not a page.** A route counts as built only
> when it renders real data from the API and its actions work.

---

## Storefront — 18 routes

| # | Path | Page |
|---|---|---|
| 1 | `/` | Home — CMS widget layout |
| 2 | `/products` | Catalogue — filter, sort, paginate |
| 3 | `/products/:productSlug` | Product detail |
| 4 | `/cart` | Basket |
| 5 | `/checkout/:orderId` | Checkout |
| 6 | `/checkout/complete` | Order confirmed |
| 7 | `/checkout/redirect` | Gateway return handler |
| 8 | `/login` | Phone + password |
| 9 | `/register` | Phone + name + password |
| 10 | `/forgot-password` | Reset request |
| 11 | `/me` | Account overview |
| 12 | `/me/orders` | Order history |
| 13 | `/me/orders/:orderId` | Order detail + tracking |
| 14 | `/me/addresses` | Saved addresses |
| 15 | `/categories/:slug` | Category listing |
| 16 | `/collections/:slug` | Collection listing |
| 17 | `/search` | Search results |
| 18 | `/developers/api` | API documentation page |

### `/` — Home
Fetch `GET /api/storefront/layout/`, render widgets in `order`. Each of the 14
widget types has a renderer (`08-features.md`). **Empty layout → a designed empty
state**, never a bare sentence. The first widget's image is the LCP element:
`fetchpriority="high"`, never lazy.

### `/products` — Catalogue
Grid, 2 columns on mobile / 4 on desktop. Filters: category, collection, price
range, in-stock. Sort: newest, price asc/desc, name. Server pagination. Filter
state lives **in the URL** so results are shareable and the back button works.
Skeleton cards while loading, matching final dimensions.

### `/products/:productSlug` — Product detail
The highest-intent screen, and the reference's slowest. Required:
- **Gallery**: swipeable on mobile, thumbnails on desktop, zoom, fixed aspect
  ratio to prevent CLS.
- **Variant selection**: option groups (size, colour…); unavailable combinations
  visibly disabled, never merely absent.
- **Price block**: current price, struck-through `compare_at_price`, discount
  badge. **These three must agree.** The reference showed a "20% off" badge next
  to the *undiscounted* price with no sale price anywhere — the customer was
  shown a discount that the number did not reflect. Never ship that.
- **Quantity stepper**, stock state, `<QuantityStepper>` not a raw input.
- **Sticky add-to-cart bar on mobile.**
- Delivery estimate, description, specs, related products.
- JSON-LD `Product` structured data.

### `/cart`
Line items with image, name, variant, unit price, stepper, remove, and line
total. Discount code entry with live validation. Totals: subtotal, discount,
delivery, grand total. **Optimistic quantity updates.** Designed empty state
with a link to the catalogue. **A guest may hold a cart** — auth is required only
at checkout.

### `/checkout/:orderId`
Steps: address (city → region cascade, saved addresses) → delivery method →
payment method → review → confirm. Arabic field order and labels. Inline
validation. **If the city list is empty, say so explicitly** — never render an
empty select with no explanation.

### `/login`, `/register`
Phone + password. `autoComplete="tel"` and `"current-password"` / `"new-password"`.
`inputMode="numeric"` on phone. Identical error text for unknown phone and wrong
password. Register enforces the password rules client-side **and** server-side.

### `/me`, `/me/orders`, `/me/orders/:orderId`
Profile, order history with status chips using the Arabic labels from
`02-data-model.md`, and per-order detail with items, totals, addresses, payment
status and courier tracking.

---

## Admin — 26 routes

| # | Path | Screen |
|---|---|---|
| 19 | `/admin` | Dashboard |
| 20 | `/admin/products` | Product list |
| 21 | `/admin/products/new` | Create product |
| 22 | `/admin/products/new/variants` | Variant matrix builder |
| 23 | `/admin/products/:productSlugOrId` | Edit product |
| 24 | `/admin/categories` | Categories (tree) |
| 25 | `/admin/collections` | Collections |
| 26 | `/admin/inventory` | Stock levels + adjust |
| 27 | `/admin/inventory/logs` | Inventory history |
| 28 | `/admin/orders` | Order list |
| 29 | `/admin/orders/:orderIdOrNumber` | Order detail + fulfilment |
| 30 | `/admin/users` | Customers |
| 31 | `/admin/users/:userId` | Customer detail |
| 32 | `/admin/discounts` | Discounts |
| 33 | `/admin/discounts/new` | Create discount |
| 34 | `/admin/discounts/:id` | Edit discount |
| 35 | `/admin/cities` | Cities & regions |
| 36 | `/admin/delivery` | Courier overview |
| 37 | `/admin/delivery/vanex` | Vanex config |
| 38 | `/admin/delivery/nawres` | Nawres config |
| 39 | `/admin/delivery/darb_sabeel` | Darb Sabeel config |
| 40 | `/admin/payment_methods` | Gateway overview |
| 41 | `/admin/payment_methods/moamalat` | Moamalat config |
| 42 | `/admin/payment_methods/plutu` | Plutu config |
| 43 | `/admin/payment_methods/binance_pay` | Binance Pay config |
| 44 | `/admin/payment_methods/sadad_pay` | Sadad Pay config |
| + | `/admin/payment_methods/manual_payment` | Manual transfer config |
| + | `/admin/payment_methods/bank_cards_on_delivery` | Card on delivery config |
| + | `/admin/customization` | Layout list |
| + | `/admin/customization/:layoutId` | **Widget builder** |

### `/admin` — Dashboard
Actionable, not vanity: today's orders, orders awaiting fulfilment, payments
awaiting verification, low-stock products, revenue trend. Every tile links to the
filtered list that resolves it. **Charts must be RTL-correct** — the axis
direction has to be mirrored, and every chart needs a text alternative.

### `/admin/products` and every other list
**One shared `<DataTable>`** with sorting, filtering, server pagination, column
visibility, bulk actions, row actions, a designed empty state, a loading
skeleton, and a card layout on mobile. Build it once; use it on all of them.

### `/admin/products/new` and `/admin/products/new/variants`
The most complex form in the app. Grouped sections (basics, pricing, media,
inventory, organisation, SEO, variants), image upload with drag-reorder,
**unsaved-changes protection**, inline validation, and clear save/dirty state.
The variant builder takes options and values and generates the matrix, letting
the operator set price/SKU/stock per combination and disable rows.

> The reference's operator reported being unable to find how to add a product.
> Navigation to this screen must be obvious from `/admin` and from
> `/admin/products`.

### `/admin/orders/:orderIdOrNumber`
Resolvable by UUID **or** human order number. Items, totals, customer, addresses,
payment history with a verify action, status transitions, courier dispatch and
tracking. Every destructive action confirms.

### `/admin/customization/:layoutId` — Widget builder
The highest-leverage admin screen: the entire homepage is authored here. Add,
remove, reorder (drag-and-drop, **with keyboard support**), configure per type,
toggle active, set targeting and scheduling, and **a live preview**. An operator
must be able to see what a widget looks like before saving.

---

## Cross-cutting

**Header**: logo, search, categories, account, cart with a live count badge —
badge position must mirror correctly in RTL. **Bottom navigation on mobile.**

**Every interactive element ≥ 44×44 CSS px.** The reference shipped shadcn
defaults (`h-9` = 36 px) everywhere and patched individual call sites.

**Every route** sets its own `<title>` and meta description.
