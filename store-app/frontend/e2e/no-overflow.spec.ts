import { expect, test, type Page } from '@playwright/test'

import { liveData } from './routes'

/**
 * Gate: no page scrolls horizontally on mobile. A body wider than the viewport
 * is the classic RTL/overflow bug — a fixed width, an unwrapped table, a margin
 * that should have been logical. Checked on the public storefront, which is what
 * a customer's phone renders.
 */

const data = liveData()

const PATHS = [
  '/',
  '/products',
  data.productSlug ? `/products/${encodeURIComponent(data.productSlug)}` : null,
  data.categorySlug ? `/categories/${encodeURIComponent(data.categorySlug)}` : null,
  data.collectionSlug ? `/collections/${encodeURIComponent(data.collectionSlug)}` : null,
  '/search?q=%D8%B9%D8%B7%D8%B1',
  '/cart',
  '/login',
  '/register',
  '/forgot-password',
].filter((p): p is string => p !== null)

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return Math.max(doc.scrollWidth - doc.clientWidth, document.body.scrollWidth - doc.clientWidth)
  })
}

for (const path of PATHS) {
  test(`no horizontal overflow — ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading').first()).toBeVisible()
    // 1px of slack absorbs sub-pixel rounding; anything more is a real overflow.
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
  })
}
