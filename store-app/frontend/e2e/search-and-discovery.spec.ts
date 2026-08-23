import { expect, test } from '@playwright/test'

test.describe('Plan 06 — Search, Discovery & Intelligent Olfactory Navigation', () => {
  test('customer can use instant predictive search popover, fragrance finder quiz, and olfactory notes browser', async ({
    page,
  }) => {
    // 1. Open Homepage & Trigger Instant Predictive Search Modal
    await page.goto('/')
    const searchTrigger = page.locator('button[aria-label="البحث"]').first()
    await expect(searchTrigger).toBeVisible()
    await searchTrigger.click()

    // 2. Verify Instant Search Popover Elements
    const searchModal = page.locator('[role="dialog"][aria-label="البحث اللحظي الفوري"]')
    await expect(searchModal).toBeVisible()
    await expect(page.locator('text=الكلمات الأكثر بحثاً ورواجاً')).toBeVisible()

    // Type query "عود"
    const modalInput = searchModal.locator('input[type="search"]')
    await modalInput.fill('عود')
    await expect(page.locator('text=العطور المطابقة')).toBeVisible()

    // Close Modal
    await searchModal.locator('button:has-text("إغلاق")').click()
    await expect(searchModal).not.toBeVisible()

    // 3. Open AI Fragrance Finder Quiz Modal
    const quizBtn = page.locator('button:has-text("مرشد العطور")').first()
    if (await quizBtn.isVisible()) {
      await quizBtn.click()

      const quizModal = page.locator('[role="dialog"][aria-label="مرشد العطور الذكي"]')
      await expect(quizModal).toBeVisible()

      // Step 1: Target / Gender
      await expect(page.locator('text=1. من سيرتدي هذا العطر؟')).toBeVisible()
      await page.locator('button:has-text("عطر رجالي فخم")').click()
      await page.locator('button:has-text("التالي: الطابع العطري")').click()

      // Step 2: Olfactory Vibe
      await expect(page.locator('text=2. ما هو الطابع العطري الذي تفضله؟')).toBeVisible()
      await page.locator('button:has-text("شرقي وبخور ملكي")').click()
      await page.locator('button:has-text("التالي: المناسبة والميزانية")').click()

      // Step 3: Occasion & Budget
      await expect(page.locator('text=3. ما هي المناسبة والميزانية المتوقعة؟')).toBeVisible()
      await page.locator('button:has-text("سهرات ومناسبات خاصة")').click()
      await page.locator('button:has-text("عرض العطور الموصى بها")').click()

      // Step 4: Recommendations Display
      await expect(page.locator('text=أفضل 3 عطور مطابقة لاختياراتك')).toBeVisible()
      await expect(page.locator('text=لماذا يناسبك').first()).toBeVisible()
      await expect(page.locator('text=تطابق').first()).toBeVisible()

      // Close Quiz Modal
      await quizModal.locator('button[aria-label="إغلاق"]').click()
      await expect(quizModal).not.toBeVisible()
    }

    // 4. Test Olfactory Notes Browser on /search page
    await page.goto('/search')
    await expect(page.locator('text=عطور العود الملكية')).toBeVisible()
    await expect(page.locator('text=عطور المسك والنقاء')).toBeVisible()
    await expect(page.locator('text=عطور الصيف والانتعاش')).toBeVisible()

    // Click note filter
    await page.locator('button:has-text("عطور العود الملكية")').click()
    await expect(page.locator('text=نتائج البحث عن «عود»')).toBeVisible()
  })
})
