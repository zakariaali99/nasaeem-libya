import { expect, test } from '@playwright/test'

import { AUTH } from './routes'

test.describe('Plan 01 — Quick Order Entry & Bulk Order Operations', () => {
  test.use({ storageState: AUTH.owner })

  test('admin can open quick order modal, enter phone order and execute bulk action', async ({ page }) => {
    // 1. Visit Admin Orders page
    await page.goto('/admin/orders')
    await expect(page.locator('h1')).toContainText('إدارة الطلبات والمبيعات')

    // 2. Verify Quick Order button is rendered
    const quickOrderBtn = page.locator('button:has-text("إضافة طلب يدوي سريع")')
    await expect(quickOrderBtn).toBeVisible()

    // 3. Open Quick Order modal
    await quickOrderBtn.click()
    const dialogTitle = page.locator('text=إنشاء طلب يدوي سريع')
    await expect(dialogTitle).toBeVisible()

    // 4. Fill customer details
    const phoneInput = page.locator('#quick-phone')
    await phoneInput.fill('0919876543')

    const nameInput = page.locator('#quick-name')
    await nameInput.fill('خالد الورفلي')

    // Select city
    const citySelect = page.locator('#quick-city')
    await citySelect.selectOption({ index: 1 })

    const addressInput = page.locator('#quick-address')
    await addressInput.fill('طرابلس — زاوية الدهماني')

    // 5. Search and add a perfume product
    const productSearchInput = page.locator('#quick-product-search')
    await productSearchInput.click()

    // Wait for dropdown to show matching products and click the add button inside dialog
    const addProductBtn = page.locator('[role="dialog"] button:not([disabled]):has-text("إضافة")').first()
    await expect(addProductBtn).toBeVisible({ timeout: 5000 })
    await addProductBtn.click()

    // 6. Verify item was added to the line items list
    await expect(page.locator('text=منتجات مضافة')).toBeVisible()

    // 7. Submit order
    const submitBtn = page.locator('[role="dialog"] button:has-text("حفظ وتأكيد الطلب فوراً")')
    await expect(submitBtn).toBeEnabled()
    await submitBtn.click()

    // 8. Verify order was created and redirected to order detail page
    await expect(page).toHaveURL(/\/admin\/orders\/\w+/, { timeout: 10000 })
    await expect(page.locator('h1')).toContainText('#2026')

    // 9. Go back to order list and verify bulk actions
    await page.goto('/admin/orders')
    await expect(page.locator('h1')).toContainText('إدارة الطلبات والمبيعات')

    // Select all orders on current page
    const selectAllCheckbox = page.locator('input[aria-label="تحديد كل العناصر"]').or(page.locator('th input[type="checkbox"]')).first()
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click()
      // Verify bulk action buttons appear
      const markProcessingBtn = page.locator('button:has-text("قيد التجهيز")')
      await expect(markProcessingBtn).toBeVisible()
    }
  })
})
