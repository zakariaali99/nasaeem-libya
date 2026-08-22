import { defineConfig, devices } from '@playwright/test'

/**
 * Phase 9 end-to-end gate (`09-phases.md`).
 *
 * Playwright is a build-time tool: it drives a headless Chromium against the
 * running app to assert touch-target sizes, no horizontal overflow, LTR-forced
 * layout integrity, that every route renders real data, and a keyboard-only
 * purchase journey. Nothing here serves production traffic — nginx does.
 *
 * Two web servers are started (and reused if already up): Django on :8010 for
 * the API + SEO shell, and the Vite dev server on :5183 which proxies /api and
 * /media to Django. The DB is the seeded dev database; run `seed_demo` first if
 * it is empty.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5183'
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost/nasaim_dev'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',

  use: {
    baseURL: BASE_URL,
    locale: 'ar-LY',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Mobile is the gate's viewport: touch targets and overflow are phone
  // concerns, and Lighthouse is measured on mobile.
  projects: [{ name: 'mobile', use: { ...devices['Pixel 5'] } }],

  webServer: [
    {
      command:
        `cd ../backend && env DEBUG=True SECRET_KEY=e2e-insecure-key ` +
        `DATABASE_URL='${DATABASE_URL}' .venv/bin/python manage.py runserver 127.0.0.1:8010 --noreload`,
      url: 'http://127.0.0.1:8010/api/health/',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run dev',
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
