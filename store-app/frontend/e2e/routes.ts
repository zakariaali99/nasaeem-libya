import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const AUTH = {
  customer: resolve(here, '.auth', 'customer.json'),
  owner: resolve(here, '.auth', 'owner.json'),
}

type LiveData = { productSlug: string | null; categorySlug: string | null; collectionSlug: string | null }

export function liveData(): LiveData {
  try {
    return JSON.parse(readFileSync(resolve(here, '.auth', 'live-data.json'), 'utf8'))
  } catch {
    return { productSlug: null, categorySlug: null, collectionSlug: null }
  }
}

/**
 * The 44 routes of `06-routes-and-pages.md`, plus the two Phase 8 customisation
 * screens. `access` decides which storage state drives the visit; `pending`
 * marks routes that belong to the paused Phase 6 (payments & delivery) work and
 * do not exist yet — the all-routes spec reports them as expected-pending rather
 * than pretending they pass.
 */
export type Access = 'public' | 'customer' | 'owner'

export interface RouteDef {
  n: number | string
  label: string
  path: string // may contain :param tokens resolved by the spec
  access: Access
  /** Needs a dynamic entity id fetched at runtime (order/user/layout/discount). */
  dynamic?: 'productSlug' | 'categorySlug' | 'collectionSlug' | 'orderId' | 'adminOrderId' | 'userId' | 'layoutId' | 'discountId'
  /** Paused Phase 6 screen — not built yet. */
  pending?: boolean
}

export const ROUTES: RouteDef[] = [
  // Storefront — 18
  { n: 1, label: 'Home', path: '/', access: 'public' },
  { n: 2, label: 'Catalogue', path: '/products', access: 'public' },
  { n: 3, label: 'Product detail', path: '/products/:productSlug', access: 'public', dynamic: 'productSlug' },
  { n: 4, label: 'Cart', path: '/cart', access: 'public' },
  { n: 5, label: 'Checkout', path: '/checkout/:orderId', access: 'customer', dynamic: 'orderId' },
  { n: 6, label: 'Order confirmed', path: '/checkout/complete', access: 'customer' },
  { n: 7, label: 'Gateway return', path: '/checkout/redirect', access: 'customer' },
  { n: 8, label: 'Login', path: '/login', access: 'public' },
  { n: 9, label: 'Register', path: '/register', access: 'public' },
  { n: 10, label: 'Forgot password', path: '/forgot-password', access: 'public' },
  { n: 11, label: 'Account', path: '/me', access: 'customer' },
  { n: 12, label: 'Order history', path: '/me/orders', access: 'customer' },
  { n: 13, label: 'Order detail', path: '/me/orders/:orderId', access: 'customer', dynamic: 'orderId' },
  { n: 14, label: 'Addresses', path: '/me/addresses', access: 'customer' },
  { n: 15, label: 'Category listing', path: '/categories/:slug', access: 'public', dynamic: 'categorySlug' },
  { n: 16, label: 'Collection listing', path: '/collections/:slug', access: 'public', dynamic: 'collectionSlug' },
  { n: 17, label: 'Search', path: '/search?q=%D8%B9%D9%88%D8%AF', access: 'public' },
  { n: 18, label: 'API docs', path: '/developers/api', access: 'public' },

  // Admin — 26
  { n: 19, label: 'Dashboard', path: '/admin', access: 'owner' },
  { n: 20, label: 'Product list', path: '/admin/products', access: 'owner' },
  { n: 21, label: 'Create product', path: '/admin/products/new', access: 'owner' },
  { n: 22, label: 'Variant matrix (new)', path: '/admin/products/new/variants', access: 'owner' },
  { n: 23, label: 'Edit product', path: '/admin/products/:productSlugOrId', access: 'owner', dynamic: 'productSlug' },
  { n: 24, label: 'Categories', path: '/admin/categories', access: 'owner' },
  { n: 25, label: 'Collections', path: '/admin/collections', access: 'owner' },
  { n: 26, label: 'Inventory', path: '/admin/inventory', access: 'owner' },
  { n: 27, label: 'Inventory logs', path: '/admin/inventory/logs', access: 'owner' },
  { n: 28, label: 'Order list', path: '/admin/orders', access: 'owner' },
  { n: 29, label: 'Order detail', path: '/admin/orders/:orderIdOrNumber', access: 'owner', dynamic: 'adminOrderId' },
  { n: 30, label: 'Customers', path: '/admin/users', access: 'owner' },
  { n: 31, label: 'Customer detail', path: '/admin/users/:userId', access: 'owner', dynamic: 'userId' },
  { n: 32, label: 'Discounts', path: '/admin/discounts', access: 'owner' },
  { n: 33, label: 'Create discount', path: '/admin/discounts/new', access: 'owner' },
  { n: 34, label: 'Edit discount', path: '/admin/discounts/:id', access: 'owner', dynamic: 'discountId' },
  { n: 35, label: 'Cities & regions', path: '/admin/cities', access: 'owner' },
  { n: 36, label: 'Courier overview', path: '/admin/delivery', access: 'owner' },
  { n: 37, label: 'Vanex config', path: '/admin/delivery/vanex', access: 'owner' },
  { n: 38, label: 'Nawres config', path: '/admin/delivery/nawres', access: 'owner' },
  { n: 39, label: 'Darb Sabeel config', path: '/admin/delivery/darb_sabeel', access: 'owner' },
  { n: 40, label: 'Gateway overview', path: '/admin/payment_methods', access: 'owner' },
  { n: 41, label: 'Moamalat config', path: '/admin/payment_methods/moamalat', access: 'owner' },
  { n: 42, label: 'Plutu config', path: '/admin/payment_methods/plutu', access: 'owner' },
  { n: 43, label: 'Binance Pay config', path: '/admin/payment_methods/binance_pay', access: 'owner' },
  { n: 44, label: 'Sadad Pay config', path: '/admin/payment_methods/sadad_pay', access: 'owner' },

  // Phase 8 customisation (beyond the original 44)
  { n: '8a', label: 'Customisation layouts', path: '/admin/customization', access: 'owner' },
  { n: '8b', label: 'Widget builder', path: '/admin/customization/:layoutId', access: 'owner', dynamic: 'layoutId' },
  { n: '8c', label: 'Abandoned carts recovery', path: '/admin/marketing/abandoned-carts', access: 'owner' },
  { n: '11', label: 'Executive analytics', path: '/admin/analytics', access: 'owner' },
]

/** Text that betrays an unbuilt page — the reference's placeholder crime. */
export const PLACEHOLDER_MARKERS = [
  'this page is now connected',
  'قريبا',
  'قريباً',
  'placeholder',
  'lorem ipsum',
  'coming soon',
  'todo',
  'غير متوفر بعد',
]
