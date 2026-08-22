import { expect, test } from '@playwright/test'

import { liveData } from './routes'

/**
 * SEO leg of the Phase 9 gate, from the browser's side.
 *
 * The server shell injects a `[data-seo]` JSON-LD block for crawlers; the client
 * `useProductJsonLd` reuses that same node. After hydration there must be
 * exactly ONE JSON-LD block, and navigating between products must keep it
 * current — never leave a stale one or add a second. (The raw-source guarantee,
 * that `curl` sees the name and price with no JS, is pinned by the backend
 * `test_spa.py`.)
 */

const data = liveData()

test.skip(!data.productSlug, 'no product in the live database')

test('product page carries exactly one, current JSON-LD block', async ({ page }) => {
  await page.goto(`/products/${encodeURIComponent(data.productSlug!)}`, { waitUntil: 'networkidle' })

  const blocks = page.locator('script[type="application/ld+json"]')
  await expect(blocks).toHaveCount(1)

  const ld = JSON.parse((await blocks.first().textContent()) || '{}')
  expect(ld['@type']).toBe('Product')

  const heading = (await page.getByRole('heading', { level: 1 }).first().textContent())?.trim()
  expect(ld.name).toBe(heading)
})

test('a page with no product exposes no product JSON-LD', async ({ page }) => {
  await page.goto('/products', { waitUntil: 'networkidle' })
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0)
})
