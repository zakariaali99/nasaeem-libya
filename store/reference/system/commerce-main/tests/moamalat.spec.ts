// @ts-nocheck
import { test, expect, Page } from '@playwright/test';

test.describe('Moamalat Lightbox error reproduction', () => {
  let consoleMessages: { type: string; text: string }[] = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('should login, add to cart, proceed to Moamalat and capture console error', async ({ page }) => {
    await page.goto('http://localhost:3000/login');

    // Login form fields (RTL layout)
    await page.fill('input[name="phone"]', '0912147419');
    await page.fill('input[name="password"]', '1122334466hB');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:3000/');

    // Scroll to first "أضف إلى السلة" button and click
    await page.waitForSelector('button:text("أضف إلى السلة")');
    const addBtn = await page.locator('button:text("أضف إلى السلة")').first();
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    // Open cart via top-left icon
    await page.click('a[href="/cart"]');
    await page.waitForURL('http://localhost:3000/cart');

    // Select first city and region
    await page.selectOption('select[name="city"]', { index: 1 });
    await page.waitForTimeout(500);
    await page.selectOption('select[name="region"]', { index: 1 });

    // Continue to payment
    await page.click('button:text("متابعة إلى الدفع")');
    await page.waitForURL('**/checkout/payment');

    // Choose Moamalat (second option) and click pay
    await page.check('input[type="radio"][value="MOAMALAT"]');
    await page.click('button:text("ادفع")');

    // Wait for potential lightbox error
    await page.waitForTimeout(2000);

    // Output captured console messages for debugging
    console.log('Captured console messages:', consoleMessages);
    expect(consoleMessages.some(msg => msg.type === 'error')).toBeTruthy();
  });
});
