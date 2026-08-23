import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 03 — Payments Reconciliation, 1-Click Refunds & Financial Ledger Suite', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can view double-entry ledger, run reconciliation daemon and settle courier remittance', async ({
    page,
  }) => {
    // 1. Navigate to Financial Ledger Page
    await page.goto('/admin/ledger')
    await expect(page.locator('h1')).toContainText('دفتر الأستاذ المالي')

    // 2. Verify Key Financial Position Metric Cards
    await expect(page.locator('text=كاش معلق عند شركات الشحن')).toBeVisible()
    await expect(page.locator('text=مستحقات بوابات الدفع الإلكتروني')).toBeVisible()
    await expect(page.locator('text=رصيد الحساب المصرفي الرئيسي')).toBeVisible()
    await expect(page.locator('text=صافي الأرباح المحققة')).toBeVisible()

    // 3. Trigger Payment Reconciliation Daemon
    const reconcileBtn = page.locator('button:has-text("تشغيل المطابقة الآلية")')
    await expect(reconcileBtn).toBeVisible()
    await reconcileBtn.click()
    await expect(page.locator('text=تم فحص')).toBeVisible()

    // 4. Open and Submit Courier Remittance Settlement Modal
    const settleBtn = page.locator('button:has-text("تسوية نقدية مندوب")')
    await expect(settleBtn).toBeVisible()
    await settleBtn.click()

    await expect(page.locator('h2:has-text("تسوية نقدية مندوب")')).toBeVisible()

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/admin/ledger/settle-courier/') && r.status() === 200),
      page.locator('button:has-text("تأكيد وترحيل التسوية")').click(),
    ])

    await expect(page.locator('text=تم تسجيل تسوية وإيداع')).toBeVisible({ timeout: 10000 })

    // 5. Verify Double-Entry Transactions Table
    await expect(page.locator('text=سجل القيود المحاسبية المزدوجة')).toBeVisible()
  })
})
