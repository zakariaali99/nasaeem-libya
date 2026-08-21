# Phase 3 — Catalog API + admin catalog screens ✅

## Done

**Backend** — `apps/catalog/`
- `services.py` — the only supported way to move stock is `adjust_stock()`, which
  locks the row and **always** writes an `InventoryLog`. Also Arabic-safe unique
  slugs, the variant matrix generator, and Pillow renditions.
- `serializers.py` — the product list carries everything a card needs in one
  response; `discount_percent` is **derived** from the two prices beside it, so
  the badge cannot disagree with them.
- `views.py` — 18 endpoints: products (list/detail/CRUD, slug **or** UUID),
  categories (tree), collections, options, values, variants, the variant matrix,
  inventory levels/adjust/logs, and image upload.
- `apps/core/pagination.py` — the `{data, meta}` envelope.

**Frontend**
- **`<DataTable>`** — built once for all 26 admin screens: sorting, search,
  server pagination, column visibility, bulk actions, row actions, designed empty
  state, skeleton loading, and a **card layout on mobile** (a table at 390 px is
  unusable).
- Screens 19–27: dashboard, products list, product new/edit, variant matrix
  builder, categories (tree), collections, inventory, inventory logs.
- `ProductForm` — grouped sections, image upload with drag **and keyboard**
  reordering, unsaved-changes protection, dirty-state indicator.
- `useUrlState` — filters, sort and page live in the URL, so results are
  shareable and the back button works.

## Gate — 6 of 6

| Criterion | Evidence |
|---|---|
| Every catalog endpoint responds to a real request | driven over HTTP: list, Arabic-slug detail, category tree, admin endpoints 401 anonymous |
| **Operator creates a product through the UI → appears in the storefront API** | created in the browser → public API returns it with badge 22% agreeing with 249.50 / 320.00 |
| Inventory adjustment writes an `InventoryLog` | driven through the UI dialog: logs 23 → 24, with change +7, reason, note and actor |
| A customer gets **403** on every admin endpoint | parametrised sweep over the endpoint list |
| `GET /api/products/` issues **no N+1** | query count stays flat as rows grow |
| `pytest` green | **129 passed** (80 → 129) |

Variants were also generated through the UI — two combinations from the option
values, appearing immediately in the variants table.

## The N+1 test proved itself

An interrupted command left `product_queryset()` stripped of its prefetches. The
test caught it immediately and said exactly what was wrong:

    query count grew from 12 to 52 when 10 products were added — N+1

Restored, it passes. That is the mutation proof, obtained by accident but real.

## Three defects found by driving it

1. **`CSRF_TRUSTED_ORIGINS` still pointed at port 5173** after the dev server
   moved to 5183. Every admin write 403'd with
   *"Origin checking failed"*. Auth passed earlier only because it was tested
   with curl, which sent a `Referer` matching Django's own origin — the browser
   is what exposed it.
2. **`<Button asChild>` crashed the router.** It rendered a spinner slot plus
   children, and Radix `Slot` accepts exactly one child, so every `asChild`
   button threw. The error boundary did its job — an Arabic message, not a white
   screen — but the page was unusable.
3. **Pagination buttons were 40 px tall.** `07-design-system.md` lists both
   `sm: h-10` and an absolute 44 px minimum; where they conflict the minimum
   wins. Fixed in `DataTable` once, so all 26 screens inherit it.

Also fixed: the entry chunk was 228 kB because object-form `manualChunks` matches
package entry points only, so `react-dom/client` fell through. Switched to path
matching — entry is now **13 kB**.

## Verified in a browser at 390×844

All six admin routes render **real data**, no placeholder text, one `<h1>` each,
no horizontal overflow, nothing below 44×44, and the mobile card layout replaces
the table.

## Next
Phase 4 — storefront browse: the CMS homepage with all 14 widget renderers, the
catalogue with URL-persisted filters, the product detail page, and search. The
gate adds Lighthouse ≥ 90 and an initial-JS budget of 180 kB gzipped.
