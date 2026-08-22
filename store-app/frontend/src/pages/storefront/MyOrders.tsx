import { Link } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useMyOrders } from '@/lib/queries/orders'



export default function MyOrders() {
  usePageTitle('طلباتي')
  const { data, isPending, isError, refetch } = useMyOrders()

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-3 px-4 py-8">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
      </div>
    )
  }
  if (isError) return <ErrorState onRetry={() => refetch()} />

  const orders = data?.items ?? []
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">طلباتي</h1>
      {orders.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات بعد"
          description="عند إتمام أول طلب سيظهر هنا مع حالته وتفاصيله."
          action={<Link to="/products" className="font-semibold text-primary underline">تصفّح المنتجات</Link>}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                to={`/me/orders/${order.id}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{order.order_number}</span>
                  <StatusBadge status={order.status} />
                </div>
                <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{new Date(order.created_at).toLocaleDateString('ar-LY')}</span>
                  <span className="font-semibold text-foreground">{formatPrice(order.total)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
