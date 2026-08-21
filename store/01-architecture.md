# 01 — Architecture

## The shape of the system

Two deployable pieces and nothing else:

```
   Browser (Arabic, RTL, mobile)
        |
        |  HTTPS
        v
   +--------------------------------------------------+
   |  nginx                                           |
   |    /            -> static SPA files (dist/)      |
   |    /api/        -> proxy to gunicorn             |
   |    /django-admin/ -> proxy to gunicorn           |
   |    /media/      -> uploaded files from disk      |
   +--------------------------------------------------+
                          |
                          v
   +--------------------------------------------------+
   |  gunicorn  ->  Django + DRF                      |
   +--------------------------------------------------+
         |                        |
         v                        v
   PostgreSQL                  Redis
   (all state)         (cache, sessions, rate limits)
```

**That is the entire runtime.** Three processes: nginx, gunicorn, plus PostgreSQL
and Redis. No Node. No containers.

## Why this shape

The frontend is a **static single-page application**. Vite compiles React +
Tailwind into plain `.html`, `.js` and `.css` files. nginx serves those files
directly from disk — it does not execute them. There is no JavaScript runtime on
the server, which is what makes Rule 1 satisfiable.

Django owns **all** state and **all** logic: the database, sessions,
authentication, business rules, payment provider calls, courier calls. The React
app is a client. It renders, it calls `/api/`, it holds no authority.

## Request lifecycle

**A page load.** Browser requests `/products/royal-oud`. nginx finds no such file
and falls back to `index.html` (SPA fallback). The browser loads the JS bundle,
React Router reads the URL, the product page mounts and calls
`GET /api/products/royal-oud/`. nginx proxies that to gunicorn. Django queries
PostgreSQL and returns JSON. React renders.

**A write.** The React app sends `POST /api/cart/` with a session cookie and a
CSRF token. Django authenticates, validates, mutates inside a transaction, and
returns the new cart.

## Authentication

**Session cookies, issued and validated by Django.** Not JWT in `localStorage`.

- `POST /api/auth/register/` — phone + password + name
- `POST /api/auth/login/` — phone + password, **must call Django's
  `authenticate()`**
- `GET /api/auth/me/`, `POST /api/auth/logout/`, `GET /api/auth/csrf/`

The user model's `USERNAME_FIELD` is `phone_number`. A Libyan phone number is the
identity.

> **The single most important security rule in this project.** An earlier version
> of the reference system issued a session on a **phone number alone**. That was a
> total authentication bypass — a phone number is public information, not a
> secret. **Never look up a user by phone and log them in.** Always
> `authenticate(phone_number=..., password=...)` and only create a session if it
> returns a user. Any code path that produces a session without verifying a
> password is a critical vulnerability.

Cookies: `HttpOnly`, `Secure` in production, `SameSite=Lax`. CSRF enforced on
every unsafe method.

## Why not SSR, and what it costs

A static SPA ships an empty shell to crawlers. For a store, product pages not
ranking is a real business cost. Rule 1 forbids the usual fix (Next.js), so:

- Django renders **`<meta>` tags, Open Graph, and JSON-LD `Product` data**
  server-side for `/products/<slug>` via a small template endpoint, **or**
- a build-time prerender step emits static HTML for the catalogue.

`09-phases.md` places this in its own phase. **Do not skip it and do not solve it
by reintroducing Next.js.**

## Environments

**Development.** Vite dev server on `:5173` with a proxy sending `/api` to Django
on `:8000`. Django runs via `python manage.py runserver`. PostgreSQL and Redis run
natively (Homebrew on macOS, systemd on Linux). No containers.

**Production.** `npm run build` produces `dist/`. Copy it to the server. nginx
serves it. gunicorn runs Django behind systemd. Redis and PostgreSQL run as
system services. Deployment is `git pull`, `pip install`, `migrate`,
`collectstatic`, `npm ci && npm run build`, `systemctl restart`.

## Repository layout

```
store-app/
  backend/
    config/          settings, urls, wsgi
    apps/
      core/          User, City, Region, UserAddress
      accounts/      register, login, logout, me, admin users
      catalog/       Category, Collection, Product, variants, inventory, images
      orders/        Cart, Order, Discount, DeliveryMethod, checkout
      payments/      providers, payment records, webhooks
      delivery/      couriers, cities, regions, geo
      storefront/    StorefrontLayout, Widget
      health/        readiness probe
    manage.py
    requirements.txt
  frontend/
    src/
      main.tsx       entry
      App.tsx        router
      pages/         one folder per route
      components/
        ui/          primitives ONLY
        storefront/  customer-facing composites
        admin/       operator composites
      lib/           api client, formatters, hooks
      styles/
        globals.css  Tailwind v4 @theme token layer
    index.html
    vite.config.ts
    package.json
  deploy/
    nginx.conf
    gunicorn.service
    README.md
```

**Forbidden anywhere in this tree:** `Dockerfile`, `docker-compose.yml`,
`next.config.*`, any `next` dependency, any `next/*` import, any Node file that
runs in production.

## Technology decisions, fixed

| Concern | Decision | Why |
|---|---|---|
| API style | DRF, JSON, session auth | Django owns identity |
| Frontend routing | React Router 7 | SPA, no framework router |
| Server state | TanStack Query | caching, retries, dedup |
| Form state | **react-hook-form + zod, only** | one library, never two |
| Styling | **Tailwind v4, CSS-first `@theme`** | see `07-design-system.md` |
| Primitives | Radix UI + shadcn-style | accessible, unstyled |
| Icons | lucide-react | |
| Money | **integer minor units server-side** | never float for currency |
| IDs | UUID v4 | non-enumerable |
| Tests | pytest + DRF client; Vitest + Testing Library; Playwright | |

> **Tailwind v4 is CSS-first.** A `tailwind.config.ts` file is **not read** unless
> explicitly `@config`-ed. Define every token in `globals.css` inside `@theme`.
> Do not create a `tailwind.config.ts`. The reference system shipped one for
> months containing the entire brand palette, and none of it ever compiled.
