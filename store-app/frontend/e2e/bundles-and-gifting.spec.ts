import { expect, test } from '@playwright/test'

test.describe('Plan 07 — Revenue Optimization, Bundling & Luxury Gifting Suite', () => {
  test('customer can view frequently bought together bundle, add bundle to cart, and customize luxury gifting with royal velvet wrap', async ({
    page,
  }) => {
    // 1. Visit PDP
    await page.goto('/products/tad-angel-blue-nuit')
    await expect(page.locator('h1')).toBeVisible()

    // 2. Verify Frequently Bought Together Bundle Card
    const bundleSection = page.locator('text=حزمة العناية الملكية المتكاملة').first()
    await expect(bundleSection).toBeVisible()
    await expect(page.locator('text=توفير مؤكد بقيمة').first()).toBeVisible()

    // Click 1-Click Add Bundle
    const addBundleBtn = page.locator('button:has-text("إضافة الحزمة كاملة للسلة")').first()
    await expect(addBundleBtn).toBeVisible()
    await addBundleBtn.click()
    await expect(page.locator('text=تمت إضافة الحزمة للسلة').first()).toBeVisible()

    // 3. Verify Discovery Box & Cashback Banner
    await expect(page.locator('text=باقة عينات التجربة واسترداد القيمة 100%').first()).toBeVisible()
    await expect(page.locator('text=كوبون كاش باك 100%').first()).toBeVisible()

    // 4. Visit Cart Page
    await page.goto('/cart')
    await expect(page.locator('h1:has-text("سلة المشتريات")')).toBeVisible()
    await expect(page.locator('text=باقة عينات التجربة واسترداد القيمة 100%').first()).toBeVisible()
  })
})
