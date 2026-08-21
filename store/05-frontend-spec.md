# 05 — Frontend specification (React + Vite + Tailwind)

## Stack — fixed

React 19 · Vite 6 · TypeScript (strict) · Tailwind CSS **v4** ·
React Router 7 · TanStack Query 5 · react-hook-form + zod · Radix UI ·
lucide-react · Vitest + Testing Library · Playwright.

**One library per job.** The reference shipped `formik` *and* `react-hook-form`,
two markdown editors, `react-select` *and* a custom multiselect, plus `redux` and
`@mantine/*` with zero imports. **Do not install a second library for a job that
already has one.**

**Forbidden:** any `next` package, any `next/*` import, `redux`, `formik`,
`@mantine/*`, a `tailwind.config.ts`, a `Dockerfile`.

## `vite.config.ts`

```ts
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: 5173,
      proxy: { '/api': { target: env.VITE_API_URL || 'http://127.0.0.1:8000', changeOrigin: true } },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            query: ['@tanstack/react-query'],
            radix: ['@radix-ui/react-dialog', '@radix-ui/react-select', /* ... */],
          },
        },
      },
    },
  }
})
```

**Code-splitting is mandatory, not an optimisation.** The admin section is 26 of
44 routes; a customer must never download it. Every admin route is
`React.lazy()`. The reference shipped a single 528 kB chunk — that is the failure
to avoid.

## Structure

```
src/
  main.tsx                 mount, providers
  App.tsx                  routes
  pages/
    storefront/            Home, Products, ProductDetail, Cart, Checkout, Account, Orders
    auth/                  Login, Register, ForgotPassword
    admin/                 one folder per admin route
  components/
    ui/                    PRIMITIVES ONLY
    storefront/            ProductCard, Price, QuantityStepper, StockBadge, ...
    admin/                 DataTable, forms, ...
    layout/                Header, Footer, AdminSidebar
  lib/
    api.ts                 fetch wrapper: credentials, CSRF, error normalisation
    queries/               one file per resource, TanStack Query hooks
    format.ts              money, dates, numbers  <- SINGLE SOURCE
    utils.ts               cn()
  styles/globals.css       Tailwind v4 @theme token layer
  types/                   shared TS types mirroring the API
```

> `components/ui/` holds **primitives only** — Button, Input, Dialog, Select.
> The reference put `ProductCard`, `HeroCarousel`, `ImageEditor` and five more
> composites in there, and the boundary stopped meaning anything. Composites go
> in `storefront/` or `admin/`.

## The API client — `lib/api.ts`

One wrapper. Every request goes through it. It must:

- send `credentials: 'include'` **always** (session cookies),
- read the CSRF cookie and set `X-CSRFToken` on unsafe methods,
- unwrap `{data}` and normalise errors into one `ApiError` shape carrying the
  Arabic `message` and the field `errors`,
- never swallow an error silently.

**No `fetch()` anywhere else in the codebase.**

## Data layer — TanStack Query

One hook file per resource. Query keys are structured: `['products', {filters}]`,
`['product', slug]`, `['cart']`.

Mutations that change the cart are **optimistic**. On a slow Libyan mobile
connection, waiting for a round trip before the basket updates is the single
biggest "feels broken" signal in the app. Optimistic update, rollback on error,
invalidate on settle.

## Forms

`react-hook-form` + `zod` resolver. Every form: inline field errors in Arabic,
`disabled` + spinner while submitting (**double-submit protection is mandatory**),
a top-level error summary on failure, and unsaved-changes protection on the
long admin forms.

## Routing

React Router 7, `createBrowserRouter`. Every one of the 44 paths in
`06-routes-and-pages.md` resolves. Admin routes sit behind a guard that checks
the role from `/api/auth/me/` and redirects to `/login` otherwise.

**nginx must be configured with SPA fallback** (`try_files $uri /index.html`),
or every deep link 404s on refresh.

## Error and loading discipline

Every route has: a **loading** state (skeleton matching final layout, not a
spinner), an **empty** state (illustration + Arabic explanation + an action), an
**error** state (Arabic message + retry), and the **success** state.

An error boundary wraps the router. A crash shows an Arabic message, not a white
screen.

> The reference homepage rendered the bare string `لا توجد عناصر لعرضها حالياً`
> on an unstyled page when the widget layout was empty — on the most important
> screen in the store. Every empty state must be designed.

## Performance budget — enforced

| Metric | Budget |
|---|---|
| Initial JS (gzip), storefront | **≤ 180 kB** |
| Any single chunk | ≤ 250 kB |
| LCP on `/products/<slug>`, mobile throttled | **≤ 2.5 s** |
| CLS | ≤ 0.05 |
| Lighthouse Performance, mobile | **≥ 90** |

Images: explicit `width`/`height` on every one (CLS), `loading="lazy"` except
the LCP image which gets `fetchpriority="high"`, WebP with a fallback, and a
`srcset` from the thumb/medium/full renditions.
