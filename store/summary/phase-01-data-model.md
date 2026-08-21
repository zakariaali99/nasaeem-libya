# Phase 1 — Data model ✅

## Done
- **22 spec models, 28 tables** across `core`, `catalog`, `orders`, `payments`,
  `storefront`. Migrations applied on a clean database.
- Full Django admin registration, including an `InventoryLog` admin with add,
  change and delete disabled.
- `seed_demo`: 14 Libyan cities, 21 regions, **13 real brands** as categories
  carrying their real logos, **23 products**, delivery methods, payment method
  rows (all disabled, no secrets), discounts, and an active homepage layout.
- `scripts/check_models.py` — parses `02-data-model.md` and compares to Django.

## What it proves
- Model completeness is a **check, not a claim**: removing `Product.barcode`
  turns it red.
- The catalogue is genuinely browsable — every admin changelist was driven over
  HTTP and returns the seeded Arabic data; anonymous gets a 302 to login.
- 39 tests pass, and **two mutations prove they can fail**: breaking
  `available_stock` → 3 failures; removing the `InventoryLog` write guard → 1.

## Decisions taken with the user
- Clean start, **no legacy import**.
- **Spec-normative models only** — the 8 extra reference tables are not built.
- Serial build, no subagents.
- Brand palette from the **live site**, `#6D9B1F`, corrected to
  `oklch(0.545 0.155 129)` because the live value fails AA at 3.30:1.

## Corrections made
- **Tailwind v4 tree-shakes unused `@theme` tokens.** The built CSS contained
  only the dark `--color-secondary`; the light one was gone. Fixed with
  `@theme static`. Caught only by reading the token in a browser.
- Favicon replaced with the real `logo.svg` — Phase 0 shipped an invented one.

## Flagged, not acted on
The live site describes the business as perfumes **and cleaning materials**;
`00-mission.md` scopes the store to perfumes, oils and gift sets. Scope call for
the user.

## Next
Phase 2 — auth: register, login, logout, me, CSRF, throttling, password reset.
