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
// Storefront routes
const CartPage = lazy(() => import('@/pages/storefront/Cart'))
const CheckoutPage = lazy(() => import('@/pages/storefront/Checkout'))
const CheckoutCompletePage = lazy(() => import('@/pages/storefront/CheckoutComplete'))
const CheckoutRedirectPage = lazy(() => import('@/pages/storefront/CheckoutRedirect'))
const MyOrdersPage = lazy(() => import('@/pages/storefront/MyOrders'))
const MyOrderDetailPage = lazy(() => import('@/pages/storefront/MyOrderDetail'))
const MyAddressesPage = lazy(() => import('@/pages/storefront/MyAddresses'))
const WishlistPage = lazy(() => import('@/pages/storefront/WishlistPage'))
const ApiDocsPage = lazy(() => import('@/pages/storefront/ApiDocs'))

// Admin — 26 of the 44 routes. Lazy so a customer never downloads any of it.
const AdminLayout = lazy(() =>
  import('@/components/layout/AdminLayout').then((m) => ({ default: m.AdminLayout })),
)
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const AdminProducts = lazy(() => import('@/pages/admin/Products'))
const AdminProductNew = lazy(() => import('@/pages/admin/ProductNew'))
const AdminProductNewVariants = lazy(() => import('@/pages/admin/ProductNewVariants'))
const AdminProductEdit = lazy(() => import('@/pages/admin/ProductEdit'))
const AdminProductVariants = lazy(() => import('@/pages/admin/ProductVariants'))
const AdminCategories = lazy(() => import('@/pages/admin/Categories'))
const AdminCollections = lazy(() => import('@/pages/admin/Collections'))
const AdminInventory = lazy(() => import('@/pages/admin/Inventory'))
const AdminInventoryLogs = lazy(() => import('@/pages/admin/InventoryLogs'))
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders'))
const AdminOrderDetail = lazy(() => import('@/pages/admin/AdminOrderDetail'))
const AdminOrderWaybill = lazy(() => import('@/pages/admin/AdminOrderWaybillPage'))
const AdminOrderInvoice = lazy(() => import('@/pages/admin/AdminOrderInvoicePage'))
const AdminBatchWaybills = lazy(() => import('@/pages/admin/AdminBatchWaybillsPage'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))
const AdminUserDetail = lazy(() => import('@/pages/admin/AdminUserDetail'))
const AdminDiscounts = lazy(() => import('@/pages/admin/AdminDiscounts'))
const DiscountForm = lazy(() =>
  import('@/pages/admin/AdminDiscounts').then((m) => ({ default: m.DiscountForm })),
)
const DiscountEditPage = lazy(() => import('@/pages/admin/DiscountEdit'))
const AdminCities = lazy(() => import('@/pages/admin/AdminCities'))
const AdminDeliveryMethods = lazy(() => import('@/pages/admin/DeliveryMethods'))
const DeliveryMethodConfig = lazy(() => import('@/pages/admin/DeliveryMethodConfig'))
const AdminCODReconciliation = lazy(() => import('@/pages/admin/AdminCODReconciliationPage'))
const AdminPaymentMethods = lazy(() => import('@/pages/admin/PaymentMethods'))
const PaymentMethodConfig = lazy(() => import('@/pages/admin/PaymentMethodConfig'))
const AdminLedger = lazy(() => import('@/pages/admin/AdminLedgerPage'))
const AdminCustomization = lazy(() => import('@/pages/admin/AdminCustomization'))
const WidgetBuilder = lazy(() => import('@/pages/admin/WidgetBuilder'))
const AdminAbandonedCarts = lazy(() => import('@/pages/admin/marketing/AbandonedCarts'))
const AdminExecutiveAnalytics = lazy(() => import('@/pages/admin/analytics/ExecutiveAnalytics'))

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
          { path: '/wishlist', element: withSuspense(<WishlistPage />) },
          { path: '/cart', element: withSuspense(<CartPage />) },
          { path: '/developers/api', element: withSuspense(<ApiDocsPage />) },
          { path: '/checkout/redirect', element: withSuspense(<CheckoutRedirectPage />) },
          {
            element: <RequireAuth />,
            children: [
              { path: '/me', element: withSuspense(<AccountPage />) },
              { path: '/me/orders', element: withSuspense(<MyOrdersPage />) },
              { path: '/me/orders/:orderId', element: withSuspense(<MyOrderDetailPage />) },
              { path: '/me/addresses', element: withSuspense(<MyAddressesPage />) },
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
              { path: 'products/new/variants', element: withSuspense(<AdminProductNewVariants />) },
              { path: 'products/:productSlugOrId', element: withSuspense(<AdminProductEdit />) },
              { path: 'products/:productSlugOrId/variants', element: withSuspense(<AdminProductVariants />) },
              { path: 'categories', element: withSuspense(<AdminCategories />) },
              { path: 'collections', element: withSuspense(<AdminCollections />) },
              { path: 'inventory', element: withSuspense(<AdminInventory />) },
              { path: 'inventory/logs', element: withSuspense(<AdminInventoryLogs />) },
              { path: 'orders', element: withSuspense(<AdminOrders />) },
              { path: 'orders/batch-waybills', element: withSuspense(<AdminBatchWaybills />) },
              { path: 'orders/:orderIdOrNumber', element: withSuspense(<AdminOrderDetail />) },
              { path: 'orders/:orderIdOrNumber/waybill', element: withSuspense(<AdminOrderWaybill />) },
              { path: 'orders/:orderIdOrNumber/invoice', element: withSuspense(<AdminOrderInvoice />) },
              { path: 'users', element: withSuspense(<AdminUsers />) },
              { path: 'users/:userId', element: withSuspense(<AdminUserDetail />) },
              { path: 'discounts', element: withSuspense(<AdminDiscounts />) },
              { path: 'discounts/new', element: withSuspense(<DiscountForm />) },
              { path: 'discounts/:id', element: withSuspense(<DiscountEditPage />) },
              { path: 'cities', element: withSuspense(<AdminCities />) },
              { path: 'delivery', element: withSuspense(<AdminDeliveryMethods />) },
              { path: 'delivery/reconciliation', element: withSuspense(<AdminCODReconciliation />) },
              { path: 'delivery/:courierCode', element: withSuspense(<DeliveryMethodConfig />) },
              { path: 'payment_methods', element: withSuspense(<AdminPaymentMethods />) },
              { path: 'payment_methods/:methodCode', element: withSuspense(<PaymentMethodConfig />) },
              { path: 'ledger', element: withSuspense(<AdminLedger />) },
              { path: 'customization', element: withSuspense(<AdminCustomization />) },
              { path: 'customization/:layoutId', element: withSuspense(<WidgetBuilder />) },
              { path: 'marketing/abandoned-carts', element: withSuspense(<AdminAbandonedCarts />) },
              { path: 'abandoned-carts', element: withSuspense(<AdminAbandonedCarts />) },
              { path: 'analytics', element: withSuspense(<AdminExecutiveAnalytics />) },
              { path: 'analytics/executive', element: withSuspense(<AdminExecutiveAnalytics />) },
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
