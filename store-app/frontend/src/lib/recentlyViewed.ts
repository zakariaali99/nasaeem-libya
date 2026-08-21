/**
 * Recently-viewed product ids, held on the device.
 *
 * There is no server-side view-tracking table: the analytics tables that
 * powered this in the reference are out of scope per `00-mission.md`. The ids
 * are sent to `GET /api/storefront/layout/?recent=…` and the server hydrates
 * them into products — so the widget shows real products without the store
 * keeping a browsing log of every visitor.
 */

const KEY = 'nasaim:recently-viewed'
const LIMIT = 24

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : []
  } catch {
    // A private-mode browser, a full quota, or a corrupted value must not take
    // the homepage down with it.
    return []
  }
}

export function recentlyViewed(): string[] {
  return read().slice(0, LIMIT)
}

export function rememberViewed(productId: string): void {
  if (!productId) return
  try {
    const next = [productId, ...read().filter((id) => id !== productId)].slice(0, LIMIT)
    window.localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* nothing to do: this is a nicety, not a feature the store depends on */
  }
}
