import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 02 — Thermal Waybills & Official Invoicing Suite', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can view thermal waybill, official A4 invoice and batch waybills', async ({ page }) => {
    // 1. Visit Admin Orders page
    await page.goto('/admin/orders')
    await expect(page.locator('h1')).toContainText('إدارة الطلبات والمبيعات')

    // 2. Click the first visible order link
    const firstOrderLink = page.locator('a[href^="/admin/orders/"]:visible').first()
    await expect(firstOrderLink).toBeVisible()
    await firstOrderLink.click()

    // 3. Verify Order detail page loaded
    await expect(page).toHaveURL(/\/admin\/orders\/\w+/)
    await expect(page.locator('h1')).toContainText('#2026')

    // 4. Click "بوليصة الشحن" button
    const waybillBtn = page.locator('a:has-text("بوليصة الشحن")').first()
    await expect(waybillBtn).toBeVisible()
    await waybillBtn.click()

    // 5. Verify Thermal Waybill page loaded
    await expect(page).toHaveURL(/\/admin\/orders\/\w+\/waybill/)
    await expect(page.locator('h1:has-text("نسائم ليبيا — عطور فاخرة")')).toBeVisible()
    await expect(page.locator('svg[aria-label^="باركود:"]')).toBeVisible()
    await expect(page.locator('text=المبلغ المطلوب تحصيله').or(page.locator('text=طلب مدفوع إلكترونياً'))).toBeVisible()
    await expect(page.locator('text=بضاعة قابلة للكسر')).toBeVisible()

    // 6. Switch format to 80mm roll
    const roll80Btn = page.locator('button:has-text("رول 80 ملم")')
    await roll80Btn.click()
    await expect(page.locator('.w-\\[80mm\\]')).toBeVisible()

    // 7. Go back and click "الفاتورة الرسمية (A4)"
    await page.goBack()
    const invoiceBtn = page.locator('a:has-text("الفاتورة الرسمية")').first()
    await expect(invoiceBtn).toBeVisible()
    await invoiceBtn.click()

    // 8. Verify Official A4 Invoice page loaded
    await expect(page).toHaveURL(/\/admin\/orders\/\w+\/invoice/)
    await expect(page.locator('h1:has-text("شركة نسائم ليبيا")')).toBeVisible()
    await expect(page.locator('text=فاتورة مبيعات رسمية')).toBeVisible()
    await expect(page.locator('text=ختم الضمان والأصالة العطرية')).toBeVisible()
    await expect(page.locator('svg[aria-label^="رمز QR:"]')).toBeVisible()
    await expect(page.locator('text=فقط').and(page.locator('text=لا غير'))).toBeVisible()

    // 9. Test direct navigation to Batch Waybills
    await page.goto('/admin/orders')
    const orderUrls = await page.$$eval('a[href^="/admin/orders/"]', (links) =>
      links.map((l) => (l as HTMLAnchorElement).pathname.split('/').pop()).filter(Boolean)
    )
    const firstTwo = orderUrls.slice(0, 2)
    if (firstTwo.length > 0) {
      await page.goto(`/admin/orders/batch-waybills?ids=${firstTwo.join(',')}`)
      await expect(page.locator('button:has-text("طباعة الكل")')).toBeVisible()
      await expect(page.locator('svg[aria-label^="باركود:"]').first()).toBeVisible()
    }
  })
})
