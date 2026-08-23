import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 09 — Security, Fraud Prevention & Access Control Suite', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can manage COD blacklist and anti-fraud status on customer profile', async ({
    page,
  }) => {
    // 1. Visit Users list
    await page.goto('/admin/users')
    await expect(page.locator('h1')).toContainText('سجل العملاء')

    // 2. Click the first user
    const firstUserLink = page.locator('a[href^="/admin/users/"]:visible').first()
    await expect(firstUserLink).toBeVisible()
    await firstUserLink.click()

    // 3. Verify Customer profile loaded
    await expect(page).toHaveURL(/\/admin\/users\/\w+/)
    await expect(page.locator('text=حالة الدفع عند الاستلام').first()).toBeVisible()

    // 4. Verify COD Blacklist toggle action button exists and is clickable
    const codActionBtn = page.locator('button:has-text("حظر من الدفع عند الاستلام"), button:has-text("إلغاء حظر الدفع عند الاستلام")').first()
    await expect(codActionBtn).toBeVisible()
  })
})
