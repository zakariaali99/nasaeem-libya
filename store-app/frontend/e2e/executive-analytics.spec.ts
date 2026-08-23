import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 11 — Executive Analytics & Business Intelligence Suite', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can access executive analytics dashboard, view financial KPIs, Libyan city heatmap and brand profits', async ({
    page,
  }) => {
    // 1. Visit executive analytics dashboard
    await page.goto('/admin/analytics')
    await expect(page.locator('h1')).toContainText('التحليلات التنفيذية والذكاء التجاري')

    // 2. Verify key KPI sections are rendered
    await expect(page.locator('text=إجمالي المبيعات').first()).toBeVisible()
    await expect(page.locator('text=صافي الأرباح التقديرية').first()).toBeVisible()
    await expect(page.locator('text=التوزيع الجغرافي للمبيعات').first()).toBeVisible()
    await expect(page.locator('text=الماركات العطرية الأعلى ربحية').first()).toBeVisible()
    await expect(page.locator('text=كبار العملاء الأكثر إنفاقاً').first()).toBeVisible()

    // 3. Verify refresh button is functional
    const refreshBtn = page.locator('button:has-text("تحديث المؤشرات")').first()
    await expect(refreshBtn).toBeVisible()
    await refreshBtn.click()
  })
})
