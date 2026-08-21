# 09 — Phases and gates

Ten phases. **Do not start phase N+1 until phase N's gate passes.**

Every gate below is a command or an observation that **could fail**. A gate is
met only when it has actually been run and its output seen. "The code looks
right" is not a gate. "The file exists" is not a gate.

> **Gates are fixed at authoring time.** If a criterion turns out to be wrong or
> unachievable, **strike it visibly, record the measurement, and say why.** Never
> silently substitute a weaker criterion and tick it. That single behaviour is
> how the reference project accumulated five separate false-green records.

---

## Phase 0 — Foundation

Repo skeleton per `01-architecture.md`. Django project + apps, PostgreSQL and
Redis connected, settings and boot guard, `requirements.txt`, Vite + React +
TypeScript + Tailwind v4 with the full `@theme` token layer, `lib/api.ts`,
`@fontsource-variable/cairo` self-hosted, `index.html` with `lang="ar" dir="rtl"`.

**Gate**
- [ ] `python manage.py check --deploy` passes with `DEBUG=False`
- [ ] `python manage.py migrate` succeeds on a clean database
- [ ] `GET /api/health/` returns 200 with `database: ok` and `cache: ok`
- [ ] `npm run build` succeeds; `npm run dev` serves with no console errors
- [ ] **`document.fonts.check('16px Cairo')` is `true` in the browser**, and the
      served woff2 has `unicode-range` covering `U+0600–06FF`
- [ ] `grep -r "next\|docker" --include='*.json' --include='*.ts' .` finds no
      dependency or config (matches in prose are fine)
- [ ] **No `tailwind.config.ts` exists**

## Phase 1 — Data model

Every model from `02-data-model.md`. Migrations. Django admin registration. A
seed command creating a realistic Arabic catalogue, cities, regions, and an
owner account.

**Gate**
- [ ] `makemigrations --check --dry-run` reports no missing migrations
- [ ] Every model in `02-data-model.md` exists with every field
- [ ] `seed_demo` produces a browsable catalogue with Arabic names and images
- [ ] Arabic slugs work end to end (`allow_unicode=True` verified with a real
      Arabic slug round-tripped through the ORM)
- [ ] `pytest` green

## Phase 2 — Auth

Register, login, logout, me, csrf, throttling, password reset via Marsol OTP.

**Gate — verify by running, not by reading**
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

## Phase 3 — Catalog API + admin catalog screens

Products, categories, collections, variants, options, images, inventory. Admin
screens 20–27. The shared `<DataTable>` is built here.

**Gate**
- [ ] Every catalog endpoint in `03-api-contract.md` responds correctly to a
      **real request**
- [ ] An operator creates a product **with variants and images through the UI**
      and it appears in the storefront API
- [ ] Inventory adjustment writes an `InventoryLog` row
- [ ] A customer role gets **403** on every admin endpoint
- [ ] `GET /api/products/` issues **no N+1** — assert the query count with
      `assertNumQueries`
- [ ] `pytest` green

## Phase 4 — Storefront browse

Routes 1–3, 15–17. Home widget rendering, catalogue with filters, product detail
with gallery and variants, search.

**Gate**
- [ ] All 14 widget types render
- [ ] **Empty layout shows a designed empty state**, not a bare sentence
- [ ] Filters and sort survive a page refresh (URL state)
- [ ] Variant selection updates price, stock and images
- [ ] **Badge, struck-through price and charged price agree on every discounted
      product** — verified on a real discounted product
- [ ] Lighthouse mobile on `/products/<slug>`: Performance **≥ 90**,
      **LCP ≤ 2.5 s**, CLS ≤ 0.05
- [ ] Initial storefront JS **≤ 180 kB gzipped**

## Phase 5 — Cart & checkout

Routes 4–7. Guest cart, merge on login, discounts, addresses, delivery, the
checkout transaction.

**Gate**
- [ ] **A guest adds to cart without an account** and the cart survives a reload
- [ ] The guest cart merges into the user cart on login
- [ ] **Concurrency: two simultaneous checkouts for the last unit — one
      succeeds, one gets 409.** Written with real threads, not mocks.
- [ ] Every price and total is recomputed server-side; a tampered client total is
      ignored
- [ ] Discount validation covers expired / over-limit / below-minimum / capped
- [ ] **With zero cities configured, checkout explains the problem in Arabic**
- [ ] `pytest` green

## Phase 6 — Payments & delivery

All six gateways, three couriers, admin screens 36–44.

**Gate**
- [ ] Each gateway initiates and reaches its provider (sandbox)
- [ ] **A webhook with an invalid signature is rejected**
- [ ] **The same webhook delivered twice credits the order once**
- [ ] Manual payment: upload proof → `waiting_for_verification` → operator
      verifies → order advances
- [ ] Stock decrements **only** on confirmed payment
- [ ] `/checkout/redirect` handles arriving before *and* after the webhook
- [ ] Courier shipment creation returns a tracking number

## Phase 7 — Orders, accounts, admin operations

Routes 11–14, 19, 28–35. Dashboard, order fulfilment, customers, discounts.

**Gate**
- [ ] An operator fulfils an order end to end through the UI
- [ ] Order status transitions are enforced server-side
- [ ] A customer sees **only** their own orders — verified by trying another id
- [ ] Every admin list has working sort, filter, pagination and an empty state
- [ ] Dashboard tiles link to the filtered lists that resolve them
- [ ] **Charts render RTL-correctly**

## Phase 8 — Widget builder

`/admin/customization` and `/admin/customization/:layoutId`.

**Gate**
- [ ] An operator builds a homepage from scratch through the UI and it renders
- [ ] Drag-and-drop reorder works **with a mouse and with a keyboard**
- [ ] Live preview matches the rendered storefront
- [ ] Scheduling and targeting rules take effect
- [ ] Layout cache invalidates on save — the change is visible immediately

## Phase 9 — Quality, accessibility, SEO, deployment

**Gate**
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
- [ ] Lighthouse mobile ≥ 90 Performance / ≥ 95 Accessibility / 100 SEO on
      `/`, `/products`, `/products/<slug>`, `/cart`
- [ ] Deployed with nginx + gunicorn + systemd. **No Node process running** —
      prove it with `ps aux | grep -c node` on the server
- [ ] **No container anywhere** — no Dockerfile in the repo
- [ ] Full `pytest` and full Playwright suite green

---

## The final acceptance

One person, one uninterrupted run, on a real phone:

register → browse the homepage → search → open a product → pick a variant →
add to cart → check out → choose city and region → pay → see the order in
`/me/orders`.

Then, as the operator: receive it, fulfil it, ship it.

**If any step needs a workaround, the build is not done.**
