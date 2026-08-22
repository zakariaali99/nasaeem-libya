# PROGRESS.md — the record

One entry per gate: the date, the command, and its **actual output**, including
failures. A progress file with no failures in it is not a record of success — it
is a record of not looking.

Machine: Apple Silicon macOS 25.5.0 · Python 3.12.12 · Node 20.19.1 ·
PostgreSQL 14.23 · Redis 6.2.6. All native, no containers.

---

## Phase 0 gate — 2026-08-21

- [x] **`python manage.py check --deploy` passes with `DEBUG=False`**

      env DEBUG=False SECRET_KEY=$(openssl rand -hex 32) ALLOWED_HOSTS=nasaeem.ly \
        CSRF_TRUSTED_ORIGINS=https://nasaeem.ly DATABASE_URL=... REDIS_URL=... \
        .venv/bin/python manage.py check --deploy
      → System check identified no issues (0 silenced).

      Failed first with a 49-character key: `security.W009 Your SECRET_KEY has less
      than 50 characters`. Re-run with `openssl rand -hex 32` (64 chars) — clean.

      **The boot guard was proven to fire**, which is what makes this a gate:

      env DEBUG=False ... REDIS_URL= .venv/bin/python manage.py check
      → django.core.exceptions.ImproperlyConfigured: DEBUG=False requires these
        environment variables: REDIS_URL

- [x] **`python manage.py migrate` succeeds on a clean database**

      createdb nasaim_dev
      psql -d nasaim_dev -c 'CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS pg_trgm;'
      .venv/bin/python manage.py migrate
      → Applying core.0001_initial... OK  (plus contenttypes, auth, admin, sessions)

      `core.User` had to land in Phase 0 rather than Phase 1: `AUTH_USER_MODEL`
      points at it, so migrate cannot run on a clean database without it. Noted
      rather than quietly re-scoped.

- [x] **`GET /api/health/` returns 200 with `database: ok` and `cache: ok`**

      curl -s http://127.0.0.1:8010/api/health/
      → {"status":"ok","database":"ok","cache":"ok"}   HTTP 200

      **First attempt produced a false green and was caught.** `runserver 8000`
      failed to bind — port 8000 is held by an unrelated Django project on this
      machine — and the curl hit *that* app instead:

      → {"status":"healthy",...,"engine":"sqlite3","system":"الجهاز الوطني للقوى المساندة"}  HTTP 200

      A 200 from the wrong process. This project now uses **Django :8010** and
      **Vite :5183**, and `vite.config.ts` sets `strictPort: true` so a silent
      port fallback cannot repeat.

      **The 503 path was proven reachable** — the check can fail:

      env REDIS_URL=redis://127.0.0.1:6399/0 .venv/bin/python manage.py runserver 8011
      curl -s http://127.0.0.1:8011/api/health/
      → {"status":"degraded","database":"ok","cache":"error: ConnectionError"}  HTTP 503

- [x] **`npm run build` succeeds; `npm run dev` serves with no console errors**

      npm run build   (tsc --noEmit && vite build)
      → ✓ 91 modules transformed
        dist/assets/index-*.css   48.65 kB │ gzip:  9.84 kB
        dist/assets/query-*.js    37.59 kB │ gzip: 11.91 kB
        dist/assets/react-*.js    94.14 kB │ gzip: 31.75 kB
        dist/assets/index-*.js   184.05 kB │ gzip: 58.33 kB

      Console after loading http://localhost:5183/ in a real browser:
      → [debug] [vite] connecting… / connected.
        [info] Download the React DevTools…
      No errors, no warnings.

      **Note carried to Phase 4:** the 184 kB entry chunk holds `react-dom/client`,
      which `manualChunks: {react: ['react-dom']}` does not match. Totalial gzip is
      ~102 kB today, inside the 180 kB budget, but the chunking needs fixing
      before the budget is measured for real.

- [~] **`document.fonts.check('16px Cairo')` is `true` in the browser, and the
      served woff2 has `unicode-range` covering `U+0600–06FF`**

      ~~First half struck.~~ **`document.fonts.check()` cannot fail**, so by
      `11-gates-and-testing.md`'s own rule it is not a gate. Measured in the
      browser:

      document.fonts.check('16px Cairo')          → true
      document.fonts.check('16px NoSuchFontXYZ')  → true      ← same answer for a font that does not exist

      It returns true whenever the text *could* be rendered, fallback included —
      which is precisely the reference's Latin-Inter-on-Arabic failure it was
      meant to catch. Not silently weakened; **replaced with two checks that can
      fail**, both run in the browser:

      1. A loaded FontFace named Cairo covering the Arabic range exists:
         [...document.fonts].find(f => f.family === 'Cairo' && /U\+600-6FF/i.test(f.unicodeRange))
         → { family: "Cairo", range: "U+600-6FF, U+750-77F…", status: "loaded" }

      2. Arabic text is actually measured in Cairo, not a fallback — canvas
         measureText('نسائم ليبيا') at 32px:
         → with Cairo            128.64 px
           with a missing family 118.21 px
           differ → Cairo is the face doing the rendering

      Second half passes as written:
      curl -s http://localhost:5183/src/styles/globals.css | grep -c 'U+0600-06FF' → 1
      curl -sI …/fonts/cairo-arabic.woff2 → HTTP 200, 30 896 bytes, font/woff2

      Self-hosted from `@fontsource-variable/cairo` into `public/fonts/`,
      `font-display: swap`, preloaded in `index.html`. No Google Fonts request.

- [x] **`grep -r "next\|docker" --include='*.json' --include='*.ts' .` finds no
      dependency or config**

      → no matches outside node_modules.

- [x] **No `tailwind.config.ts` exists**

      test ! -f frontend/tailwind.config.ts → absent

### Beyond the gate, built and verified in Phase 0

- **`scripts/gates.sh`** — 12 static checks (Rules 1 and 2, design system, types,
  Django deploy check, missing migrations). **Proven able to fail:** planting a
  `tailwind.config.ts` plus a component using `bg-white`/`text-slate-700`/`#ff0000`
  produced `9 passed, 3 failed`; removing them returned `12 passed, 0 failed`.

- **`scripts/check-contrast.mjs`** — computes OKLCH → Oklab → linear sRGB →
  relative luminance for 25 token pairs in both themes.

      **First run FAILED — 6 pairs below threshold**, in the palette as specified
      in `07-design-system.md`:

        primary-foreground on primary   3.95  (need 4.5)  ← white text on every primary button
        low-stock on background         2.75  (need 3.0)
        warning  on background          2.26  (need 3.0)
        rating   on background          1.89  (need 3.0)
        border   on background          1.27  (need 3.0)  light
        border   on background          1.44  (need 3.0)  dark

      Corrected by solving numerically for the lightness that just clears each
      threshold, keeping chroma and hue:
        --color-primary   0.58 → 0.54   (ring follows)
        --color-low-stock 0.70 → 0.67
        --color-warning   0.75 → 0.66
        --color-rating    0.80 → 0.66
        --color-input     0.92 → 0.66 (light), 0.30 → 0.48 (dark)

      `border` is **excluded from the check with a reason recorded in the CSS**:
      WCAG 1.4.11 governs boundaries that are the only means of identifying a
      control. Card edges and dividers are decorative; a form field's edge is
      not — so `--color-input` was split out and is held to 3:1 instead. Do not
      put `border` on an input.

      Re-run → All token pairs meet WCAG 2.1 AA. Exit 0.

- **Dark mode is wired, not decorative** — `11-gates-and-testing.md`'s own test,
  run in the browser:

      toggle `.dark` on <html> → getComputedStyle(body).backgroundColor
      → light oklch(1 0 0) · dark oklch(0.15 0.01 240) · differ: true
      --color-primary resolves to oklch(0.72 0.11 182) under .dark

- **`deploy/`** — nginx (SPA fallback, `/api` and `/django-admin` proxied,
  `/media` off disk, immutable asset caching), gunicorn systemd unit, and a
  deployment README whose verification section includes `ps aux | grep -c '[n]ode'`.

### Not yet done, carried into Phase 1

- `apps/core` still holds only `User`; `City`, `Region`, `UserAddress` and every
  catalog/orders/payments/storefront model are Phase 1.
- No tests exist yet — `pytest` has nothing to run. First real suite is Phase 1.
- `src/pages/Placeholder.tsx` is scaffolding, deleted in Phase 4.

