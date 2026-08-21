# IMPLEMENTATION.md — the executable plan

Derived from `00`–`11` plus `reference/INVENTORY.md`. This file does **not**
restate the specification; it turns it into work. Read the spec for *what*, read
this for *which file, in what order, verified by which command*.

Root: `/Users/zakaria/projects/Claude/nasaeemlibya`
Build target: `store-app/` (per `01-architecture.md`)

---

## 0. Decisions taken before any code

Recorded here so they are not re-litigated mid-build.

| Decision | Value | Basis |
|---|---|---|
| Digits | **Western `0123456789`** | `reference/INVENTORY.md` §5.3 — `ar-LY` resolves to `latn`, measured |
| Brand palette | **primary `oklch(0.545 0.155 129)`, secondary `oklch(0.40 0.012 140)`** | The live site's own CTA green `#6D9B1F` and logo sage `#444943`. Lightness lowered 0.63→0.545 because the live green fails AA at 3.30:1 |
| Brand assets | Real `logo.svg` + 13 brand marks, downloaded 2026-08-21 | `frontend/public/brand/`, `frontend/public/brands/`, `frontend/public/providers/` |
| Seed catalogue | The 13 real brands as categories; 23 products, **named only where the live site names them** | No invented SKUs |
| Money display | `1,234.50 د.ل`, always 2 dp, one formatter in `lib/format.ts` | Reference's `minimumFractionDigits: 0` rounded 10.50 → 11 |
| Python | **3.12.12** via `/opt/homebrew/bin/python3.12` | System `python3` is 3.9.11; spec needs 3.12+ |
| PostgreSQL | 14.23, already running natively, role `zakaria` | No Docker (Rule 2); `unaccent` extension needed for search |
| Redis | 6.2.6, already running natively | |
| Order number | Keep format `YYYYMM` + `CODE3` + `NNNN`, **sequence not random** | `INVENTORY.md` §5.2 |
| Cart key | Cart **item id**, not variant id | `03-api-contract.md` overrides the reference |
| Admin writes | `PATCH`, not the reference's `PUT` | `03-api-contract.md` |
| Execution | **Serial, by this session**, unless the user asks for subagents | See §"On delegation" |

### On delegation

`10-agent-protocol.md` specifies subagent fan-out. This session's operating rules
forbid spawning agents unless the user explicitly asks. Both are satisfiable: the
per-phase agent assignments below are written as the protocol requires, and are
executed **serially by this session** by default. If the user says "delegate" /
"use subagents", the assignments below are already the briefs — each one names its
own spec files, owned files, forbidden files, interface contract, and gate.

Unchanged either way: **the orchestrator runs every gate itself.** No claim of a
passing gate is accepted without its command output.

### Standing verification harness — built in Phase 0, run at every phase

`store-app/scripts/gates.sh` — the static half of `11-gates-and-testing.md`,
exit-non-zero on any violation. Run it before declaring any phase complete:

```bash
bash store-app/scripts/gates.sh
```

It asserts: no `next` dependency or `next/*` import · no Dockerfile or compose
file · no `tailwind.config.ts` · no raw palette classes in `src/components` · no
hex colours in `src/components` · no physical-direction classes in `src` ·
`dir="rtl"` in at most one file · `tsc --noEmit` clean · `manage.py check --deploy`
clean under `DEBUG=False`.

---

## 1. Phase 0 — Foundation

**Serial. One agent. Everything depends on it.**

### Files created
```
store-app/
  backend/
    manage.py
    requirements.txt
    .env.example
    config/{__init__,settings,urls,wsgi,asgi}.py
    apps/__init__.py
    apps/core/{__init__,apps,models,admin}.py
    apps/{accounts,catalog,orders,payments,delivery,storefront}/{__init__,apps}.py
    apps/health/{__init__,apps,views,urls}.py
    conftest.py
    pytest.ini
  frontend/
    package.json  vite.config.ts  tsconfig.json  index.html
    src/main.tsx  src/App.tsx
    src/styles/globals.css          <- the ENTIRE @theme token layer, Phase 0
    src/lib/{api.ts,format.ts,utils.ts}
    src/types/api.ts
  scripts/gates.sh
  scripts/check-contrast.mjs
  deploy/{nginx.conf,gunicorn.service,README.md}
  .gitignore
```

