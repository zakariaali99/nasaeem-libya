import { Link, useParams } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { ErrorState } from '@/components/storefront/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useOrder } from '@/lib/queries/orders'

export default function MyOrderDetail() {
  const { orderId = '' } = useParams()
  usePageTitle('تفاصيل الطلب')
  const { data: order, isPending, isError, refetch } = useOrder(orderId)

  if (isPending) return <div className="mx-auto max-w-3xl px-4 py-8"><Skeleton className="h-64 w-full" /></div>
  if (isError || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorState onRetry={() => refetch()} />
        <p className="mt-4 text-center">
          <Link to="/me/orders" className="font-semibold text-primary underline">العودة إلى طلباتي</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{order.order_number}</h1>
        <StatusBadge status={order.status} />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">المنتجات</h2>
        <ul className="divide-y divide-border">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span>{item.product_name} × {item.quantity}</span>
              <span className="font-medium">{formatPrice(item.total_price)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-1 rounded-lg border border-border bg-card p-4 text-sm">
        <div className="flex justify-between"><span>المجموع الفرعي</span><span>{formatPrice(order.subtotal)}</span></div>
        {Number(order.discount_total) > 0 && (
          <div className="flex justify-between text-primary"><span>الخصم</span><span>−{formatPrice(order.discount_total)}</span></div>
        )}
        <div className="flex justify-between"><span>التوصيل</span><span>{formatPrice(order.shipping_total)}</span></div>
        <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
          <span>الإجمالي</span><span>{formatPrice(order.total)}</span>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 text-sm">
        <h2 className="mb-2 font-semibold">التوصيل</h2>
        <p className="text-muted-foreground">{order.shipping_address}</p>
        {order.tracking_number && (
          <p className="mt-2">رقم التتبع: <span className="font-mono font-semibold">{order.tracking_number}</span></p>
        )}
        <div className="mt-2 flex items-center gap-2">
          حالة الشحن: <StatusBadge status={order.shipping_status} />
        </div>
      </section>

      <Link to="/me/orders" className="block text-center text-sm font-semibold text-primary underline">
        العودة إلى طلباتي
      </Link>
    </div>
  )
}
