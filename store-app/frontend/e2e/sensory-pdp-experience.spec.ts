import { expect, test } from '@playwright/test'

test.describe('Plan 05 — Sensory Fragrance Storefront & Luxury PDP Experience', () => {
  test('customer sees interactive olfactory pyramid, sensory performance radar, social proof and trust badges on PDP', async ({
    page,
  }) => {
    // 1. Open Product Page
    await page.goto('/products/estiara-stag-white')
    await expect(page.locator('h1')).toBeVisible()

    // 2. Verify Live Social Proof & Trust Badges
    await expect(page.locator('text=يشاهد هذا العطر الآن')).toBeVisible()
    await expect(page.locator('text=أصلي ومضمون 100%')).toBeVisible()
    await expect(page.locator('text=توصيل سريع 24-48 ساعة')).toBeVisible()

    // 3. Verify Olfactory Pyramid
    await expect(page.locator('text=الهرم العطري الملكي')).toBeVisible()
    await expect(page.locator('text=قمة العطر (Top Notes)')).toBeVisible()
    await expect(page.locator('text=قلب العطر (Heart Notes)')).toBeVisible()
    await expect(page.locator('text=قاعدة العطر (Base Notes)')).toBeVisible()

    // 4. Click a Note in the Pyramid to View Description
    const noteBtn = page.locator('button:has-text("البرغموت الإيطالي")').first()
    if (await noteBtn.isVisible()) {
      await noteBtn.click()
      await expect(page.locator('text=افتتاحية منعشة وحيوية')).toBeVisible()
    }

    // 5. Verify Sensory Performance Radar
    await expect(page.locator('text=مؤشرات الأداء الحسي والثبات')).toBeVisible()
    await expect(page.locator('text=الثبات والدوام (Longevity)')).toBeVisible()
    await expect(page.locator('text=قوة الفوحان (Sillage)')).toBeVisible()
    await expect(page.locator('text=تركيز العطر:')).toBeVisible()
  })
})