### Dependency order inside the phase
1. venv + `requirements.txt` + `config/settings.py` incl. the boot guard
2. app skeletons + `apps/health` (needs settings)
3. DB + Redis reachable → `migrate` on a clean database
4. frontend scaffold + `globals.css` tokens (blocks everything visual downstream)
5. `lib/api.ts`, `lib/format.ts` (blocks every data call downstream)
6. `scripts/gates.sh`, `scripts/check-contrast.mjs`

Steps 1–3 and 4–6 are independent of each other; 4 must precede 5.

### Gate — verbatim from `09-phases.md`
- [ ] `python manage.py check --deploy` passes with `DEBUG=False`
- [ ] `python manage.py migrate` succeeds on a clean database
- [ ] `GET /api/health/` returns 200 with `database: ok` and `cache: ok`
- [ ] `npm run build` succeeds; `npm run dev` serves with no console errors
- [ ] **`document.fonts.check('16px Cairo')` is `true` in the browser**, and the served woff2 has `unicode-range` covering `U+0600–06FF`
- [ ] `grep -r "next\|docker" --include='*.json' --include='*.ts' .` finds no dependency or config (matches in prose are fine)
- [ ] **No `tailwind.config.ts` exists**

### Verification — the actual commands
```bash
cd store-app/backend && DEBUG=False python manage.py check --deploy
createdb nasaim_dev && python manage.py migrate
python manage.py runserver 8000 &  curl -s localhost:8000/api/health/ | tee /dev/stderr | grep -q '"database": *"ok"'
cd store-app/frontend && npm run build && npm run dev
# font: driven in the browser, not asserted from source —
#   mcp__Claude_Browser__javascript_tool -> document.fonts.check('16px Cairo')
#   and: curl -sI <woff2 url>; grep unicode-range dist/assets/*.css
grep -rn '"next"\|"docker"' store-app --include='*.json' ; test ! -f store-app/frontend/tailwind.config.ts
bash store-app/scripts/gates.sh
```

**The font check is a browser check.** Reading `main.tsx` for the import is not
evidence — that is precisely the failure `00-mission.md` describes.

---

## 2. Phase 1 — Data model

**Serial. One agent.** Depends on Phase 0.

### Files
`apps/core/models.py` (User, UserManager, City, Region, UserAddress) ·
`apps/catalog/models.py` (Category, Collection, Product, ProductCategory,
ProductCollection, VariantOption, VariantValue, ProductVariant, ProductImage,
InventoryLog) · `apps/orders/models.py` (DeliveryMethod,
PaymentMethodConfiguration, Discount, Cart, CartItem, Order, OrderItem, enums) ·
`apps/payments/models.py` (Payment) · `apps/storefront/models.py`
(StorefrontLayout, Widget, WidgetType) · each app's `admin.py` · migrations ·
`apps/core/management/commands/seed_demo.py`

### Order inside the phase
`core` → `catalog` → `orders` → `payments` → `storefront` (FK direction).
Admin registration and `seed_demo` last.

### Gate
- [ ] `makemigrations --check --dry-run` reports no missing migrations
- [ ] Every model in `02-data-model.md` exists with every field
- [ ] `seed_demo` produces a browsable catalogue with Arabic names and images
- [ ] Arabic slugs work end to end (`allow_unicode=True` verified with a real Arabic slug round-tripped through the ORM)
- [ ] `pytest` green

### Verification
```bash
python manage.py makemigrations --check --dry-run
python manage.py shell -c "
from apps.catalog.models import Product
p = Product.objects.create(name='عود ملكي', slug='عود-ملكي', price=250)
print(Product.objects.get(slug='عود-ملكي').name)"     # must print عود ملكي
python manage.py seed_demo && python manage.py shell -c "
from apps.catalog.models import Product; print(Product.objects.count())"
pytest
```
Field completeness is checked by a script, not by eye:
`scripts/check_models.py` parses the tables in `02-data-model.md` and asserts each
field exists on the Django model with the right type — it must be able to fail.

---

## 3. Phase 2 — Auth

**Serial. One agent.** The security-critical phase.

