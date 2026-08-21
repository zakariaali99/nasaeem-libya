# 11 — Gates and testing

## The principle

**A gate that cannot fail is not a gate.** Before accepting any criterion, ask:
*what would make this fail?* If nothing would, rewrite it.

| Not a gate | A gate |
|---|---|
| "Auth is implemented" | "A request with a phone and no password returns no session" |
| "The page is responsive" | "No horizontal overflow at 320 / 390 / 768 / 1440 px" |
| "Dark mode is supported" | "Toggling changes `getComputedStyle(body).backgroundColor`" |
| "Fast" | "LCP ≤ 2.5 s, mobile throttled, median of 3" |
| "The font is Arabic" | "`document.fonts.check('16px Cairo')` is `true`" |
| "Documented in X.md" | *(never a gate — documentation is not action)* |

## Backend — pytest

```
backend/
  conftest.py          fixtures: users per role, products, cart, order
  apps/*/tests.py
```

Required, non-negotiable:

- **Auth**: every bullet in Phase 2's gate.
- **Checkout concurrency**: two real threads, one unit of stock, one 409.
  ```python
  # Remove select_for_update and this test MUST fail.
  # If it passes without the lock, the test is wrong.
  ```
- **Permissions**: a customer gets 403 on every admin endpoint. Parametrise over
  the full endpoint list so a new endpoint cannot silently skip it.
- **Money**: totals recomputed server-side; a tampered client total is ignored.
- **Discounts**: expired · over limit · below minimum · capped · product-scoped.
- **Webhooks**: bad signature rejected; duplicate delivery is idempotent.
- **N+1**: `assertNumQueries` on the product list.

Coverage ≥ 80% on `services.py` files. Coverage elsewhere is a weak signal;
**behaviour on the money path is the strong one.**

## Frontend — Vitest

Components with logic: Price formatting, QuantityStepper bounds, VariantSelector
availability, discount display agreement, form validation. Not snapshot tests of
static markup — they cost more than they catch.

## End to end — Playwright

Arabic locale, RTL, mobile viewport (390×844) **and** desktop.

**The critical journey**, which must pass on every run:
```
register → home → search → product → variant → add to cart
→ checkout → city/region → pay (sandbox) → order visible in /me/orders
```

Plus: guest cart survives reload and merges on login · operator creates a
product with variants · operator fulfils an order · operator builds a homepage
from widgets.

### Automated sweeps

**Touch targets**
```js
for (const el of await page.$$('button, a, [role=button], input')) {
  const b = await el.boundingBox()
  expect(b.width >= 44 && b.height >= 44).toBe(true)
}
```

**No horizontal overflow**, at 320 / 390 / 768 / 1440:
```js
expect(await page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
```

**Direction is structural** — force `dir="ltr"`, reload, assert no overflow and
no broken layout. If it breaks, direction was hardcoded.

**All 44 routes render** — enumerate them, visit each, assert a real `<h1>` and
**no placeholder text**. This is the check that would have caught the reference's
31 silently-placeholdered admin pages.

## Static checks — wire these into CI

```bash
# Rules 1 and 2
! grep -rn "from ['\"]next/" frontend/src
! grep -q '"next"' frontend/package.json
! find . -name 'Dockerfile' -o -name 'docker-compose.y*ml' | grep .

# Design system
! grep -rEn "bg-(white|black)|(bg|text|border)-(slate|gray|green|red|blue)-[0-9]" frontend/src/components
! grep -rEn "#[0-9a-fA-F]{6}" frontend/src/components
! grep -rEn "\b(ml|mr|pl|pr)-[0-9]|\b(left|right)-[0-9]|text-(left|right)" frontend/src
test "$(grep -rc 'dir="rtl"' frontend/src | grep -v ':0' | wc -l)" -le 1
! test -f frontend/tailwind.config.ts

# Types
npx tsc --noEmit
cd backend && python manage.py check --deploy
```

## Contrast — computed, never asserted

Ship `scripts/check-contrast.mjs`: parse the `@theme` tokens, convert OKLCH →
sRGB → relative luminance, compute every foreground/background pair in both
themes, print a table, exit non-zero on any failure.

**Do not state a contrast ratio you have not computed.**

## Performance — measured, with conditions

`scripts/perf.mjs` runs Lighthouse mobile, 3 runs, median, against a production
build, and records the host and command. Fails if any budget in
`05-frontend-spec.md` is exceeded.

**A number without its conditions is not a measurement.**

## Recording results

`store/PROGRESS.md`, one entry per gate:

```markdown
## Phase 4 gate — 2026-08-21
- [x] All 14 widget types render
      `npx playwright test widgets.spec.ts` → 14 passed
- [x] LCP ≤ 2.5s on /products/<slug>
      `node scripts/perf.mjs` → LCP 2.11s (median of 3, M1, throttled)
- [ ] Initial JS ≤ 180 kB
      **FAILED — 214 kB.** Recharts is in the storefront chunk.
      Fix: lazy-load the admin dashboard. Re-run before Phase 5.
```

That last entry is what a real record looks like. **A progress file with no
failures in it is not a record of success — it is a record of not looking.**
