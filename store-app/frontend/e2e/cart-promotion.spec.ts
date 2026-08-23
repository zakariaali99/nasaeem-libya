import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Cart Free Shipping Promotion & Admin Management', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can configure cart free shipping promotion and see it in storefront', async ({ page }) => {
    // 1. Visit Admin Discounts page as owner
    await page.goto('/admin/discounts')
    await expect(page.locator('h1')).toContainText('كوبونات وعروض الخصم')

    // 2. Verify Cart Promotion Card is rendered
    const promoCard = page.locator('text=عرض السلة والشحن المجاني التلقائي')
    await expect(promoCard).toBeVisible()

    // 3. Verify threshold input and preview
    const minAmountInput = page.locator('input[type="number"][placeholder="200"]')
    await expect(minAmountInput).toBeVisible()

    // 4. Update threshold to 250 and save
    await minAmountInput.fill('250')
    await page.click('button:has-text("حفظ إعدادات العرض والشحن")')
    await expect(page.locator('text=تم حفظ وتحديث إعدادات العرض بنجاح!')).toBeVisible({ timeout: 5000 })

    // 5. Restore threshold back to 200 and save
    await minAmountInput.fill('200')
    await page.click('button:has-text("حفظ إعدادات العرض والشحن")')
    await expect(page.locator('text=تم حفظ وتحديث إعدادات العرض بنجاح!')).toBeVisible({ timeout: 5000 })

    // 6. Visit storefront home and open cart drawer
    await page.goto('/')
    await page.click('button[aria-label*="سلة"]')

    // 7. Verify Cart Drawer is open and free shipping meter is visible
    await expect(page.locator('text=سلة التسوق')).toBeVisible()
    await expect(page.locator('text=توصيل مجاني')).toBeVisible()
  })
})
