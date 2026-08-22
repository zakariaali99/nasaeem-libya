import { expect, test, type Page } from '@playwright/test'

import { liveData } from './routes'

/**
 * Gate: "Forcing dir=ltr breaks no layout." The app is Arabic/RTL, but a layout
 * built with logical properties (margin-inline, inset-inline, text-align:start)
 * must survive the document direction flipping to LTR without overflowing or
 * collapsing. If forcing LTR breaks something, a physical `ml-`/`left-` snuck in.
 *
 * We flip `dir` to ltr, then assert the same invariants as the RTL sweep: a
 * visible heading and no horizontal overflow.
 */

const data = liveData()

const PATHS = [
  '/',
  '/products',
  data.productSlug ? `/products/${encodeURIComponent(data.productSlug)}` : null,
  '/cart',
  '/login',
  '/register',
].filter((p): p is string => p !== null)

async function forceLtr(page: Page) {
  await page.evaluate(() => {
    document.documentElement.setAttribute('dir', 'ltr')
    document.documentElement.setAttribute('lang', 'en')
  })
}

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement
    return Math.max(doc.scrollWidth - doc.clientWidth, document.body.scrollWidth - doc.clientWidth)
  })
}

for (const path of PATHS) {
  test(`layout survives forced LTR — ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    await forceLtr(page)
    await page.waitForTimeout(150) // let any reflow settle
    await expect(page.getByRole('heading').first()).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
  })
}
