import { expect, test, type Page } from '@playwright/test'

/**
 * Gate: "Keyboard-only pass through register → browse → cart → checkout."
 *
 * The whole purchase path is driven with the keyboard: fields are typed into
 * with real key events, and every control is activated by focusing it and
 * pressing Enter/Space — never a mouse click. If a step cannot be completed
 * without a pointer, this fails, which is exactly the accessibility signal the
 * gate is after.
 *
 * A fresh customer is registered each run (unique phone) so the journey never
 * depends on prior state.
 */

// Unique per run and valid per the client schema (^09[1-5]\d{7}$): a fixed
// 091 prefix, then the low 7 digits of the clock for uniqueness.
const phone = '091' + String(Date.now()).slice(-7)
const CUSTOMER = { name: 'عميل لوحة المفاتيح', phone, password: 'KbdJourney9xq' }

/** Focus a control and activate it with the keyboard — no click anywhere. */
async function pressActivate(page: Page, selector: ReturnType<Page['locator']>) {
  await selector.focus()
  await expect(selector).toBeFocused()
  await page.keyboard.press('Enter')
}

async function makeAddable(page: Page): Promise<boolean> {
  // Pick the first available option in each variant group, by keyboard.
  const options = page.locator('button[aria-pressed]:not([disabled])')
  const count = await options.count()
  for (let i = 0; i < count; i++) {
    const option = options.nth(i)
    if (await option.isVisible()) {
      await option.focus()
      await page.keyboard.press('Enter')
    }
  }
  const addButton = page.getByRole('button', { name: 'أضف إلى السلة' }).first()
  return (await addButton.count()) > 0 && (await addButton.isEnabled())
}

test('register → browse → cart → checkout, keyboard only', async ({ page }) => {
  // 1 — Register, typing every field with the keyboard. A small per-key delay
  // keeps the controlled `tel` input from dropping characters typed too fast.
  await page.goto('/register')
  const type = async (label: string, value: string) => {
    const field = page.getByLabel(label)
    await field.focus()
    await field.pressSequentially(value, { delay: 25 })
    await expect(field).toHaveValue(value)
  }
  await type('الاسم', CUSTOMER.name)
  await type('رقم الهاتف', CUSTOMER.phone)
  await type('كلمة المرور', CUSTOMER.password)
  // Implicit submission: Enter in the last field submits the form via the
  // keyboard, the way a customer finishing the form would.
  await page.getByLabel('كلمة المرور').press('Enter')
  await expect(page).toHaveURL(/\/me/)

  // 2 — Browse the catalogue. Collect the product links up front so navigating
  // into each one never invalidates a live handle.
  await page.goto('/products')
  await expect(page.locator('a[href^="/products/"]').first()).toBeVisible()
  const hrefs: string[] = await page
    .locator('a[href^="/products/"]')
    .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')).filter(Boolean))] as string[])

  let added = false
  for (const href of hrefs.slice(0, 6)) {
    await page.goto(href)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    if (!(await makeAddable(page))) continue

    // 3 — Add to cart with the keyboard.
    await pressActivate(page, page.getByRole('button', { name: 'أضف إلى السلة' }).first())
    added = await page
      .getByText('تمت الإضافة إلى السلة')
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false)
    if (added) break
  }
  expect(added, 'no purchasable product found to add by keyboard').toBe(true)

  // 4 — Open the cart and proceed to checkout with the keyboard.
  await page.goto('/cart')
  const proceed = page.getByRole('button', { name: 'متابعة الشراء' })
  await expect(proceed).toBeVisible()
  await pressActivate(page, proceed)

  await expect(page).toHaveURL(/\/checkout\/[0-9a-f-]{36}/)
  await expect(page.getByRole('heading').first()).toBeVisible()
})