### Files
`apps/accounts/{serializers,views,urls,throttling,tests}.py` ·
`apps/accounts/otp.py` (Marsol, **password reset only**) ·
`config/urls.py` · frontend `pages/auth/{Login,Register,ForgotPassword}.tsx` ·
`src/lib/queries/auth.ts`

### Gate — verify by running, not by reading
- [ ] Correct phone + password returns a session
- [ ] **A request with a phone and no password returns no session**
- [ ] Wrong password and unknown phone return **byte-identical** responses
- [ ] A 4-character password is rejected
- [ ] Passwords are hashed — inspect the row and confirm no plaintext
- [ ] Login throttling: a test exhausts it and asserts **429**
- [ ] A banned user receives no session
- [ ] `GET /api/auth/me/` → 401 anonymous, user JSON authenticated
- [ ] Logout invalidates server-side; a replayed cookie gets 401
- [ ] Password reset works end to end

### Verification
```bash
pytest apps/accounts -v
# byte-identical proof, not an eyeball comparison:
diff <(curl -s -X POST localhost:8000/api/auth/login/ -d 'phone_number=0910000000&password=wrong') \
     <(curl -s -X POST localhost:8000/api/auth/login/ -d 'phone_number=0919999999&password=wrong') \
  && echo IDENTICAL
psql nasaim_dev -c "select password from core_user limit 1"   # must start pbkdf2_sha256$
```
Mutation check, required before the gate is ticked: comment out the
`authenticate()` call and confirm `test_no_session_without_password` **fails**.
A test that has never failed proves nothing.

---

## 4. Phase 3 — Catalog API + admin catalog screens

### Order
1. **Serial:** `apps/catalog/{serializers,views,services,urls}.py` + the shared
   `frontend/src/components/admin/DataTable.tsx`. 26 admin screens depend on
   `DataTable`; it is written once, by one agent, before anything fans out.
2. **Then parallel (4):** products screens (20/21/23) · categories + collections
   (24/25) · inventory (26/27) · variants (22).

Boundaries: each owns `pages/admin/<area>/**` and touches no other page folder.
Shared files (`DataTable.tsx`, `lib/api.ts`, `globals.css`) are **read-only** to
all four.

### Gate
- [ ] Every catalog endpoint in `03-api-contract.md` responds correctly to a **real request**
- [ ] An operator creates a product **with variants and images through the UI** and it appears in the storefront API
- [ ] Inventory adjustment writes an `InventoryLog` row
- [ ] A customer role gets **403** on every admin endpoint
- [ ] `GET /api/products/` issues **no N+1** — assert the query count with `assertNumQueries`
- [ ] `pytest` green

### Verification
```bash
pytest apps/catalog -v
pytest apps/catalog/tests.py::test_product_list_query_count -v   # assertNumQueries
# the UI leg is driven in a browser, not asserted from source:
npx playwright test e2e/admin-create-product.spec.ts
```
The 403 sweep is **parametrised over the endpoint list** so a new admin endpoint
cannot silently skip it.

---

## 5. Phase 4 — Storefront browse

### Order
1. **Serial:** layout shell (Header, Footer, BottomNav) with tokens applied,
   `components/storefront/{Price,ProductCard,StockBadge,DiscountBadge,EmptyState,ErrorState}.tsx`.
2. **Then parallel (5):** 14 widget renderers · catalogue `/products` · PDP
   `/products/:slug` · `/search` · `/categories/:slug` + `/collections/:slug`.

Note from `INVENTORY.md` §2: `/search`, `/categories/:slug`, `/collections/:slug`
have **no reference design**. They are new work — say so, do not present them as
ports.

### Gate
- [ ] All 14 widget types render
- [ ] **Empty layout shows a designed empty state**, not a bare sentence
- [ ] Filters and sort survive a page refresh (URL state)
- [ ] Variant selection updates price, stock and images
- [ ] **Badge, struck-through price and charged price agree on every discounted product** — verified on a real discounted product
- [ ] Lighthouse mobile on `/products/<slug>`: Performance **≥ 90**, **LCP ≤ 2.5 s**, CLS ≤ 0.05
- [ ] Initial storefront JS **≤ 180 kB gzipped**

