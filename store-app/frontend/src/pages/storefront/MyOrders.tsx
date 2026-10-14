import { Link } from 'react-router-dom'

import { StageBadge } from '@/components/admin/StatusBadge'
import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import { usePageTitle } from '@/lib/usePageTitle'
import { useMyOrders } from '@/lib/queries/orders'

export default function MyOrders() {
  usePageTitle('طلباتي')
  const { data, isPending, isError, refetch } = useMyOrders()
  const { data: user } = useMe()

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
      {!user && orders.length > 0 && (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          هذه الطلبات التي أتممتها من هذا الجهاز.{' '}
          <Link to="/login?next=%2Fme%2Forders" className="font-semibold text-primary underline">سجّل الدخول</Link>{' '}
          لترى طلباتك من الأجهزة الأخرى.
        </p>
      )}
      {orders.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات بعد"
          description={
            user
              ? 'عند إتمام أول طلب سيظهر هنا مع حالته وتفاصيله.'
              : 'تظهر هنا الطلبات التي أتممتها من هذا الجهاز. إن طلبت من جهاز آخر فسجّل الدخول لترى طلباتك كلها.'
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-4">
              {!user && (
                <Link to="/login?next=%2Fme%2Forders" className="font-semibold text-primary underline">تسجيل الدخول</Link>
              )}
              <Link to="/products" className="font-semibold text-primary underline">تصفّح المنتجات</Link>
            </div>
          }
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
                  <StageBadge stage={order.stage} />
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
