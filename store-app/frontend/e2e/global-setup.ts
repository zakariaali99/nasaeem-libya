import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { request, type APIRequestContext } from '@playwright/test'

/**
 * Prepares authenticated storage states and a live-data fixture for the suite.
 *
 * Auth is performed THROUGH the app origin (the Vite proxy), not against Django
 * directly, so the session cookie is stored for `localhost:5183` and actually
 * travels with the browser's `/api` calls. Doing it against `127.0.0.1:8010`
 * would bind the cookie to the wrong host and every "logged in" test would 401.
 */

const here = dirname(fileURLToPath(import.meta.url))
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5183'
const AUTH_DIR = resolve(here, '.auth')

const CUSTOMER = { phone_number: '0915550001', password: 'E2ePass9xty', name: 'عميل اختبار' }
const OWNER = { phone_number: '0915550002', password: 'E2eOwner9xty', name: 'مالك اختبار' }

/** The CSRF cookie value currently held by a context. */
async function csrfToken(api: APIRequestContext): Promise<string> {
  await api.get('/api/auth/csrf/')
  const state = await api.storageState()
  const cookie = state.cookies.find((c) => c.name === 'csrftoken')
  if (!cookie) throw new Error('no csrftoken cookie after /api/auth/csrf/')
  return cookie.value
}

async function login(creds: { phone_number: string; password: string }, statePath: string) {
  const api = await request.newContext({ baseURL: BASE_URL })
  const csrf = await csrfToken(api)
  const res = await api.post('/api/auth/login/', {
    headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' },
    data: { phone_number: creds.phone_number, password: creds.password },
  })
  if (!res.ok()) {
    throw new Error(`login failed for ${creds.phone_number}: ${res.status()} ${await res.text()}`)
  }
  await api.storageState({ path: statePath })
  await api.dispose()
}

async function ensureCustomer() {
  const api = await request.newContext({ baseURL: BASE_URL })
  const csrf = await csrfToken(api)
  // Idempotent: register once; a 400 (already exists) is fine, we log in below.
  await api.post('/api/auth/register/', {
    headers: { 'X-CSRFToken': csrf, 'Content-Type': 'application/json' },
    data: CUSTOMER,
  })
  await api.dispose()
  await login(CUSTOMER, resolve(AUTH_DIR, 'customer.json'))
}

/** Upsert an owner with a known password so admin routes can be driven. */
function ensureOwnerAccount() {
  const py = [
    'from apps.core.models import User, Role',
    `u, _ = User.objects.get_or_create(phone_number='${OWNER.phone_number}', defaults={'name': '${OWNER.name}'})`,
    'u.role = Role.OWNER; u.is_staff = True; u.is_superuser = True; u.is_active = True',
    `u.set_password('${OWNER.password}'); u.save()`,
  ].join('\n')
  // Piped over stdin (not `-c`) so inner quotes in the script never collide with
  // the shell's own quoting.
  execSync('.venv/bin/python manage.py shell', {
    cwd: resolve(here, '..', '..', 'backend'),
    input: py,
    env: {
      ...process.env,
      DEBUG: 'True',
      SECRET_KEY: 'e2e-insecure-key',
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost/nasaim_dev',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
}

/** Pull real slugs so route specs never hardcode fixture data. */
async function captureLiveData() {
  const api = await request.newContext({ baseURL: BASE_URL })
  const products = await (await api.get('/api/products/?page_size=1')).json()
  const categories = await (await api.get('/api/categories/')).json()
  const collections = await (await api.get('/api/collections/')).json()
  await api.dispose()

  const firstSlug = (payload: unknown): string | null => {
    const list = (payload as { data?: Array<{ slug?: string; children?: unknown[] }> })?.data ?? []
    return list[0]?.slug ?? null
  }

  writeFileSync(
    resolve(AUTH_DIR, 'live-data.json'),
    JSON.stringify(
      {
        productSlug: firstSlug(products),
        categorySlug: firstSlug(categories),
        collectionSlug: firstSlug(collections),
      },
      null,
      2,
    ),
  )
}

export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true })
  ensureOwnerAccount()
  await ensureCustomer()
  await login(OWNER, resolve(AUTH_DIR, 'owner.json'))
  await captureLiveData()
}
