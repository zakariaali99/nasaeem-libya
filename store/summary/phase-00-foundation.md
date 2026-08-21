# Phase 0 — Foundation ✅

## Done
- Django 5.2 + DRF on Python 3.12, PostgreSQL 14 and Redis 6 connected natively.
  `ATOMIC_REQUESTS=True`, DRF deny-by-default, session cookies, production boot
  guard that raises at import when a required env var is missing.
- Vite 6 + React 19 + TypeScript strict + Tailwind v4 with the whole token layer
  in `globals.css`. No `tailwind.config.ts`.
- Cairo self-hosted with a verified `U+0600–06FF` range. `<html lang="ar" dir="rtl">`.
- `lib/api.ts` (the only `fetch` in the app), `lib/format.ts` (the only money
  formatter), theme provider wired to `.dark`.
- `scripts/gates.sh` (12 static checks), `scripts/check-contrast.mjs`,
  nginx + gunicorn + systemd configs.

## What it proves
- Boot guard fires: removing `REDIS_URL` under `DEBUG=False` raises `ImproperlyConfigured`.
- Health endpoint can fail: pointing Redis at a dead port returns **503**.
- `gates.sh` can fail: planting `tailwind.config.ts` + `bg-white` → 9 passed, 3 failed.

## Corrections made
- **A false green caught.** The first health check hit an unrelated Django app
  squatting on port 8000. This project now uses Django `:8010` / Vite `:5183`
  with `strictPort: true`.
- **One gate criterion struck.** `document.fonts.check('16px Cairo')` returns
  `true` for fonts that do not exist, so it cannot fail. Replaced with a loaded
  `FontFace` assertion plus a canvas `measureText` comparison.
- **Six token pairs failed WCAG** as specified, including white-on-primary at
  3.95:1. Corrected by solving numerically for lightness.

## Next
Phase 1 — every model in `02-data-model.md`.
