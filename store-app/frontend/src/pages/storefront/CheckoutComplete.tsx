import { CheckCircle2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { OrderSummary } from '@/components/storefront/OrderSummary'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { useOrder } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'

export default function CheckoutCompletePage() {
  usePageTitle('تم استلام طلبك', 'شكراً لك — تم تسجيل طلبك بنجاح.')
  const [params] = useSearchParams()
  const reference = params.get('order') ?? ''
  const { data: order, isPending } = useOrder(reference || undefined)

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-9" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl">تم استلام طلبك</h1>
        <p className="text-muted-foreground">
          شكراً لك. سنتواصل معك لتأكيد التوصيل وتفاصيل الدفع.
        </p>
        {reference ? (
          <p className="text-base">
            رقم الطلب: <span className="font-bold tabular-nums">{reference}</span>
          </p>
        ) : null}
      </div>

      {isPending && reference ? (
        <Skeleton className="mt-8 h-48 w-full" />
      ) : order ? (
        <div className="mt-8 space-y-4">
          <ul className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="line-clamp-1">{item.product_name}</span>
                  <span className="text-muted-foreground">×{item.quantity}</span>
                </span>
                <span className="shrink-0 tabular-nums">{formatPrice(item.total_price)}</span>
              </li>
            ))}
          </ul>
          <OrderSummary
            subtotal={order.subtotal}
            discountTotal={order.discount_total}
            shippingTotal={order.shipping_total}
            total={order.total}
          />
          {order.shipping_address ? (
            <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
              <span className="font-medium">التوصيل إلى:</span> {order.city_name} ·{' '}
              {order.region_name} — {order.shipping_address}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg">
          <Link to="/me/orders">طلباتي</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/products">مواصلة التسوّق</Link>
        </Button>
      </div>
    </div>
  )
}
