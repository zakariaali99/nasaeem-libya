import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 04 — Libyan Logistics, Courier Integrations & COD Reconciliation Suite', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can upload COD statement, analyze discrepancies, commit settlement and view order tracking timeline', async ({
    page,
  }) => {
    // 1. Navigate to COD Reconciliation Page
    await page.goto('/admin/delivery/reconciliation')
    await expect(page.locator('h1')).toContainText('مطابقة كشوفات التحصيل المالي للمندوبين')

    // 2. Load Sample CSV
    const sampleBtn = page.locator('button:has-text("نموذج تجريبي")')
    await expect(sampleBtn).toBeVisible()
    await sampleBtn.click()

    // 3. Trigger Analysis
    const analyzeBtn = page.locator('button:has-text("بدء الفحص والتدقيق الآلي")')
    await expect(analyzeBtn).toBeVisible()
    await analyzeBtn.click()

    // 4. Verify Analysis Results & Discrepancy Highlighting
    await expect(page.locator('text=بنود الشحنات والتحليل المقارن')).toBeVisible()
    await expect(page.locator('text=إجمالي الشحنات')).toBeVisible()
    await expect(page.locator('text=صافي الإيداع البنكي')).toBeVisible()

    // 5. Commit Reconciliation to Double-Entry Ledger
    const commitBtn = page.locator('button:has-text("اعتماد المطابقة وإيداع الأموال")')
    await expect(commitBtn).toBeVisible()
    await commitBtn.click()

    await expect(page.locator('text=تم اعتماد المطابقة وإيداع')).toBeVisible()
    await expect(page.locator('text=معتمد ومرحل مالياً')).toBeVisible()

    // 6. Switch to Archive History Tab
    const historyTab = page.locator('button:has-text("أرشيف الكشوفات")')
    await expect(historyTab).toBeVisible()
    await historyTab.click()

    await expect(page.locator('text=أرشيف كشوفات التحصيل المعتمدة')).toBeVisible()

    // 7. Verify Order Tracking Timeline on Order Detail Page
    await page.goto('/admin/orders')
    const firstOrderRow = page.locator('table tbody tr').first()
    if (await firstOrderRow.isVisible()) {
      await firstOrderRow.click()
      await expect(page.locator('text=تتبع الشحنة والربط المباشر')).toBeVisible()
    }
  })
})
