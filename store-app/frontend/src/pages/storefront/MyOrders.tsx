import { Link } from '@/lib/i18nRouter'

import { StageBadge } from '@/components/admin/StatusBadge'
import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, formatShortDate } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import { usePageTitle } from '@/lib/usePageTitle'
import { useMyOrders } from '@/lib/queries/orders'
import { t } from '@/lib/i18n'

export default function MyOrders() {
  usePageTitle(t('orders.title'))
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
      <h1 className="mb-6 text-2xl font-bold">{t('orders.title')}</h1>
      {!user && orders.length > 0 && (
        <p className="mb-4 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          {t('orders.deviceNote')}{' '}
          <Link to="/track" className="font-semibold text-primary underline">{t('orders.trackByPhone')}</Link>.
        </p>
      )}
      {orders.length === 0 ? (
        <EmptyState
          title={t('orders.emptyTitle')}
          description={
            user
              ? t('orders.emptySignedIn')
              : t('orders.emptyGuest')
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-4">
              {!user && (
                <Link to="/track" className="font-semibold text-primary underline">{t('orders.trackByPhone')}</Link>
              )}
              <Link to="/products" className="font-semibold text-primary underline">{t('checkout.browseProducts')}</Link>
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
                  <span>{formatShortDate(order.created_at)}</span>
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
