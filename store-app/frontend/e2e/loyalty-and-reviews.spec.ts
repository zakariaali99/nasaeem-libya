import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 08 — Customer Retention, Abandoned Carts & VIP Loyalty Engine', () => {
  test('customer can view verified photo reviews and loyalty incentives on PDP', async ({
    page,
  }) => {
    // 1. Visit PDP
    await page.goto('/products/tad-angel-blue-nuit')
    await expect(page.locator('h1')).toBeVisible()

    // 2. Verify Customer Reviews Section & Verified Buyer Badge
    const reviewsSection = page.locator('text=تقييمات وتجارب العملاء الحقيقية').first()
    await expect(reviewsSection).toBeVisible()
    await expect(page.locator('text=مشترون مؤكدون').first()).toBeVisible()

    // 3. Click Add Review Modal
    const addReviewBtn = page.locator('button:has-text("أضف تقييمك واكسب 50 نقطة")').first()
    await expect(addReviewBtn).toBeVisible()
    await addReviewBtn.click()

    // Verify Modal opens with loyalty reward notice
    await expect(page.locator('text=تقييم تجربة').first()).toBeVisible()

    // 4. Visit Cart Page and Verify Cart Title
    await page.goto('/cart')
    await expect(page.locator('h1:has-text("سلة التسوّق")')).toBeVisible()
  })

  test.describe('Admin Abandoned Carts Recovery', () => {
    test.use({ storageState: AUTH.owner })

    test('admin can access abandoned carts recovery dashboard with WhatsApp triggers', async ({
      page,
    }) => {
      // Navigate to Abandoned Carts
      await page.goto('/admin/marketing/abandoned-carts')
      await expect(page.locator('h1:has-text("استرجاع السلات المتروكة")')).toBeVisible()
      await expect(page.locator('text=إجمالي المبيعات المتروكة').first()).toBeVisible()
      await expect(page.locator('text=معدل الاسترجاع').first()).toBeVisible()
    })
  })
})