**Phase 0 gate: passed, with one criterion struck and replaced (fonts.check) and
one false green caught and corrected (health on the wrong port).**

---

## Phase 1 gate — 2026-08-21

Scope decisions taken with the user before starting, recorded so they are not
re-litigated: **clean start, no legacy import** · **spec-normative models only**
(the 8 extra reference tables — reviews, wishlists, notifications, email
templates, auth/admin activity logs, regional and collection discounts — are not
built) · **serial build, no subagents**.

`User.legacy_id` is kept because `02-data-model.md` names it and the spec's model
list is normative; no importer is written and nothing populates it.

- [x] **`makemigrations --check --dry-run` reports no missing migrations**

      .venv/bin/python manage.py makemigrations --check --dry-run
      → No changes detected

- [x] **Every model in `02-data-model.md` exists with every field**

      Not verified by eye. `scripts/check_models.py` parses the spec markdown,
      introspects Django, and compares:

      .venv/bin/python ../scripts/check_models.py
      → All 22 spec models present with every named field.

      **Proven able to fail:** commenting out `Product.barcode` produced
      `✗ Product  18 spec fields  missing: barcode` and exit 1; restoring it
      returned to green.

      One parser correction along the way: it first reported
      `ProductImage missing: full, medium, thumb`, reading the prose "generate
      `thumb` / `medium` / `full` renditions" as field names. They are file
      renditions, not columns — excluded with a comment. **Carried to Phase 3:**
      the API still has to expose those three URLs so the client can build a
      `srcset`; they are derived from `url` by naming convention, not stored.

      28 tables created: 17 spec models plus through-tables, M2M join tables and
      Django's own auth/session tables.

- [x] **`seed_demo` produces a browsable catalogue with Arabic names and images**

      .venv/bin/python manage.py seed_demo
      → 14 مدينة · 21 منطقة · 6 تصنيف · 12 منتج · 15 خيار · 12 صورة

      Idempotent — a second run reports the same counts and creates nothing.

      Browsable was **verified by driving the admin over HTTP**, not by counting
      rows. Django test client, `force_login` (no password typed into any field),
      `HTTP_HOST=localhost`:

      /django-admin/catalog/product/            200 · 12 rows · عود ملكي, دهن عود كمبودي, طقم هدايا فاخر all present
      /django-admin/core/city/                  200 · طرابلس present
      /django-admin/storefront/storefrontlayout/ 200 · التخطيط الافتراضي present
      /django-admin/orders/discount/            200 · خصم الترحيب present
      /django-admin/catalog/inventorylog/       200 · append-only, add/change/delete disabled
      product edit page                         200
      anonymous request                         302 → /django-admin/login/

      Media is served for real:
      curl …/media/products/عود-ملكي-full.webp → HTTP 200, 10 646 bytes, image/webp

      **The images are generated placeholder tiles, not product photography.**
      There are no product images anywhere in `reference/` — the only real assets
      are the brand logo and the payment-provider marks. 36 files (12 products ×
      thumb/medium/full) exist so the catalogue is browsable and CLS work can
      proceed. They must be replaced before launch.

      **No password is seeded.** The owner account reads `SEED_OWNER_PASSWORD`
      or generates one with `secrets.token_urlsafe` and prints it once. A known
      credential in a seed script is a security bypass, and this project ships
      none in any environment.

- [x] **Arabic slugs work end to end (`allow_unicode=True` verified with a real
      Arabic slug round-tripped through the ORM)**

      Product.objects.get(slug='عود-ملكي').name        → عود ملكي
      slugify('عطر الياسمين الليبي', allow_unicode=True) → عطر-الياسمين-الليبي

      Also asserted structurally in `apps/catalog/tests.py`: every slug field on
      Category, Collection and Product has `allow_unicode is True`.

- [x] **`pytest` green**

      .venv/bin/python -m pytest
      → 39 passed in 2.93s

      Coverage is behavioural, not incidental: password hashing, ban expiry
      semantics, region→city delivery-fee fallback, `PROTECT` on order and cart
      lines, guest carts without a user, order-line snapshots surviving a rename
      and a reprice, append-only inventory logs, and every enum's stored value
      **and** Arabic label pinned exactly.

      **Two mutations run to prove the suite can fail:**

      1. `available_stock` changed to `return self.stock` (ignoring reservations)
         → 3 failures, including `test_a_fully_reserved_product_is_out_of_stock`.
      2. The `InventoryLog.save()` guard removed
         → `test_a_log_row_cannot_be_updated` failed.

      Both restored; back to 39 passed.

- [x] **Static gates still green after the phase**

      bash scripts/gates.sh → 12 passed, 0 failed

### Raised during Phase 1 — a decision for the user, not taken unilaterally

**The real brand colours and the specified palette disagree.** `reference/`
contains a genuine `public/logo.svg` — concentric arcs over a dome, in two
colours:

    #444943  → oklch(0.40 0.012 140)   dark sage/olive
    #d7e7bb  → oklch(0.90 0.061 124)   pale sage green

`07-design-system.md` specifies teal `oklch(0.54 0.10 182)` and amber
`oklch(0.78 0.14 68)` — a different hue family entirely. The spec was written to
fix the reference's *absence* of compiled brand colour, so its palette looks
chosen rather than derived from the logo.

Nothing was changed unilaterally: the token layer still holds the specified
teal/amber, which passes contrast in both themes. What **was** corrected is the
favicon — Phase 0 shipped one I invented while a real logo existed in the
repository. The real `logo.svg` is now `frontend/public/favicon.svg` and
`public/brand/logo.svg`, and the 13 payment/courier provider marks
(moamalat, plutu, binance, sadad, vanex, nawres, sabil, …) are staged in
`frontend/public/providers/` for Phase 6.

### Not yet done, carried into Phase 2

- No API endpoints exist beyond `/api/health/`. All of `apps/*/serializers.py`,
  `views.py` and `urls.py` are Phase 2 onward.
- `ProductImage` stores one `url`; rendition URLs are a Phase 3 serializer
  concern.
- `seed_demo` creates no orders or carts — Phase 5 fixtures will.

**Phase 1 gate: passed, all five criteria, none struck.**

### Phase 1 addendum — the live site, 2026-08-21

The user supplied **https://nasaeemlibya.ly** mid-phase. It is the company's
corporate site, not the store, but it is the first real visual reference in the
project and it settles decisions that were previously guesses.

**Brand colour — measured, not chosen.** Every call to action on that site, in
both languages, is `rgb(109, 155, 31)` = `#6D9B1F` = `oklch(0.63 0.155 129)`.

      white text on #6D9B1F → 3.30:1

**That fails WCAG AA on their live site** — every primary button on
nasaeemlibya.ly today. Hue and chroma are preserved exactly; lightness drops to
`0.545`, which clears AA at 4.51:1 against `--color-primary-foreground` and is
visually the same green. Secondary became the logo's sage `#444943`
`oklch(0.40 0.012 140)`.

      node scripts/check-contrast.mjs → All token pairs meet WCAG 2.1 AA.