### Verification
```bash
npx playwright test e2e/widgets.spec.ts          # 14 renderers
npx playwright test e2e/discount-agreement.spec.ts
node scripts/perf.mjs                            # Lighthouse mobile, 3 runs, median
npm run build && ls -l dist/assets/*.js | awk '{s+=$5} END {print s}' && \
  gzip -c dist/assets/index-*.js | wc -c        # must be ≤ 184320
```
Per `11-gates-and-testing.md`, `scripts/perf.mjs` records host and command with
every number. A number without its conditions is not a measurement.

---

## 6. Phase 5 — Cart & checkout

### Order
1. **One agent, alone, no concurrent edits:** `apps/orders/services.py` —
   `checkout()`, discount validation, delivery fee, order number sequence.
   This is the most correctness-critical code in the system.
2. **Then parallel (2):** cart UI (`/cart`) · checkout UI (`/checkout/:orderId`,
   `/checkout/complete`).

### Gate
- [ ] **A guest adds to cart without an account** and the cart survives a reload
- [ ] The guest cart merges into the user cart on login
- [ ] **Concurrency: two simultaneous checkouts for the last unit — one succeeds, one gets 409.** Written with real threads, not mocks.
- [ ] Every price and total is recomputed server-side; a tampered client total is ignored
- [ ] Discount validation covers expired / over-limit / below-minimum / capped
- [ ] **With zero cities configured, checkout explains the problem in Arabic**
- [ ] `pytest` green

### Verification
```bash
pytest apps/orders/tests.py::test_concurrent_checkout_last_unit -v
# then the mutation check that makes it a real gate:
#   remove select_for_update() from services.checkout() and re-run.
#   The test MUST fail. If it still passes, the test is wrong — fix the test, not the gate.
pytest apps/orders -v
psql nasaim_dev -c "delete from core_city" && npx playwright test e2e/checkout-no-cities.spec.ts
```

---

## 7. Phase 6 — Payments & delivery

### Order
1. **Serial:** `apps/payments/providers/base.py` + `registry.py`,
   `apps/delivery/providers/base.py` + `registry.py`.
2. **Then parallel (6):** moamalat · plutu · sadad_pay · binance_pay ·
   manual_payment · bank_cards_on_delivery.
3. **Then parallel (3):** vanex · nawres · darb_sabeel.
4. Admin screens 36–44 (parallel, one per gateway/courier page).

Each provider owns exactly one file under `providers/` plus its admin page.
`base.py` and `registry.py` are read-only once written.

### Gate — with one criterion struck, visibly
- [ ] ~~Each gateway initiates and reaches its provider (sandbox)~~
      **STRUCK. Reason: no credentials exist.** Per
      `reference/fixtures/moamalat/synthetic-hash-vector.json`, the production
      database holding every gateway's `config_data` is unrecoverable, and no
      sandbox account is available. This criterion cannot be run, so it is not
      ticked and not silently weakened.
      **Substituted with the strongest checks that can actually fail:**
      each provider's `initiate()` produces the exact request the reference
      produced for the same input (hash/signature vectors compared byte for
      byte), and every provider is exercised against a local HTTP stub asserting
      method, path, headers and body shape.
- [ ] **A webhook with an invalid signature is rejected**
- [ ] **The same webhook delivered twice credits the order once**
- [ ] Manual payment: upload proof → `waiting_for_verification` → operator verifies → order advances
- [ ] Stock decrements **only** on confirmed payment
- [ ] `/checkout/redirect` handles arriving before *and* after the webhook
- [ ] Courier shipment creation returns a tracking number

### Verification
```bash
pytest apps/payments/tests.py::test_moamalat_hash_vector -v     # fixture, byte-exact
pytest apps/payments/tests.py::test_webhook_bad_signature_rejected -v
pytest apps/payments/tests.py::test_webhook_idempotent_double_delivery -v
pytest apps/payments apps/delivery -v
```
The Moamalat vector already passes in Python — `INVENTORY.md` §5.1. That test is
the anchor: change one byte of the param-string construction and it fails.

---

## 8. Phase 7 — Orders, accounts, admin operations

