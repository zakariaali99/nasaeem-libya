import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test'

import { AUTH, liveData, PLACEHOLDER_MARKERS, ROUTES, type Access, type RouteDef } from './routes'

/**
 * Gate: "All 44 routes render with real data. No placeholders. Enumerate them."
 *
 * Every built route is visited under the storage state its access demands, and
 * asserted to (a) show a real heading, (b) not redirect to /login (which would
 * mean the auth guard rejected us, i.e. the page never rendered), and (c) carry
 * none of the placeholder markers the reference build shipped.
 *
 * Routes belonging to the paused Phase 6 (payments & delivery, screens 36–44,
 * plus 7/18/22/34) are declared with `test.fixme` so the suite records them as
 * expected-pending instead of silently passing.
 */

const data = liveData()

async function idFrom(statePath: string, url: string, pick: (json: any) => string | null) {
  const api = await request.newContext({ baseURL: process.env.E2E_BASE_URL || 'http://localhost:5183', storageState: statePath })
  try {
    const res = await api.get(url)
    if (!res.ok()) return null
    return pick(await res.json())
  } catch {
    return null
  } finally {
    await api.dispose()
  }
}

// Dynamic entity ids, resolved once against the live database.
let ctx: Record<string, string | null> = {
  productSlug: data.productSlug,
  categorySlug: data.categorySlug,
  collectionSlug: data.collectionSlug,
  orderId: null,
  adminOrderId: null,
  userId: null,
  layoutId: null,
  discountId: null,
}

test.beforeAll(async () => {
  const firstData = (j: any) => (j?.data?.[0]?.id ?? j?.results?.[0]?.id ?? null)
  // /api/orders/ is role-scoped: a customer sees only their own orders, an owner
  // sees all. The test customer has none, so their order routes skip honestly;
  // the owner resolves a real order for the admin order-detail screen.
  ctx.orderId = await idFrom(AUTH.customer, '/api/orders/', firstData)
  ctx.adminOrderId = await idFrom(AUTH.owner, '/api/orders/', firstData)
  ctx.userId = await idFrom(AUTH.owner, '/api/admin/users/', firstData)
  ctx.layoutId = await idFrom(AUTH.owner, '/api/admin/storefront-layouts/', firstData)
  ctx.discountId = await idFrom(AUTH.owner, '/api/discounts/', firstData)
})

function resolvePath(route: RouteDef): string | null {
  if (!route.dynamic) return route.path
  const value = ctx[route.dynamic]
  if (!value) return null
  return route.path.replace(/:[A-Za-z]+/, encodeURIComponent(value))
}

async function assertRendered(page: Page, path: string, access: Access) {
  const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(response, `no response for ${path}`).toBeTruthy()

  // An authed route that bounced to /login never rendered its content. (The
  // public /login and /register pages legitimately live at that URL.)
  if (access !== 'public') {
    await expect(page, `${path} redirected to login`).not.toHaveURL(/\/login/)
  }

  // A real heading must be visible (the gate's "real <h1>").
  await expect(page.getByRole('heading').first()).toBeVisible()

  const body = ((await page.locator('body').innerText()) || '').toLowerCase()
  for (const marker of PLACEHOLDER_MARKERS) {
    expect(body, `${path} contains placeholder "${marker}"`).not.toContain(marker.toLowerCase())
  }
}

const byAccess = (access: Access) => ROUTES.filter((r) => r.access === access && !r.pending)

for (const access of ['public', 'customer', 'owner'] as const) {
  test.describe(`${access} routes`, () => {
    if (access !== 'public') test.use({ storageState: AUTH[access] })

    for (const route of byAccess(access)) {
      test(`#${route.n} ${route.label} — ${route.path}`, async ({ page }) => {
        const path = resolvePath(route)
        test.skip(path === null, `no live entity for :${route.dynamic}`)
        await assertRendered(page, path!, access)
      })
    }
  })
}

// Paused Phase 6 screens — enumerated so the count is honest, marked pending.
for (const route of ROUTES.filter((r) => r.pending)) {
  test.fixme(`#${route.n} ${route.label} — ${route.path} (Phase 6 pending)`, () => {})
}
