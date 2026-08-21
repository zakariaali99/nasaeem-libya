# Phase 4 — Storefront browse ⚠️ (one criterion struck, one failed)

## Done

**Backend** — `apps/storefront/`
- `services.py` — layout resolution (global flag · date range · weekday · hour
  window, incl. one that wraps midnight; most recently updated wins; falls back
  to the global default rather than losing the homepage), **widget normalisation
  on write** (one shape per type, so the client never guesses between
  `imageUrl` / `image_url` / `url`), targeting, and server-side population.
- `GET /api/storefront/layout/` — one request renders the homepage: widgets come
  back ordered, active-only, with their products, categories and collection
  already attached.
- Redis caching of the resolved layout with `post_save`/`post_delete`
  invalidation — what makes Phase 8's "visible immediately after a save" gate
  reachable. Personalised widgets are populated **outside** the cache.
- `catalog/services.search_products` — Postgres full-text (`simple`) + trigram,
  over Arabic-normalised text (harakat stripped, alef and yaa forms unified).
  `unaccent` is **not** used: measured, it does nothing for Arabic.

**Frontend**
- Storefront shell — Header (logo, search, category rail, account, cart), Footer,
  mobile BottomNav, ThemeToggle, skip link.
- 14 widget renderers + `WidgetShell`.
- `components/storefront/` — Price · DiscountBadge · StockBadge · ProductImage ·
  ProductCard · ProductGrid · ProductGallery · VariantSelector ·
  QuantityStepper · EmptyState · ErrorState · ProductListing.
- Routes 1–3 and 15–17. `/search`, `/categories/:slug`, `/collections/:slug` are
  **new design work, not ports** (`reference/INVENTORY.md` §2).
- `scripts/perf.mjs` — Lighthouse mobile, 3 runs, median, every number printed
  with its conditions.

## Gate — 5 met · 1 struck · 1 failed

| Criterion | Evidence |
|---|---|
| All 14 widget types render | 14/14 distinct `data-widget-type` sections in a browser, each with real content |
| **Empty layout → designed empty state** | layouts deactivated → API returns `{layout: null}` 200, page shows a designed card with a way forward |
| Filters and sort survive a refresh | `?category=armaf&in_stock=true&sort=price_desc` identical before and after reload |
| Variant selection updates price, stock, ~~images~~ | 221.00/متوفر → 340.00/بقي 5 فقط. **"images" struck:** no variant→image relation exists in `02-data-model.md` |
| Badge / struck / charged price agree | 20 cards, 5 discounted, **0 mismatches** vs the API's own numbers |
| Lighthouse ≥ 90 · LCP ≤ 2.5 s · CLS ≤ 0.05 | **FAILED** — 86 / 3539 ms / 0. Recorded as failed, not re-budgeted |
| Initial storefront JS ≤ 180 kB gzip | **148.8 kB** on `/`, **149.3 kB** on the PDP, measured from real resource timings |

**168 backend tests** (129 → 168) · **17 frontend unit tests** · 12 static gates.

## The Lighthouse failure, and what was actually done about it

First measurement: performance 68, LCP 5,639 ms, of which **4,776 ms was "load
delay"** — the hero image cannot be discovered until the bundle has downloaded
*and* the API has answered.

Three measured fixes: prime the product API request from `index.html` and inject
the image preload when it lands (68 → 83); import the six storefront routes
statically so a lazy chunk does not cost a round trip on first paint (83 → 86);
give the preload link the same `imagesrcset`/`imagesizes` as the `<img>`, which
had been downloading two copies of the hero image, and defer related products to
`requestIdleCallback` (LCP 3,819 → 3,539 ms).

The remaining ~1 s is architectural — HTML → JS → API before the image URL
exists. The fix is Phase 9's already-open decision: a Django template endpoint
for `/products/<slug>` that emits meta, JSON-LD **and** the hero preload at HTML
time. Carried as a named fix.

## Six defects found by driving it

1. **`seed_demo` was not idempotent** — variants grew 12 → 26 → 36. Cause:
   `hash(slug)` in the SKU, and Python randomises `str` hashing per process, so
   every run minted new SKUs and new variants. Now a SHA-1 digest.
2. **`?in_stock=true` hid every variant product** — the filter read `stock > 0`
   while the stock lives on the variants. The filter and the card disagreed
   about the same fact.
3. **A card read "بقي 0 فقط" beside `in_stock: true`** — `available_stock` and
   `in_stock` were computed from different places. A follow-up test caught a
   third member of the family: deactivated variants' stock was being counted.
4. **`/categories/:slug` listed the whole catalogue** under the category's own
   heading — `fixedParams` was spread first and overwritten with `undefined`.
5. **Doubled page titles** — the seeded `meta_title` already ends in the store
   name.
6. **Three touch targets below 44 px**; the sweep now reports 0 on every
   storefront route. The product card was also given **one** anchor instead of
   two links to the same product.

## A test that proved nothing, and was replaced

The first Arabic-search tests **passed with the normalisation deleted** — short
names match by trigram accident (`similarity('عود ملكي','عُودْ') = 0.167`, just
over the 0.15 threshold). On a long name the trigrams dilute to 0.129 and only
normalisation finds it. The replacement fails when `ARABIC_NORMALISERS` is
emptied.

## Mutation checks

    Arabic normalisation emptied      → 1 FAILED
    layout fallback removed           → 1 FAILED
    post_save cache invalidation cut  → 1 FAILED
    in_stock filter → stock__gt=0     → 5 FAILED

## Two measurements this tooling could not take

- **320 px** — the browser pane clamps at ~392 px. Verified at 392/768/1440
  (no overflow anywhere); 320 px is carried to Phase 9's Playwright sweep. The
  `documentElement.style.width` trick that Phase 2 exposed as meaningless was
  not repeated.
- **Contrast from the live DOM** — `getComputedStyle` returns `oklch()` strings;
  a first attempt parsed them as RGB and printed a nonsense 1.32:1.
  `scripts/check-contrast.mjs` remains the authority, and passes.

## For the user

**Variant images.** The reference gave each variant its own images; the spec's
`ProductImage` has no variant FK, which is why the gate's "and images" clause
was struck. Leave it, or add `ProductImage.variant` (~half a day with the admin
UI). Not decided here.

## Next
Phase 5 — cart and checkout. The add-to-cart control was deliberately **not**
shipped in Phase 4: the cart API is Phase 5, and a button that looks real and
does nothing is the exact failure `00-mission.md` names.