**Parallel (5), all depending on `DataTable`:** dashboard (19) · orders (28/29) ·
users (30/31) · discounts (32/33/34) · account (11–14, incl. the new
`/me/addresses`).

### Gate
- [ ] An operator fulfils an order end to end through the UI
- [ ] Order status transitions are enforced server-side
- [ ] A customer sees **only** their own orders — verified by trying another id
- [ ] Every admin list has working sort, filter, pagination and an empty state
- [ ] Dashboard tiles link to the filtered lists that resolve them
- [ ] **Charts render RTL-correctly**

### Verification
```bash
npx playwright test e2e/operator-fulfil-order.spec.ts
pytest apps/orders/tests.py::test_order_visibility_other_user_404 -v
npx playwright test e2e/admin-lists.spec.ts     # sort/filter/paginate/empty, every list
```

---

## 9. Phase 8 — Widget builder

**Serial. One agent** — tightly coupled. `/admin/customization`,
`/admin/customization/:layoutId`, `components/admin/WidgetBuilder.tsx`, @dnd-kit
with keyboard sensors, live preview reusing the Phase 4 renderers (not a second
implementation of them).

### Gate
- [ ] An operator builds a homepage from scratch through the UI and it renders
- [ ] Drag-and-drop reorder works **with a mouse and with a keyboard**
- [ ] Live preview matches the rendered storefront
- [ ] Scheduling and targeting rules take effect
- [ ] Layout cache invalidates on save — the change is visible immediately

### Verification
```bash
npx playwright test e2e/widget-builder.spec.ts          # includes a keyboard-only reorder
redis-cli --scan --pattern 'storefront:layout:*'        # empty right after a save
```

---

## 10. Phase 9 — Quality, accessibility, SEO, deployment

**Parallel (4):** a11y · performance · SEO/prerender · deployment.

### Gate
- [ ] **All 44 routes render with real data.** No placeholders. Enumerate them.
- [ ] Contrast script: every token pair ≥ 4.5:1 body / 3:1 UI, both themes
- [ ] Every interactive element **≥ 44×44 px** — asserted by a Playwright sweep
- [ ] `grep` for raw colours in `src/components` is **empty**
- [ ] `grep` for physical-direction classes is **empty**
- [ ] `dir="rtl"` appears **once** in the codebase
- [ ] Forcing `dir="ltr"` breaks no layout
- [ ] Keyboard-only pass through register → browse → cart → checkout
- [ ] `curl` of a product URL returns the name and price **in the HTML source**
- [ ] Valid JSON-LD (Google Rich Results)
- [ ] Lighthouse mobile ≥ 90 Performance / ≥ 95 Accessibility / 100 SEO on `/`, `/products`, `/products/<slug>`, `/cart`
- [ ] Deployed with nginx + gunicorn + systemd. **No Node process running** — prove it with `ps aux | grep -c node` on the server
- [ ] **No container anywhere** — no Dockerfile in the repo
- [ ] Full `pytest` and full Playwright suite green

### Verification
```bash
npx playwright test e2e/all-routes.spec.ts    # 44 routes, real <h1>, no placeholder text
node scripts/check-contrast.mjs               # computed OKLCH→sRGB, exits non-zero on fail
npx playwright test e2e/touch-targets.spec.ts e2e/no-overflow.spec.ts e2e/ltr-forced.spec.ts
curl -s https://<host>/products/<slug> | grep -q 'عود'      # SSR meta / prerender
node scripts/perf.mjs --routes / /products /products/<slug> /cart
ssh <host> 'ps aux | grep -c [n]ode'          # must print 0
pytest && npx playwright test
```

The SEO leg is the one architectural decision still open: `01-architecture.md`
allows **either** a Django template endpoint emitting meta + JSON-LD for
`/products/<slug>`, **or** a build-time prerender. Recommendation: the Django
template endpoint — it needs no second toolchain, stays correct as prices change,
and keeps the "no Node in production" rule trivially true. Decided at Phase 9,
recorded in `PROGRESS.md`.

---

## 11. Recording

`store/PROGRESS.md`, one entry per gate, per `11-gates-and-testing.md`: the date,
the command, and its **actual output** — including failures. A progress file with
no failures in it is a record of not looking.
