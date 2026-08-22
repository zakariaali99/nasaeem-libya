import { Link, useParams } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { useOrder, useUpdateOrder } from '@/lib/queries/orders'

const NEXT_STATUSES: Record<string, { value: string; label: string }[]> = {
  pending: [
    { value: 'processing', label: 'بدء المعالجة' },
    { value: 'cancelled', label: 'إلغاء الطلب' },
  ],
  processing: [
    { value: 'completed', label: 'إكمال الطلب' },
    { value: 'cancelled', label: 'إلغاء الطلب' },
  ],
  completed: [{ value: 'refunded', label: 'استرجاع' }],
}

const SHIPPING_NEXT: Record<string, { value: string; label: string }[]> = {
  pending: [{ value: 'accepted', label: 'قبول الشحن' }],
  accepted: [{ value: 'delivered', label: 'تم التوصيل' }],
  delivered: [{ value: 'returned', label: 'إرجاع' }],
}

export default function AdminOrderDetail() {
  const { orderIdOrNumber = '' } = useParams()
  const { data: order, isPending } = useOrder(orderIdOrNumber)
  const update = useUpdateOrder(orderIdOrNumber)

  if (isPending) return <Skeleton className="h-72 w-full" />
  if (!order) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        الطلب غير موجود.{' '}
        <Link to="/admin/orders" className="text-primary underline">العودة إلى القائمة</Link>
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {order.user?.name} · {order.user?.phone_number}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">المنتجات</h2>
        <ul className="divide-y divide-border text-sm">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex justify-between py-2">
              <span>{item.product_name} × {item.quantity}</span>
              <span>{formatPrice(item.total_price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-border pt-3 font-bold">
          <span>الإجمالي</span><span>{formatPrice(order.total)}</span>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">حالة الطلب</h2>
          <div className="flex flex-wrap gap-2">
            {(NEXT_STATUSES[order.status] ?? []).map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant={option.value === 'cancelled' || option.value === 'refunded' ? 'outline' : 'default'}
                loading={update.isPending}
                onClick={() => update.mutate({ status: option.value })}
              >
                {option.label}
              </Button>
            ))}
            {(NEXT_STATUSES[order.status] ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">لا توجد انتقالات متاحة</p>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">الشحن</h2>
          <div className="flex items-center gap-2"><StatusBadge status={order.shipping_status} /></div>
          <div className="flex flex-wrap gap-2">
            {(SHIPPING_NEXT[order.shipping_status] ?? []).map((option) => (
              <Button
                key={option.value}
                size="sm"
                variant="outline"
                loading={update.isPending}
                onClick={() => update.mutate({ shipping_status: option.value })}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <input
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            placeholder="رقم التتبع"
            defaultValue={order.tracking_number}
            onBlur={(event) => {
              if (event.target.value !== order.tracking_number) {
                update.mutate({ tracking_number: event.target.value })
              }
            }}
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 text-sm">
        <h2 className="mb-2 font-semibold">التوصيل</h2>
        <p className="text-muted-foreground">{order.shipping_address}</p>
        {order.customer_notes && <p className="mt-2">ملاحظات العميل: {order.customer_notes}</p>}
      </section>

      <Link to="/admin/orders" className="block text-sm font-semibold text-primary underline">العودة إلى القائمة</Link>
    </div>
  )
}
