import { ArrowUpRight, MapPin, MessageCircle, Phone, Printer } from 'lucide-react'
import { Link } from 'react-router-dom'

import { OrderStageSelect } from '@/components/admin/OrderStageSelect'
import { Button } from '@/components/ui/button'
import { LineThumb } from '@/components/ui/line-thumb'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, whatsappUrl } from '@/lib/format'
import { STAGE_BY_VALUE } from '@/lib/orderStages'
import { useOrder } from '@/lib/queries/orders'

/** An order at a glance, opened from its row without leaving the list. */
export function OrderQuickView({
  orderId,
  onOpenChange,
  onChanged,
}: {
  orderId: string | null
  onOpenChange: (open: boolean) => void
  onChanged?: (message: string) => void
}) {
  const { data: order, isPending } = useOrder(orderId ?? undefined)
  const phone = order?.user?.phone_number ?? ''
  const chat = phone ? whatsappUrl(phone) : null

  return (
    <Sheet open={Boolean(orderId)} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[92vw] max-w-md overflow-y-auto sm:max-w-md">
        {isPending || !order ? (
          <div className="space-y-4 pt-10" aria-busy="true">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-1 pe-12">
              <SheetTitle className="font-mono text-lg font-black">#{order.order_number}</SheetTitle>
              <SheetDescription>
                {new Date(order.created_at).toLocaleString('ar-LY', { dateStyle: 'medium', timeStyle: 'short' })}
              </SheetDescription>
            </div>

            <OrderStageSelect order={order} onChanged={(stage) => onChanged?.(`#${order.order_number}: ${STAGE_BY_VALUE[stage].label}`)} />

            <section className="space-y-2 rounded-xl border border-border p-4 text-sm">
              <p className="font-bold text-foreground">{order.user?.name || 'عميل المتجر'}</p>
              {phone ? (
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center gap-1.5 font-mono text-muted-foreground hover:text-primary">
                    <Phone className="size-4" aria-hidden="true" />
                    <bdi>{phone}</bdi>
                  </a>
                  {chat ? (
                    <a
                      href={chat}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 font-bold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                    >
                      <MessageCircle className="size-4" aria-hidden="true" /> واتساب
                    </a>
                  ) : null}
                </div>
              ) : null}
              {order.shipping_address ? (
                <p className="flex gap-1.5 text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>
                    {[order.city_name, order.region_name].filter(Boolean).join(' · ')}
                    {order.city_name || order.region_name ? ' — ' : ''}
                    {order.shipping_address}
                  </span>
                </p>
              ) : null}
            </section>

            <ul className="space-y-2.5">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <LineThumb image={item.image} alt={item.product_name} size={44} />
                    <span className="min-w-0">
                      <span className="line-clamp-1 font-bold">{item.product_name}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {item.variant_label ? `${item.variant_label} · ` : ''}×{item.quantity}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono font-bold">{formatPrice(item.total_price)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-1 border-t border-border pt-3 text-sm">
              {Number(order.shipping_total) > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>التوصيل</dt>
                  <dd className="font-mono">{formatPrice(order.shipping_total)}</dd>
                </div>
              ) : null}
              {Number(order.discount_total) > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <dt>الخصم</dt>
                  <dd className="font-mono">−{formatPrice(order.discount_total)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between text-base font-black">
                <dt>الإجمالي</dt>
                <dd className="font-mono text-price">{formatPrice(order.total)}</dd>
              </div>
            </dl>

            {order.customer_notes ? (
              <p className="rounded-lg bg-muted/40 p-3 text-sm">
                <span className="font-bold">ملاحظة العميل: </span>
                {order.customer_notes}
              </p>
            ) : null}
            {order.admin_notes ? (
              <p className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                <span className="font-bold">ملاحظات الإدارة: </span>
                {order.admin_notes}
              </p>
            ) : null}

            {order.stage_events?.length ? (
              <section className="space-y-2">
                <h3 className="text-sm font-bold">آخر التغييرات</h3>
                <ol className="space-y-1.5 text-xs text-muted-foreground">
                  {order.stage_events.slice(0, 3).map((event) => (
                    <li key={event.id}>
                      {STAGE_BY_VALUE[event.from_stage].label} ← {STAGE_BY_VALUE[event.to_stage].label}
                      {event.changed_by ? ` · ${event.changed_by}` : ''}
                      {' · '}
                      {new Date(event.created_at).toLocaleString('ar-LY', { dateStyle: 'short', timeStyle: 'short' })}
                      {event.note ? <span className="block text-foreground">«{event.note}»</span> : null}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button asChild className="gap-1.5">
                <Link to={`/admin/orders/${order.id}`}>
                  صفحة الطلب كاملة <ArrowUpRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="gap-1.5">
                <Link to={`/admin/orders/${order.id}/invoice`}>
                  <Printer className="size-4" aria-hidden="true" /> الفاتورة
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
