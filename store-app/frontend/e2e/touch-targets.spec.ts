import { expect, test, type Page } from '@playwright/test'

import { liveData } from './routes'

/**
 * Gate: "Every interactive element ≥ 44×44 px." That is Apple's HIG minimum and
 * WCAG 2.5.8's target size. We sweep every visible control on the public
 * storefront and fail on any that is too small to tap reliably.
 *
 * The one sanctioned exception (WCAG 2.5.8) is a link inline within a run of
 * text — its size is dictated by the surrounding prose, not the control. Those
 * are excluded; standalone buttons, icon buttons, inputs and nav links are not.
 */

const MIN = 44
const data = liveData()

const PATHS = [
  '/',
  '/products',
  data.productSlug ? `/products/${encodeURIComponent(data.productSlug)}` : null,
  '/cart',
  '/login',
  '/register',
  '/forgot-password',
].filter((p): p is string => p !== null)

interface Offender {
  tag: string
  text: string
  w: number
  h: number
}

async function smallTargets(page: Page): Promise<Offender[]> {
  return page.evaluate((min) => {
    const selector = 'a, button, input, select, textarea, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [tabindex]:not([tabindex="-1"])'
    const out: Offender[] = []
    const seen = new Set<Element>()

    for (const el of Array.from(document.querySelectorAll(selector))) {
      if (seen.has(el)) continue
      seen.add(el)

      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') continue

      const rect = el.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) continue // not laid out / off-screen

      // Visually-hidden (sr-only) affordances — the "skip to content" link, for
      // one — collapse to ~1px until focused, when they expand to full size.
      // They are keyboard/AT features, not visible tap targets, so exempt them.
      if (rect.width <= 1 || rect.height <= 1) continue

      // Inline text links are the sanctioned exception: an <a> rendered inline
      // whose parent block holds real text around it.
      const tag = el.tagName.toLowerCase()
      if ((tag === 'a' || el.getAttribute('role') === 'link') && style.display.startsWith('inline')) {
        const parentText = (el.parentElement?.textContent || '').trim()
        const ownText = (el.textContent || '').trim()
        if (parentText.length > ownText.length) continue
      }

      // A hidden native input paired with a big styled control (checkbox/switch)
      // is measured by its control, not the 1px input — skip zero-area inputs.
      if (tag === 'input' && (rect.width < 2 || rect.height < 2)) continue

      if (rect.width < min || rect.height < min) {
        out.push({
          tag,
          text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        })
      }
    }
    return out
  }, MIN)
}

for (const path of PATHS) {
  test(`touch targets ≥ ${MIN}px — ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading').first()).toBeVisible()
    const offenders = await smallTargets(page)
    expect(offenders, `undersized targets on ${path}:\n${JSON.stringify(offenders, null, 2)}`).toEqual([])
  })
}