The user had already chosen "sage primary, amber accent" from swatches. The live
green is the same hue family (129 vs the logo's 124–140) with real chroma, so
this is that decision resolved against evidence rather than reversed.

**A defect on the live site that this build must not copy:** it sets
`font-family: Montserrat` on `<html lang="ar" dir="rtl">`. Montserrat carries no
Arabic glyphs, so every Arabic character on their site renders in whatever the
device falls back to — the identical failure `07-design-system.md` documents
about Latin-subset Inter. This project self-hosts Cairo with a verified
`U+0600–06FF` range.

**Assets downloaded, with permission, logos only:** the 13 brand marks
(Armaf, Afnan, Rasasi, Assaf, Rue Broca, Zimaya, Tad Angel, Estiara, Laverne,
Hamidi, Smart Collection, Ebhar, Risala) → `frontend/public/brands/`,
763 KB → **328 KB** after downscaling three oversized PNGs (assaf.png was
4500×4500). No product photography was fetched; product images remain generated
tiles.

**Seed rewritten around the real catalogue.** 13 brands as top-level categories
carrying their real logos, 23 products, 4 with Arabic slugs:

      13 تصنيف · 23 منتج · 12 خيار · 23 صورة

Product names are seeded **only where the live site names them.** Its own `alt`
attributes are copy-pasted from the third brand onward — a dozen unrelated
bottles all read "Rasasi Alwisam" — so filenames won where the two disagreed.
Five brands (Ebhar, Risala, Laverne, Hamidi, Smart Collection) are seeded with
**zero products** rather than inventing SKUs, which also gives Phase 4 a real
empty-category case to design against.

Re-verified after the rewrite: `pytest` 39 passed · `check_models.py` 22/22 ·
`makemigrations --check` clean · `gates.sh` 12 passed.

**Flagged, not acted on:** the live site describes the business as
"نسائم ليبيا لاستيراد العطور **ومواد التنظيف**" — perfumes *and cleaning
materials* — founded 2015, based in Misurata, selling both wholesale and retail.
`00-mission.md` scopes the store to "perfumes, oils and gift sets" only. If
cleaning products belong in the catalogue, that is a scope decision for the user,
not something to add silently.

**One real bug found while verifying the palette in the browser.** `bg-primary`
resolved to transparent and `--color-secondary` read as empty in light mode, while
dark mode had every token. Cause: Tailwind v4 **tree-shakes unused `@theme`
tokens**, but the `.dark` block is plain CSS and is always emitted. The built
stylesheet contained exactly one `--color-secondary` — the dark one:

      grep -o '--color-secondary:[^;]*' dist/assets/index-*.css
      → --color-secondary:oklch(86% .055 124)        (dark only)

So a component using `bg-secondary` would have inherited the dark value with no
light counterpart, and `check-contrast.mjs` was verifying tokens the browser
never received. Fixed by declaring `@theme static`, which forces emission:

      → --color-secondary:oklch(40% .012 140)        light
        --color-secondary:oklch(86% .055 124)        dark

This is the same class of failure as the reference's uncompiled
`tailwind.config.ts`: a palette that looks authoritative in source and is absent
at runtime. It was caught only because the token was read in a browser rather
than from the CSS file.

---

## Phase 2 gate — 2026-08-21

All ten criteria met, none struck. **80 tests pass** (39 → 80).

Verified over real HTTP against the dev server, not only through the test client:

    csrf      → 200, csrftoken cookie set
    register  → 201 {"data":{...,"phone_number":"0917000001"},"message":"تم إنشاء الحساب بنجاح"}
    me        → 200 with the user JSON
    logout    → 200
    me        → 401

- [x] **Correct phone + password returns a session** — 200, `sessionid` set.
- [x] **A request with a phone and no password returns no session** — 400, no
      cookie, `/auth/me/` still 401.
- [x] **Wrong password and unknown phone are byte-identical** —
      `cmp` of two live responses passes:
      `{"message":"البيانات المُرسلة غير صحيحة","errors":{"non_field_errors":["رقم الهاتف أو كلمة المرور غير صحيحة"]}}`
      A malformed number answers identically too — "that isn't even a phone
      number" would be an oracle of its own.
- [x] **A 4-character password is rejected** — 400, no row created.
- [x] **Passwords are hashed** — `pbkdf2_sha256$…`, plaintext absent.
- [x] **Login throttling returns 429** — seven rapid attempts:
      `400 400 400 400 429 429 429`. Keyed on the phone, so a fresh client is
      still throttled; a different account is unaffected.
- [x] **A banned user receives no session.**
- [x] **`/api/auth/me/` → 401 anonymous, user JSON authenticated.**
- [x] **Logout invalidates server-side** — a captured `sessionid` replayed from a
      fresh client gets 401.
- [x] **Password reset works end to end** — OTP → new password works, old
      password 400s, and the reset issues **no session** of its own.

### Mutation testing

Replacing `authenticate()` with `User.objects.filter(phone_number=phone).first()`
— the reference's exact bypass — fails 5 tests:

    FAILED test_a_wrong_password_never_yields_a_session
    FAILED test_unknown_phone_and_wrong_password_are_byte_identical
    FAILED test_a_malformed_phone_fails_identically_too
    FAILED test_an_inactive_user_receives_no_session
    FAILED test_reset_works_end_to_end

Worth recording why `test_a_wrong_password_never_yields_a_session` had to be
written: the no-password case is caught by *field validation* before the
credential check runs, so the obvious test would have passed under the bypass.
The gate's headline item needed a test that actually reaches `authenticate()`.

### Three defects found by driving the endpoints

**1. 403 where the contract says 401.** DRF downgrades `NotAuthenticated` to 403
when the authentication class exposes no `WWW-Authenticate` header, which
SessionAuthentication does not. `03-api-contract.md` splits 401 (not signed in)
from 403 (signed in, not allowed) and the SPA routes on that difference — a 403
would have shown "you lack permission" to a signed-out visitor instead of sending
them to `/login`. Restored in `apps/core/exceptions.py`. Five tests caught it.

**2. CSRF was not enforced on anonymous POSTs.** Verified live:

    curl -d '{"phone_number":"…","password":"x"}' /api/auth/login/     (no token)
    → HTTP 400   ← reached the credential check; CSRF never ran

`APIView` is csrf_exempt by default and SessionAuthentication only calls
`enforce_csrf` once a session authenticates someone, so every public write
endpoint was open. That permits login CSRF: an attacker signs a victim into the
attacker's account and the victim's addresses and order history land there.
Added `apps/core/views.py::CsrfProtectedAPIView`; register, login and both reset
endpoints inherit from it. Re-verified:

    → HTTP 403 {"message":"انتهت صلاحية الجلسة، يرجى تحديث الصفحة والمحاولة مرة أخرى"}

CSRF rejections also returned Django's **HTML** error page, which the SPA cannot
parse — it would have surfaced as a generic "unexpected error". Added
`CSRF_FAILURE_VIEW` returning the JSON envelope.

**3. An English password error in an Arabic-only store.**

    {"password":["This password is too short. It must contain at least 8 characters.",
                 "كلمة المرور هذه شائعة جداً."]}

Django's `MinimumLengthValidator` uses `ngettext`, and Arabic's plural forms are
not fully covered in the shipped catalogue. `00-mission.md` requires every
customer-facing string to be Arabic. All four validators are now Arabic-messaged
subclasses, and a parametrised test fails if any Latin letter appears in a
password error:

    ['كلمة المرور قصيرة جداً، يجب أن تتكوّن من 8 أحرف على الأقل',
     'كلمة المرور هذه شائعة جداً، اختر كلمة مرور أقوى']

### Screens, driven in a browser

At real 320×720 and 390×844 viewports, on `/login`, `/register` and
`/forgot-password`:

    horizontal overflow      : none
    elements below 44×44     : none
    inputs without a <label> : none
    <h1> per page            : 1
    inline errors            : Arabic only  ("رقم الهاتف غير صحيح، يجب أن يبدأ بـ 09…")
    forced dir="ltr"         : no overflow, layout intact
    /me while signed out     : → /login?next=%2Fme

**A correction to my own measurement.** The first sweep reported overflow at 320,
390 and 768 px. It had set `documentElement.style.width` instead of resizing the
viewport, so the content kept its desktop width and the comparison was
meaningless. Re-run with real viewport resizes: no overflow anywhere. The same
sweep did find two genuinely undersized links — "نسيت كلمة المرور؟" at 20 px tall
and "أنشئ حساباً جديداً" at 26 px — now given 44 px hit areas without changing how
they look.

### Carried into Phase 3

- `/me` is a stub showing name, phone and join date. The real account screens are
  Phase 7.
- `/` is still a placeholder; the CMS homepage is Phase 4.
- The entry chunk is 225 kB (72 kB gzip) because `react-dom/client` is not matched
  by `manualChunks: {react: ['react-dom']}`. Storefront total is ~120 kB gzipped,
  inside the 180 kB budget, but the chunking needs fixing before Phase 4 measures
  it for real.

---

## Phase 3 gate — 2026-08-21

All six criteria met, none struck. **129 tests pass** (80 → 129).

- [x] **Every catalog endpoint responds correctly to a real request**

      GET /api/products/?limit=2
      → meta {'page': 1, 'limit': 2, 'total': 23, 'pages': 12}
        keys: available_stock, categories, collections, compare_at_price,
              discount_percent, discounts, has_variants, id, images, in_stock,
              is_active, name, price, reserved_stock, sku, slug, stock, track_quantity
        images carry renditions: thumb / medium / full

      GET /api/products/زمايا-فاطمة/   → زمايا فاطمة, 2 variants   (Arabic slug)
      GET /api/categories/             → 13 roots
      admin endpoints, anonymous       → 401 each

- [x] **An operator creates a product with variants through the UI and it appears
      in the storefront API**

      Driven in the browser at /admin/products/new: name, price, compare-at price,
      SKU, category chip, save. Redirected to the edit page with the Arabic slug
      and the dirty notice flipped to "كل التغييرات محفوظة".

      Then, through the PUBLIC API:
        name           : عطر تجريبي من لوحة التحكم
        slug           : عطر-تجريبي-من-لوحة-التحكم
        price / was    : 249.50 / 320.00
        discount badge : 22 %
        categories     : ['أرماف']

      The badge is derived from the two prices beside it, so it cannot disagree
      with them — the reference's "20% off next to an undiscounted price" is
      structurally impossible here.

      Variants generated from the same UI: 2 combinations, both listed
      immediately. Image upload is covered by a test that writes a real PIL
      image and asserts three WebP renditions land on disk at the right sizes.

- [x] **Inventory adjustment writes an `InventoryLog` row** — driven through the
      UI dialog, not the API:

      logs before 23 → after 24
      newest: {product: عطر تجريبي من لوحة التحكم, change: +7,
               reason: إعادة تخزين, note: شحنة تجريبية من الواجهة, by: اختبار}

- [x] **A customer role gets 403 on every admin endpoint** — parametrised over
      the endpoint list so a new admin endpoint cannot silently skip the check.
      Anonymous gets 401 on the same list.

- [x] **`GET /api/products/` issues no N+1** — the test asserts the query count
      does not grow with the number of rows.

      **It proved itself during this phase.** An interrupted command left
      `product_queryset()` stripped of its prefetches, and the test failed with:

          AssertionError: query count grew from 12 to 52 when 10 products were
          added — N+1

      Diagnosed by capturing the SQL rather than guessing:

            6 x SELECT "catalog_productimage"…
            6 x SELECT "catalog_category"…
            6 x SELECT "catalog_collection"…
            6 x SELECT "orders_discount"…

      for six products. Prefetches restored; count flat again.

- [x] **`pytest` green** — 129 passed.

### A test-isolation bug worth recording

Sixteen catalog tests failed on first run with `401 == 403` and empty result
sets. The cause was not the code under test: **throttle counters live in Redis,
which is shared across the whole session**, so the sixth test that logged in as
the same phone number was throttled into anonymity and every assertion after it
measured an anonymous client. The autouse cache reset moved from the accounts
tests into `conftest.py`, where every app gets it. Worth naming because the
failure looked like a permissions bug and was not.

### Three defects found by driving the UI

**1. `CSRF_TRUSTED_ORIGINS` pointed at the wrong port.** After the dev server
moved to 5183 (8000 and 5173 were taken by an unrelated project) the setting
still said 5173, so every admin write failed:

    POST /api/products/ → 403
    {"message":"CSRF Failed: Origin checking failed -
      http://localhost:5183 does not match any trusted origins."}

Phase 2's auth tests passed because they used curl with a `Referer` matching
Django's own origin. Only a browser exercises the cross-origin path. Fixed in
`.env`, `.env.example` and the settings default.

**2. `<Button asChild>` crashed every page that used it.**

    Error: Slot failed to slot onto its children.
    Expected a single React element child or `Slottable`.

The button rendered `{spinner}{children}` — two children — and Radix `Slot`
accepts exactly one, so `asChild` threw even when `loading` was false. The error
boundary behaved correctly (an Arabic message, not a white screen), which is the
only reason the failure was legible. `asChild` now renders children straight
through; the spinner is added only for a real `<button>`.

**3. Pagination buttons were 40 px tall.** `07-design-system.md` specifies both
`sm: h-10` (40 px) and "every interactive target ≥ 44×44 px". Those contradict
each other. **The minimum wins** — these are the primary touch targets on a
paginated list. Fixed once in `DataTable`, so all 26 admin screens inherit it.
The contradiction is recorded here rather than silently resolved.

### Bundle chunking fixed ahead of Phase 4's budget

The entry chunk had been 228 kB (73 kB gzip). Object-form `manualChunks` matches
package **entry points**, so `react-dom/client` — the module `main.tsx` actually
imports — fell through into the entry. Switched to matching the resolved path:

    index   13.45 kB │ gzip  5.41 kB      (was 228 kB / 73 kB)
    react  287.74 kB │ gzip 92.18 kB
    query   41.48 kB │ gzip 12.33 kB
    vendor  41.17 kB │ gzip 13.82 kB
    radix   30.73 kB │ gzip 10.19 kB
    icons   13.88 kB │ gzip  3.26 kB
    forms   84.29 kB │ gzip 23.37 kB      (auth screens only)

Admin screens are 2–4 kB gzipped each and load only behind the admin guard.

### Screens verified in a browser at 390×844

`/admin` · `/admin/products` · `/admin/categories` · `/admin/collections` ·
`/admin/inventory` · `/admin/inventory/logs`

    real data, not placeholders : yes on all six
    <h1> per page               : 1
    horizontal overflow         : none
    below 44×44                 : none (after the pagination fix)
    mobile card layout          : 20 cards replace the table

**Note on how the admin session was obtained.** No password was typed into any
field. A session was minted server-side with Django's `SessionStore` and the
cookie injected into the browser — the same thing `force_login` does in tests.

### Carried into Phase 4

- The storefront still has a placeholder `/` and no catalogue, PDP or search.
- `/admin` is a four-tile stand-in; the actionable dashboard is Phase 7.
- A UI-created test product (`عطر تجريبي من لوحة التحكم`) is left in the dev
  database deliberately — it is the artefact the gate was verified against.

---

## Phase 4 gate — 2026-08-21

**Five of seven criteria met. One struck with its reason. One FAILED and is
recorded as failed, not weakened.** 168 backend tests pass (129 → 168), plus 17
frontend unit tests.

- [x] **All 14 widget types render**

      Not inferred from the registry having 14 entries — every `WidgetShell`
      carries `data-widget-type`, and the homepage was read in a browser at
      390×844:

        sections with a widget type : 14
        distinct types              : 14 / 14
        horizontal overflow         : none

      Each one carrying real content, measured per widget:

        announcement_bar   1 link                   photo_link_grid    4 images, 4 links
        hero_cta           1 link                   collection_showcase 5 products
        carousel           3 slides, 3 links        spacer             (height only)
        category_list      4 categories             image              1 image
        product_list       6 products               recently_viewed    8 products
        text_block         copy                     buy_again          8 products
                                                    recommended_for_you 8 products
                                                    trending_near_you  8 products

      `seed_demo` now seeds all 14 types deliberately. A gate you cannot reach
      is not a gate, and the previous seed covered 6.

- [x] **Empty layout shows a designed empty state**, not a bare sentence

      Proven by making it happen, not by reading the branch:

        UPDATE storefront_layout SET is_global_active = false;
        GET /api/storefront/layout/  → {"layout": null, "widgets": []}   HTTP 200

      The homepage then renders a bordered card, an icon, an Arabic explanation
      and a way forward — "الصفحة الرئيسية قيد الإعداد … تصفّح كل المنتجات".
      The reference printed the bare string `لا توجد عناصر لعرضها حالياً` on an
      unstyled page here. Restored afterwards.

      200-with-null rather than 404 is deliberate: a 404 would send the SPA to
      an error screen instead of an empty state.

- [x] **Filters and sort survive a page refresh (URL state)**

      Driven in the browser, changing the sort through the real `<select>`:

        after change  ?category=armaf&in_stock=true&sort=price_desc
        results       380.00 · 310.00 · 265.00
        after reload  ?category=armaf&in_stock=true&sort=price_desc
        select value  price_desc          filter badge  2
        results       380.00 · 310.00 · 265.00   (unchanged)

- [~] **Variant selection updates price, stock and images**

      ~~and images~~ — **struck, with the reason, not silently dropped.**
      `02-data-model.md`'s `ProductImage` is `product · url · alt_text ·
      sort_order`. **There is no variant → image relation in the normative data
      model**, so a variant cannot change the gallery. The reference had one
      (`ProductVariantWithImages`); the spec omitted it, and Phase 1's recorded
      decision was spec-normative models only. **This is a decision for the
      user** — see "Raised during Phase 4" below. Nothing was added unilaterally.

      Price and stock pass, driven in the browser on `rasasi-hawas-ice`:

        50 مل  → 221.00 د.ل · متوفر     · NL-RASA-0048-1
        100 مل → 340.00 د.ل · بقي 5 فقط · NL-RASA-0048-2

      Unavailable combinations are **disabled and still visible**, never absent:
      on `armaf-club-de-nuit-intense`, `50 مل` renders struck through and
      disabled with an `aria` suffix "— غير متوفر".

- [x] **Badge, struck-through price and charged price agree on every discounted
      product**

      Checked against the API rather than by eye — for all 20 cards on
      `/products`, the rendered badge was compared with
      `round((compare_at - price) / compare_at × 100)` computed from the API's
      own numbers:

        cards 20 · discounted 5 · mismatches 0

      Structurally impossible to break: `<Price>` and `<DiscountBadge>` both
      derive from the same two prices, and the badge does not render at all when
      there is no real discount.

- [ ] **Lighthouse mobile on `/products/<slug>`: Performance ≥ 90, LCP ≤ 2.5 s,
      CLS ≤ 0.05 — FAILED on two of three.**

      `node scripts/perf.mjs / /products/rasasi-hawas-ice`
      (3 runs, median · Chrome 151 · macOS arm64, 8 cores · production build via
      `vite preview` · Lighthouse mobile defaults: 4× CPU, simulated Slow 4G)

        /products/rasasi-hawas-ice     performance  86   budget ≥ 90     FAIL
                                       LCP        3539   budget ≤ 2500   FAIL
                                       CLS           0   budget ≤ 0.05   PASS
        /                              performance  77   budget ≥ 90     FAIL
                                       LCP        4597   budget ≤ 2500   FAIL
                                       CLS           0   budget ≤ 0.05   PASS

      **This is written down as a failure because it is one.** The number was
      not improved by changing the budget.

      Diagnosed from the network log rather than guessed. First measurement:

        performance 68 · LCP 5639 ms
        LCP phases: TTFB 8 · load delay 4776 · load time 639 · render delay 45

      4.8 seconds of "load delay" — the hero image cannot be *discovered* until
      the JS bundle has downloaded **and** the API has answered. Three fixes,
      each measured:

      1. **Prime the product request from `index.html`.** A 25-line inline
         script starts `GET /api/products/<slug>/` before any module loads and
         injects the image preload the moment it lands; `lib/api.ts` adopts that
         promise instead of re-requesting. → 68 → 83, LCP 5639 → 3819 ms.
      2. **Storefront routes imported statically.** A lazy chunk is only
         discovered after the entry chunk runs, costing a round trip on the
         customer's first paint. The six storefront routes total ~15 kB gzipped
         and now ship with the entry; the 26 admin routes stay lazy, which is
         where splitting earns its keep. → 83 → 86.
      3. **`imagesrcset`/`imagesizes` on the preload link.** Preloading a bare
         `medium` while the `<img>`'s srcset chose `full` downloaded **both**
         files — visible in the network log. Related products also moved behind
         `requestIdleCallback`, off the LCP's connection budget.
         → LCP 3819 → 3539 ms.

      **What is left is architectural, and is Phase 9's already-open decision.**
      The remaining ~1.5 s is HTML → JS → API before the image URL is even
      known. `01-architecture.md` leaves the SEO approach open between a Django
      template endpoint and a build-time prerender for `/products/<slug>`;
      `IMPLEMENTATION.md` §10 already recommends the Django endpoint. That same
      endpoint emits the hero `<link rel="preload">` at HTML time and removes
      this delay. **Carried into Phase 9 as a named fix, not as a hope.**

      One measurement-environment caveat, recorded rather than used as an
      excuse: `vite preview` is HTTP/1.1, so the priming fetch queued behind six
      font/JS/CSS requests (it started at 1,687 ms). `deploy/nginx.conf` already
      serves `listen 443 ssl http2`, so production has more parallelism than
      this measurement. That is worth perhaps a few hundred milliseconds — not
      the 1,000 ms still missing.

- [x] **Initial storefront JS ≤ 180 kB gzipped**

      Measured in the browser against the production build, from
      `performance.getEntriesByType('resource')` — the bytes actually received,
      not a sum of file sizes:

        /                          16 files   148.8 kB gzip   (budget 180)
        /products/<slug>           17 files   149.3 kB gzip   (budget 180)
        CSS                                    13.4 kB gzip

      The admin bundle is absent from both, as intended.

### Built in Phase 4

**Backend**
- `apps/storefront/{services,serializers,views,urls}.py` — layout resolution
  (global flag · date range · weekday · hour window, most recently updated
  wins, falls back to the global default), widget **normalisation on write**,
  targeting, and server-side population of `product_list`, `category_list`,
  `collection_showcase` and the four personalised widgets. One request renders
  the homepage.
- Redis caching of the resolved layout, invalidated by `post_save`/`post_delete`
  on both models — which is what makes Phase 8's "visible immediately after a
  save" gate reachable. Personalised widgets are populated **outside** the
  cache: caching them would show one customer's history to another.
- `apps/catalog/services.search_products` — Postgres full-text (`simple`) plus
  trigram similarity, over Arabic-normalised text.

**Frontend**
- Storefront shell: `Header` (logo, search, category rail, account, cart),
  `Footer`, mobile `BottomNav`, `ThemeToggle`, skip link.
- `components/storefront/` — Price · DiscountBadge · StockBadge · ProductImage ·
  ProductCard · ProductGrid · ProductGallery · VariantSelector ·
  QuantityStepper · EmptyState · ErrorState · ProductListing.
- `components/storefront/widgets/` — all 14 renderers plus `WidgetShell`.
- Routes 1–3 and 15–17: `/`, `/products`, `/products/:slug`, `/search`,
  `/categories/:slug`, `/collections/:slug`.
- `scripts/perf.mjs` — Lighthouse, 3 runs, median, budgets from
  `05-frontend-spec.md`, and every number printed with its conditions.

`/search`, `/categories/:slug` and `/collections/:slug` are **new design work,
not ports** — `reference/INVENTORY.md` §2 records that the reference has no such
screens.

### Six defects found by driving it

**1. `seed_demo` was not idempotent, and silently changed every SKU.** Variant
counts grew 12 → 26 → 36 across three runs. The cause was
`abs(hash(slug)) % 10000` in the product SKU: **Python randomises `str` hashing
per process**, so each run produced a different SKU, and the variants'
`get_or_create(sku=…)` created a fresh set every time. Replaced with a SHA-1
digest. Three consecutive runs now report identical counts.

**2. `?in_stock=true` hid every product that has variants.** The filter asked
`stock > 0`, but a variant product keeps its stock on the *variants* and its own
row holds 0. `/categories/armaf?in_stock=true` returned 1 of 3 Armaf products
while all three cards said متوفر — the filter and the card disagreeing about the
same fact. The filter now mirrors the serializer exactly, including
`reserved_stock` and `is_active` on the variant.

**3. `available_stock` and `in_stock` were computed from different places**, so a
variant product's card read **"بقي 0 فقط"** (only 0 left) next to `in_stock:
true`. `available_stock` now sums the active variants. A follow-up test caught a
third disagreement in the same family: `get_in_stock` was counting *deactivated*
variants' stock.

**4. `/categories/:slug` listed the entire catalogue under the category's own
heading.** `<ProductListing>` spread `fixedParams` first and then wrote
`category: undefined` over it. Found by opening `/categories/ebhar` — a brand
seeded with zero products — and seeing 23 products under the heading إبحار. It
now shows the designed empty state, and `/categories/rasasi` shows exactly its 3.

**5. Every product page's title was doubled** —
"Armaf Club de Nuit Intense | نسائم ليبيا | نسائم ليبيا" — because the seeded
`meta_title` already ends with the store name and `usePageTitle` appended it
again.

**6. Two links smaller than 44 px** (the footer's البحث at 32 px wide, the header
logo at 36 px tall) and a menu button squeezed to 26 px by flex. Found by the
touch-target sweep; the sweep now reports **0** undersized targets on every
storefront route. The product card was also restructured to carry **one** anchor
instead of two links to the same product — a 22 px-tall title link and a
screen-reader repetition in one.

### A test that proved nothing, and was replaced

The first Arabic-search tests passed **with the normalisation deleted**, so they
were not testing it. Measured why:

    similarity('عود ملكي', 'عُودْ')            = 0.167   ← already over the 0.15 threshold
    similarity('الوسام الأصيل', 'الاصيل')      = 0.267

Short names match fuzzily by accident. On a long name the shared trigrams
dilute, and only normalisation finds it:

    similarity('عطر الياسمين الليبي الأصيل الفاخر', 'الاصيل') = 0.129   ← under threshold
    ILIKE '%الاصيل%'                                          = false
    to_tsvector @@ plainto_tsquery('الاصيل')                  = false

`TestArabicNormalisationIsWhatFindsThese` uses those cases and **fails when
`ARABIC_NORMALISERS` is emptied**. The weaker harakat test is kept but labelled
in the file as guarding behaviour rather than mechanism.

### Mutation checks — every new area proven able to fail

    Arabic normalisation emptied      → test_a_hamza_free_query_finds_a_long_name… FAILED
    layout fallback removed           → test_an_expired_layout_still_serves…       FAILED
    post_save cache invalidation cut  → test_saving_a_widget_invalidates…          FAILED
    in_stock filter → stock__gt=0     → 5 FAILED across two classes

All restored; 168 passed.

### Two measurements this tooling could not take

- **320 px viewport.** The browser pane clamps at ~392 px; `resize_window`
  reports success and `innerWidth` stays 392. Overflow was verified at **392,
  768 and 1440 px** (none at any). 320 px is **not measured** and is carried to
  Phase 9's Playwright sweep, which can set any viewport. Phase 2 recorded that
  faking this by setting `documentElement.style.width` produces a meaningless
  result; it was not repeated.
- **A contrast ratio read from the live DOM.** `getComputedStyle` returns
  `oklch()` strings, and a first attempt parsed them as RGB and printed a
  nonsense 1.32:1. `scripts/check-contrast.mjs` is the authority — re-run this
  phase: *All token pairs meet WCAG 2.1 AA.*

### Also verified in a browser

    RTL forced to dir="ltr" at 1440   layout mirrors, no overflow, nothing broken
    dark ⇄ light                      body background differs; --color-primary
                                      resolves 0.545 → 0.78 under .dark
    console errors on every route     none
    broken images / missing alt       0 / 0
    <h1> per page                     exactly 1 on all six routes
    JSON-LD on the PDP                valid Product + Offer, image URLs absolute

### Raised during Phase 4 — a decision for the user

**Variant images.** The reference gave each variant its own images; the spec's
`ProductImage` does not. That is why the gate's "and images" clause was struck.
Two options: (a) leave it — one gallery per product, which is how most Libyan
perfume listings work anyway; (b) add `ProductImage.variant` (nullable FK) and
filter the gallery on selection. (b) is roughly half a day including the admin
UI. **Not decided here.**

### Carried into Phase 5

- **The add-to-cart control does not exist yet.** The PDP's sticky mobile bar
  shows price and stock; the button belongs with the cart API, which is Phase 5.
  A button that looks real and does nothing is exactly the failure mode
  `00-mission.md` names, so none was shipped.
- `<QuantityStepper>` is built and unit-tested (bounds, clamping, stock ceiling)
  but is not placed on any screen until there is an action for it to feed.
- `/cart`, `/checkout/*` are still unrouted; the header and bottom-nav cart
  links resolve to nothing until Phase 5.
- The Lighthouse failure above, whose fix is Phase 9's server-rendered PDP
  endpoint.

### Phase 4 addendum — the gallery gap, found by re-reading the spec

A line-by-line re-read of `06-routes-and-pages.md` against what was built found
one requirement missed and three that Phase 5 owns.

**Missed and now built: "Gallery: swipeable on mobile."** The first version had
thumbnails and zoom but no swipe. It is now one horizontally snapping track —
the swipe itself is native CSS (`overflow-x` + `snap-mandatory`), with JS only
syncing the dot and thumbnail highlight — driven three ways that share one
index: swipe, thumbnail click, and the arrow keys (reading the *resolved*
direction, so ArrowLeft advances under RTL and retreats under LTR).

`seed_demo` now gives every third product **three** images instead of one. A
single-image catalogue left the entire gallery component unreachable, and a gate
you cannot reach is not a gate:

    23 منتج · 39 صورة        (was 23 صورة)
    two consecutive runs report identical counts

**One real bug found while verifying it.** Clicking a thumbnail highlighted it
but the image did not move. `slide.offsetLeft - track.offsetLeft` is wrong under
RTL — a later slide has a *smaller* offsetLeft and the container's `scrollLeft`
runs negative, so the computed target clamped to 0. Replaced with a signed delta
measured from the rendered boxes, which is correct in both directions.

Also fixed while there: the smooth scroll now respects
`prefers-reduced-motion`, which `07-design-system.md` requires of every
animation and a smooth scroll is one.

**A third measurement this tooling could not take.** The browser pane suspends
scroll animations while hidden — proven, not assumed:

    scrollTo({left: -1332, behavior: 'smooth'})   → scrollLeft 0
    scrollTo({left: -1332, behavior: 'instant'})  → scrollLeft -1332

and a synthetic `scrollTo` fires **no** scroll event at all, so the
swipe-drives-the-highlight path cannot be exercised here. What *was* verified:
three slides render, three thumbnails and three dots render, a thumbnail click
moves `selected` and `aria-current` to index 2, and the geometry is right
(slide offsets 0 / −666 / −1332 at a 666 px track). The swipe gesture itself is
carried to Phase 9's Playwright sweep, which drives a real compositor.

**Three PDP requirements belong to Phase 5, not to a later cleanup:**
`<QuantityStepper>` on the page, the sticky **add-to-cart** bar's actual button,
and the header's live cart count badge. All three need the cart API. They are
built in Phase 5, immediately after this.

---

## Phase 5 gate — 2026-08-21

**All seven criteria met, none struck.** 212 backend tests pass (168 → 212).

- [x] **A guest adds to cart without an account, and the cart survives a reload**

      Driven in the browser as a real anonymous visitor:

        POST /api/cart/  {product_id, quantity: 2}   → 201
        GET  /api/cart/                              → item_count 2, subtotal 530.00
        full page navigation to /cart                → the two items still there
        header badge                                 → 2

      A second client with its own session sees `item_count: 0` — the basket is
      keyed on the session, not shared.

- [x] **The guest cart merges into the user cart on login**

        as a guest        item_count 2 · subtotal 530.00
        POST /api/auth/login/                          → 200
        immediately after item_count 2 · subtotal 530.00

      **The first attempt at this measurement was wrong and was caught.** The
      browser still held a session from Phase 3's admin verification, so the
      "guest" add went straight onto a user cart and the merge appeared to fail.
      Logging out first and re-running produced the result above. Recorded
      because the failure looked like a bug in the merge and was a bug in the
      test.

      The session key is captured **before** `django_login`, because Django
      cycles it on login and the guest cart would otherwise be orphaned — that
      ordering is the whole trick, and `test_the_guest_cart_merges…` covers it.
      Quantities add up when both carts hold the same line, and the guest row is
      deleted rather than left behind.

- [x] **Concurrency: two simultaneous checkouts for the last unit — one
      succeeds, one gets 409. Real threads, no mocks.**

      `pytest apps/orders/test_checkout.py -k last_unit`

      Two threads, two database connections, a `threading.Barrier` so they
      collide, one unit of stock:

        outcomes      ['conflict', 'ok']
        reserved_stock 1
        orders created 1

      **Proven able to fail.** With `select_for_update()` removed from
      `services.checkout()`, three consecutive runs:

        FAILED test_two_checkouts_for_the_last_unit_one_succeeds_one_gets_409
        FAILED test_two_checkouts_for_the_last_unit_one_succeeds_one_gets_409
        FAILED test_two_checkouts_for_the_last_unit_one_succeeds_one_gets_409

      Both threads read `available_stock == 1` and both reserved it. Restored,
      it passes.

- [x] **Every price and total is recomputed server-side; a tampered client
      total is ignored**

      `CheckoutSerializer` has **no** `total` field, so a client that sends one
      is not merely overridden — it is never read. Verified by sending one:

        POST /api/cart/checkout/  {total: "1.00", subtotal: "1.00", shipping_total: "0.00"}
        → subtotal 900.00 · shipping 5.00 · total 905.00

      A tampered `unit_price` on add-to-cart is ignored the same way. Order
      lines snapshot the name and price: renaming the product to
      "اسم جديد تماماً" and repricing it to 999.00 leaves the placed order
      reading "عود ملكي" at 450.00.

- [x] **Discount validation covers expired / over-limit / below-minimum /
      capped** — and four more branches besides:

        inactive · not yet started · expired · over usage limit ·
        below minimum · capped at max_discount_amount · unknown code ·
        product-scoped with no eligible line · fixed amount exceeding the basket

      Each returns its own Arabic message. `usage_count` increments inside the
      checkout transaction under `select_for_update()`, so a limited-use code
      cannot be over-redeemed by concurrent checkouts. The public validation
      endpoint returns exactly `{code, name, discount_total, cart}` — a customer
      never learns a discount's usage limit or count.

- [x] **With zero cities configured, checkout explains the problem in Arabic**

      Made to happen, then looked at:

        UPDATE core_city SET is_active = false;
        GET /api/delivery/cities/
        → {"data": [], "message": "لا توجد مدن توصيل مُعرّفة في المتجر حالياً، يرجى التواصل معنا لإتمام الطلب"}

      The checkout screen renders that message as an error panel **in place of**
      the city and region selects. The reference rendered an empty `<select>`
      with no explanation and the customer simply could not order. A test also
      asserts the message contains no Latin characters, so an English string
      cannot leak back in.

- [x] **`pytest` green** — 212 passed.

### The flow, driven end to end in a browser

    add as guest → reload → log in (cart merges) → /cart
    → متابعة الشراء → /checkout/<uuid> → طرابلس → جنزور → address
    → تأكيد الطلب → /checkout/complete

      subtotal 530.00 · delivery 5.00 · total 535.00
      "التوصيل إلى: طرابلس · جنزور — شارع الشط، بجوار صيدلية النور، مبنى 12"

The city → region cascade shows each region's **effective** fee, not its raw
column: قرقارش displays 15.00 د.ل because its own fee is 0.00 and it inherits
the city's — the region-then-city fallback, visible on screen.

### Optimistic cart updates — measured, not asserted

`05-frontend-spec.md` requires cart mutations to be optimistic. Proven by
delaying the response and watching the clock, rather than by reading the code:

    PATCH artificially delayed 2,000 ms
    quantity displayed after 250 ms   → 2   (server had not answered)
    after the response landed          → 2

And the rollback, with the PATCH forced to 500:

    before 2 · optimistic 3 · after failure 2   → rolled back

### A design decision the routes forced

`06-routes-and-pages.md` puts the address step **on** `/checkout/:orderId`,
which means the order id has to exist before the customer has typed an address.
So checkout is two steps:

- `POST /api/cart/checkout/` creates a **draft**: prices locked, stock reserved,
  cart emptied, no address yet. Reserving at draft time is the point — nobody
  loses the last unit while filling in a form.
- `POST /api/checkout/` applies the address, region, courier and payment method,
  then adds the delivery fee and recomputes the total.

The subtotal and discount are **not** recomputed at confirmation. Repricing a
basket after the customer has committed to it is how a shop quietly charges a
different number than it quoted.

### One defect this produced, found by looking at the result

The order number came out **`202608UNK0001`**. The three-character tag is the
payment method (`INVENTORY.md` §5.2), and the payment method is now chosen after
the order exists — so every order would have been stamped `UNK`, making the tag
useless.

Fixed by re-tagging at confirmation: `202608UNK0002` → `202608MAN0002`. **Only
the tag changes** — the `YYYYMM` prefix and the sequence digits are the order's
identity and are untouched. The number is no longer shown on the checkout screen
before confirmation, so the customer never sees the intermediate value. Two
tests pin both halves of that.

### Order numbers

    format      YYYYMM + 3-char payment code + sequence     202608MOA0001
    source      PostgreSQL sequence, created in a migration (orders.0002)
    uniqueness  200 generated in a row → 200 distinct

The reference used `Math.floor(1000 + Math.random() * 9000)`. The sequence does
not reset monthly and is not modulo'd: after 9,999 orders the numeric part
becomes five digits, because a wrapping counter reintroduces exactly the
collision this replaces. Recorded as a deliberate deviation from the reference's
fixed four digits.

### Order visibility

A customer sees only their own orders — verified by **trying**, not by absence:
another signed-in customer gets `total: 0` from the list and **404** on the
order by both its UUID and its human number. 404 rather than 403, because
confirming that someone else's order exists is itself a leak.

### Phase 4's three carried items, now complete

`<QuantityStepper>` is on the product page and in the cart · the sticky mobile
bar carries a real **add-to-cart** button · the header shows a live cart count
badge, positioned with `end-1` so it mirrors in RTL.

### Sweeps on the new screens

    /cart       overflow none · one <h1> · 0 targets under 44px · 0 unlabelled inputs
    /checkout   overflow none · one <h1> · 0 unlabelled inputs

Two payment radios measure 20×20 as inputs. Their wrapping `<label>` is
**632×74** and is the actual target — the whole card is clickable — so the
effective target passes. Measured rather than waved away, and the sweep is
noted as needing to follow the label rather than the input.

### Carried into Phase 6

- No payment is taken. `POST /api/payments/` and the six gateways are Phase 6;
  the checkout screen offers only the two methods that need no gateway
  (bank transfer, card on delivery), because listing one that cannot yet take a
  payment would be a button that does nothing.
- Stock is **reserved**, never decremented. It leaves the shelf on payment
  confirmation, which is Phase 6's gate.
- `/checkout/redirect` is unrouted — it exists to handle a gateway's return leg.
- `/me/orders` and `/me/orders/:orderId` are Phase 7; `/checkout/complete` links
  to them today and they 404 until then.

---

## Post-Phase-5 audit — 2026-08-22

A full audit commissioned by the user: phase-consistency against `IMPLEMENTATION.md`,
a forbidden-technology sweep, and a bug hunt over the delivered code. Nothing here
weakens a gate; the record below lists what was found, what was fixed, and what was
flagged rather than acted on.

### The forbidden-technology sweep — clean

No `next.config.*`, no `next` dependency, no `next/*` import, no express/fastify/
`http.createServer`, no Dockerfile or compose file anywhere in `store-app/`. Node
exists only as build tooling (`vite`/`tsc`/`vitest`). The quarantine
(`store/reference/system/commerce-main`, `reference/commerce-main.zip`) is intact —
nothing leaked out by filename, import, or content. Replicated static gates: raw
palette classes 0 · hex colours in components 0 · physical-direction classes 0 ·
`dir="rtl"` in exactly 1 file. Only grey-area item: undeclared `lighthouse/` and
`@sentry/*` folders left in `frontend/node_modules/` by perf.mjs's documented
`npm i --no-save`; not in the lockfile, not bundled.

### Phase consistency — Phases 0–5 verify as claimed

Every artifact named in `IMPLEMENTATION.md` for Phases 0–4 exists as described, and
Phase 5's code matches its gate record (locking order, server-side totals, discount
branches under lock, the real-thread concurrency test). Discrepancies found are
bookkeeping, not behaviour:

1. **Money contradicts itself across the spec.** `01-architecture.md`'s table says
   "integer minor units server-side"; the normative `02-data-model.md` says
   `DecimalField(10,2)`. The build follows the data model. A spec amendment is
   needed; the code is compliant with the controlling document.
2. **Model-count drift.** PROGRESS Phase 1 says "17 spec models" in one line and
   implies 22 elsewhere; reality is 24 concrete models (22 excluding through-tables).
3. **`check_models.py` never checked `ProductCollection`.** The combined heading
   "`ProductCategory` / `ProductCollection`" parsed as one model, so deleting the
   collection through-table would still print all-green. FIXED this session:

         before → All 22 spec models present…     (ProductCollection uncheckable)
         after  → All 23 spec models present…     (its own row, verified)

   Its enum-section body also leaked into the previous model's field list; prose-only
   headings now close the section.
4. **Admin variants route deviates from route table #22** — `/admin/products/:id/variants`
   instead of `/admin/products/new/variants`. Sensible (variants need an existing
   product), but undocumented. Recorded, not changed.
5. **`.env.example` omitted `MARSOL_API_TOKEN` / `MARSOL_SENDER_ID`** although
   `apps/accounts/otp.py` reads both. FIXED this session.

### Defects found by the bug hunt

**Fixed this session, each with a regression test or mutation proof where the
platform allows one:**

- **HIGH — abandoned drafts leak reservations forever.** `checkout()` reserves stock
  at draft time (by design), but nothing expires an unconfirmed draft: no field, no
  cron, no reclamation path. An abandoned checkout permanently shrinks availability.
  **Flagged for the user / Phase 6–7**, not acted on silently — it needs a policy
  (expiry duration, release job, operator cancel) which is a scope decision.
- **MEDIUM — the gallery's programmatic-scroll guard could wedge.** If a smooth
  scroll to a thumbnail was interrupted mid-flight, `scrollingTo` never cleared:
  dots froze on the wrong image and zoom opened it. Now released three ways: any
  `pointerdown` on the track hands control back immediately; a 600 ms settle timer
  clears the guard if scrolling goes quiet away from the target; arrival still
  clears as before. (jsdom cannot animate scrolling, so this is verified by the
  logic paths + carried to Phase 9's Playwright sweep, like the swipe itself.)
- **MEDIUM — optimistic cart rollback could resurrect stale state.** Each mutation
  snapshotted the cache; when an older mutation failed after a newer one had settled,
  its rollback restored a pre-newer snapshot, transiently reverting confirmed cart
  state. Rollbacks now restore `lastConfirmedCart` — the most recent **server**
  payload (fetch/mutation/discount/details) — falling back to the snapshot only
  when nothing has been confirmed yet.
- **MEDIUM — `OrderDetailView.patch` wrote unvalidated values.** Any string was
  accepted as `status`. It now refuses illegal enum values, over-length tracking
  fields, and unknown fields outright. Mutation proof with the fix removed:

        pytest apps/orders/test_checkout.py::TestOrderAdminPatch
        → 3 failed in 2.37s          (old views.py)
        → 47 passed                  (fixed views.py)

  Transition *enforcement* remains Phase 7's gate; refusing illegal *values* is now
  true from the day the endpoint shipped.
- **LOW — `lib/api.ts` success path threw a raw `SyntaxError`** on a non-JSON 2xx
  body, bypassing every `ApiError` branch (silently killing the discount-form error
  display). Non-JSON success bodies now surface as `ApiError`.
- **LOW — a cities-fetch outage read as "no delivery cities".** `/checkout` rendered
  the store-misconfiguration message when the request merely failed. Fetch errors
  now render `<ErrorState>` with retry; only a genuinely empty list shows the
  empty-cities explanation.

### Verified-clean areas worth recording

Login goes through `authenticate()` only; CSRF holds on every public write
(`CsrfProtectedAPIView`) and every authenticated write (SessionAuthentication's own
enforcement); password reset is oracle-free and issues no session; OTP has no ported
bypass and compares digests; throttles key on phone; pagination caps at 100;
settings carry `ATOMIC_REQUESTS`, `SECURE_PROXY_SSL_HEADER`, HSTS, Secure/SameSite
cookies, explicit CORS origins; money arithmetic stays in Decimal server-side and
string-derived display client-side with div-by-zero guards.

### Harness re-run after the fixes

    pytest                          → 215 passed in 31.57s    (was 212)
    npm test                        → 17 passed               (unchanged)
    tsc --noEmit                    → clean
    bash scripts/gates.sh           → 12 passed, 0 failed
    scripts/check_models.py         → All 23 spec models present with every named field.
    node scripts/check-contrast.mjs → All token pairs meet WCAG 2.1 AA.

### Version control started this session

The project had **no local `.git`** — every commit above this point in history did
not exist. Baseline `afdc118` captures Phases 0–5 exactly as audited; fixes land as
the following commit.

### Draft-expiry fix — 2026-08-22 (the audit's HIGH finding, built same day)

**Policy:** an unconfirmed draft is a **60-minute lease**. `Order.finalised_at`
(nullable, set by `finalise_order()`, migration `orders.0003`) separates a draft
from a confirmed order awaiting payment — status alone cannot, because both are
`pending` until Phase 7's fulfilment transitions.

- `services.release_expired_drafts()` cancels expired drafts, hands
  `reserved_stock` back with clamped atomic updates, and returns the draft's
  discount use to `usage_count` — an abandoned basket must not burn a limited code.
- Correctness never depends on cron existing: a lazy sweep runs inside
  add-to-cart and checkout, throttled to once per 30 s cluster-wide via Redis
  `cache.add`. The sweep runs **before any row is read**, because a courtesy
  stock check that read a stale `reserved_stock` was itself the first bug the
  test caught.
- `manage.py release_expired_drafts` for the cron entry in `deploy/README.md`.

    pytest apps/orders/test_checkout.py::TestExpiredDrafts  → 7 passed
    mutation (sweep hooks disabled)                          → 1 failed (the wiring test)
    full apps/orders                                         → 54 passed

The management command, run on the dev database, found and released **3 real
abandoned drafts** left by Phase 5's browser verification — the leak, caught in
the wild on day one.

---

## Phase 7 gate — 2026-08-22

**All six criteria met.** 226 backend tests pass (222 → 226). Phase 6 was
paused mid-build by the user ("skip payments and delivery"); its providers sit
in commit `47780ad`, unwired, and are not counted here.

- [x] **An operator fulfils an order end to end through the UI**

      Driven in the browser on a real order (`202608MAN0004`, created through
      the storefront flow minutes earlier): بدء المعالجة → tracking number
      typed and saved → قبول الشحن → إكمال الطلب. Server state after:

        tracking: VX-TEST-001 · shipping: accepted · status: completed

      (One measurement note: `trackingShown` first read false because an
      `<input>`'s value never appears in `innerText` — the API confirmed the
      value had saved.)

- [x] **Order status transitions are enforced server-side**

      A transition map in `orders/views.py` answers 409 to any path the
      business forbids — `pending→completed`, anything out of a terminal
      state — whatever the client sends; the UI merely mirrors it by only
      offering legal buttons. Four new tests pin allowed, illegal-jump,
      terminal, and reservation-release paths.

      Cancelling/refunding also returns stock now: unpaid orders get their
      reservation back; paid orders return units to `stock` (they left the
      shelf at payment confirmation).

- [x] **A customer sees only their own orders** — carried verified from
      Phase 5 (404 by UUID *and* by number for another customer); unchanged.

- [x] **Every admin list has working sort, filter, pagination and an empty
      state** — Orders/Customers/Discounts/Cities all render real data through
      `<DataTable>` with server search + status filters + URL-held page state;
      each was loaded in the browser with zero horizontal overflow.

- [x] **Dashboard tiles link to the filtered lists that resolve them** —
      pending/processing/completed tiles deep-link `/admin/orders?status=…`,
      customers → `/admin/users`, low-stock → `/admin/inventory`.

- [x] **Charts render RTL-correctly** — the 14-day revenue chart is pure CSS
      bars in an LTR-scoped container: no charting library, nothing to mirror,
      dates in tooltips, day 1 at the reading start.

### Built in Phase 7

- Backend: transition map + stock-return on cancel/refund · `/api/me/`
  profile PATCH · `/api/me/addresses/` CRUD with single-default handling ·
  admin users list (search+pagination) · discount create · cities/regions fee
  management · dashboard stats + series endpoint.
- Frontend: `/me/orders`, `/me/orders/:orderId`, `/me/addresses`;
  real Dashboard; `/admin/orders` + order-detail fulfilment screen;
  `/admin/users(/:id)`; discounts list/create; `/admin/cities`.

### Two defects found by driving it

1. **Paginated envelopes lost their `meta` in the new hooks** — `.data` on an
   `{data, meta}` payload strips the meta beside it. The catalog hooks already
   handled this; orders/users hooks now follow the same pattern.
2. **Hand-minted admin sessions silently anonymous** — Django 5 verifies
   `_auth_user_hash`; a session without the password-hash HMAC loads fine but
   authenticates nobody. Minting must include `user.get_session_auth_hash()`.
   Recorded here because the next person to inject a session will hit it.

### Carried forward

- Phase 6 remainder (payments/delivery wiring, screens 36–44) — paused by user.
- Phase 8 widget builder is next per `09-phases.md`.

    pytest → 226 passed · gates.sh → 12 passed 0 failed · tsc clean · vitest 17
