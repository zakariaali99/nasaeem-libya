/*
 * Service worker — نسائم ليبيا.
 *
 * Built for Libyan mobile data: the shell, assets and fonts are downloaded
 * ONCE and served from the device forever after; data is always fresh.
 *
 * Rules:
 * - Cache-first: hashed build assets, fonts, brand art. Immutable by design —
 *   a new build changes the filenames, which invalidates the cache for free.
 * - Network-first with cache fallback: public catalog reads (categories,
 *   products, storefront layout) survive a dead connection with the last
 *   known data instead of a dinosaur page.
 * - NEVER cached: the money path. Cart, checkout, payments, orders, account —
 *   a stale price or a phantom cart is worse than an error page. These go to
 *   the network, always.
 */

const VERSION = 'v4'
const SHELL_CACHE = `shell-${VERSION}`
const ASSET_CACHE = `assets-${VERSION}`
const MEDIA_CACHE = `media-${VERSION}`
const DATA_CACHE = `data-${VERSION}`

const SHELL_URLS = ['/manifest.webmanifest', '/brand/logo.svg']
const MAX_MEDIA_ENTRIES = 150

// Money and personal state: network only, no exceptions.
const NEVER_CACHE = [
  '/api/cart',
  '/api/checkout',
  '/api/payments',
  '/api/orders',
  '/api/me',
  '/api/admin',
  '/api/auth',
  '/django-static',
]

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length > maxEntries) {
      await cache.delete(keys[0])
      trimCache(cacheName, maxEntries)
    }
  } catch {
    /* Cache trimming is opportunistic */
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => {
        /* Ignore partial preload failures */
      }),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![SHELL_CACHE, ASSET_CACHE, MEDIA_CACHE, DATA_CACHE].includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

const isMoneyPath = (url) =>
  NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix))

const isStaticAsset = (url) =>
  url.pathname.startsWith('/assets/') ||
  url.pathname.startsWith('/fonts/') ||
  url.pathname.startsWith('/brand/')

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // 1) The money path and everything personal: straight to the network.
  if (isMoneyPath(url)) return

  // 2) Hashed build assets, fonts, brand art: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
    return
  }

  // 3) Media images: stale-while-revalidate with max 150 items cache.
  if (url.pathname.startsWith('/media/')) {
    event.respondWith(
      caches.open(MEDIA_CACHE).then((cache) =>
        cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(request, networkResponse.clone())
                trimCache(MEDIA_CACHE, MAX_MEDIA_ENTRIES)
              }
              return networkResponse
            })
            .catch(() => cachedResponse)

          return cachedResponse || fetchPromise
        }),
      ),
    )
    return
  }

  // 4) Public API reads: network-first, fall back to the last known data.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(DATA_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() =>
          caches.match(request).then(
            (hit) =>
              hit ||
              new Response(
                JSON.stringify({ message: 'لا يوجد اتصال بالإنترنت' }),
                { status: 503, headers: { 'Content-Type': 'application/json' } },
              ),
          ),
        ),
    )
    return
  }

  // 5) Navigations: try the network first, fall back to cache only when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-cache' }).catch(() =>
        caches.match('/index.html').then((hit) => hit || caches.match('/')),
      ),
    )
  }
})
