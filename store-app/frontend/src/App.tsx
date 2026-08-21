import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'

import { RouteErrorBoundary } from '@/components/ErrorBoundary'
import { RequireAuth } from '@/components/RequireAuth'
import { StorefrontLayout } from '@/components/layout/StorefrontLayout'
import CategoryListingPage from '@/pages/storefront/CategoryListing'
import CollectionListingPage from '@/pages/storefront/CollectionListing'
import HomePage from '@/pages/storefront/Home'
import ProductDetailPage from '@/pages/storefront/ProductDetail'
import ProductsPage from '@/pages/storefront/Products'
import SearchPage from '@/pages/storefront/Search'
import { ThemeProvider } from '@/lib/theme'

/**
 * The six storefront routes are imported statically, not lazily.
 *
 * Lazy chunks are only discovered once the entry chunk has run, which adds a
 * round trip on the customer's very first paint — measured as part of a 3.0 s
 * FCP on throttled mobile. They total ~15 kB gzipped and are preloaded with the
 * entry instead. The admin section — 26 of the 44 routes — stays lazy, which is
 * where code-splitting actually earns its keep.
 */

// Auth and admin stay lazy: the reference shipped one 528 kB chunk, and a
// customer must never download the operator's 26 screens.
const LoginPage = lazy(() => import('@/pages/auth/Login'))
const RegisterPage = lazy(() => import('@/pages/auth/Register'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword'))
const AccountPage = lazy(() => import('@/pages/storefront/Account'))
// Cart and checkout are lazy too: they are navigated TO, never the first paint
// whose LCP is being measured, and they pull in the delivery queries.
const CartPage = lazy(() => import('@/pages/storefront/Cart'))
const CheckoutPage = lazy(() => import('@/pages/storefront/Checkout'))
const CheckoutCompletePage = lazy(() => import('@/pages/storefront/CheckoutComplete'))

// Admin — 26 of the 44 routes. Lazy so a customer never downloads any of it.
const AdminLayout = lazy(() =>
  import('@/components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('@/pages/admin/Products'))
const AdminProductNew = lazy(() => import('@/pages/admin/ProductNew'))
const AdminProductEdit = lazy(() => import('@/pages/admin/ProductEdit'))
const AdminProductVariants = lazy(() => import('@/pages/admin/ProductVariants'))
const AdminCategories = lazy(() => import('@/pages/admin/Categories'))
const AdminCollections = lazy(() => import('@/pages/admin/Collections'))
const AdminInventory = lazy(() => import('@/pages/admin/Inventory'))
const AdminInventoryLogs = lazy(() => import('@/pages/admin/InventoryLogs'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

function RouteFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6" role="status" aria-live="polite">
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

function withSuspense(element: React.ReactNode) {
  return <Suspense fallback={<RouteFallback />}>{element}</Suspense>
}

const router = createBrowserRouter([
  {
    errorElement: <RouteErrorBoundary />,
    children: [
      // The storefront shell: header, footer and bottom navigation, shared by
      // every customer-facing route.
      {
        element: <StorefrontLayout />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/products', element: <ProductsPage /> },
          { path: '/products/:productSlug', element: <ProductDetailPage /> },
          { path: '/search', element: <SearchPage /> },
          { path: '/categories/:slug', element: <CategoryListingPage /> },
          { path: '/collections/:slug', element: <CollectionListingPage /> },
          { path: '/cart', element: withSuspense(<CartPage />) },
          {
            element: <RequireAuth />,
            children: [
              { path: '/me', element: withSuspense(<AccountPage />) },
              { path: '/checkout/complete', element: withSuspense(<CheckoutCompletePage />) },
              { path: '/checkout/:orderId', element: withSuspense(<CheckoutPage />) },
            ],
          },
        ],
      },
      { path: '/login', element: withSuspense(<LoginPage />) },
      { path: '/register', element: withSuspense(<RegisterPage />) },
      { path: '/forgot-password', element: withSuspense(<ForgotPasswordPage />) },
      {
        element: <RequireAuth admin />,
        children: [
          {
            path: '/admin',
            element: withSuspense(<AdminLayout />),
            children: [
              { index: true, element: withSuspense(<AdminDashboard />) },
              { path: 'products', element: withSuspense(<AdminProducts />) },
              { path: 'products/new', element: withSuspense(<AdminProductNew />) },
              { path: 'products/:productSlugOrId', element: withSuspense(<AdminProductEdit />) },
              { path: 'products/:productSlugOrId/variants', element: withSuspense(<AdminProductVariants />) },
              { path: 'categories', element: withSuspense(<AdminCategories />) },
              { path: 'collections', element: withSuspense(<AdminCollections />) },
              { path: 'inventory', element: withSuspense(<AdminInventory />) },
              { path: 'inventory/logs', element: withSuspense(<AdminInventoryLogs />) },
            ],
          },
        ],
      },
    ],
  },
])

export default function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}
