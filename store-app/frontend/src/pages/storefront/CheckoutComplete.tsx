import { Building2, CheckCircle2, MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { OrderSummary } from '@/components/storefront/OrderSummary'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { useOrder } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'

export default function CheckoutCompletePage() {
  usePageTitle('تم استلام طلبك — نسائم ليبيا', 'شكراً لك — تم تسجيل طلبك بنجاح.')
  const [params] = useSearchParams()
  const reference = params.get('order') ?? ''
  const { data: order, isPending } = useOrder(reference || undefined)
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null)

  useEffect(() => {
    const link = sessionStorage.getItem('last_whatsapp_link')
    if (link) {
      setWhatsappLink(link)
    }
  }, [])

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 animate-fade-rise space-y-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-9" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold sm:text-3xl text-foreground">تم استلام طلبك بنجاح</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          شكراً لتسوّقك من نسائم ليبيا. يجري الآن مراجعة وتجهيز طلبك بعناية تامة.
        </p>
        {reference && (
          <div className="rounded-2xl border border-border bg-muted/40 px-4 py-2 text-xs sm:text-sm">
            رقم الطلب: <span className="font-bold font-mono text-primary text-base">#{reference}</span>
          </div>
        )}
      </div>

      {/* WhatsApp Quick Action Button */}
      {whatsappLink && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-sm">
            <MessageSquare className="size-4" />
            <span>تم توليد رسالة الفاتورة الخاصة بطلبك</span>
          </div>
          <p className="text-xs text-muted-foreground">
            انقر على الزر أدناه لمتابعة طلبك عبر واتساب وإرسال الإشعار فوراً:
          </p>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md transition-colors"
          >
            <MessageSquare className="size-4" />
            <span>فتح محادثة واتساب وإرسال الفاتورة</span>
          </a>
        </div>
      )}

      {/* Bank Transfer Details Card */}
      {order?.payment_method === 'bank_transfer' && (
        <div className="rounded-2xl border border-primary/20 bg-card p-5 space-y-3">
          <div className="flex items-center gap-2 text-primary font-bold text-sm border-b border-border pb-2">
            <Building2 className="size-4" />
            <span>بيانات الحساب المصرفي للتحويل</span>
          </div>
          <div className="grid gap-2 text-xs">
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">اسم المصرف:</span>
              <span className="font-bold text-foreground">المصرف التجاري الوطني / مصرف الجمهورية</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">اسم المستفيد:</span>
              <span className="font-bold text-foreground">شركة نسائم ليبيا للعطور</span>
            </div>
            <div className="flex justify-between border-b border-border/40 pb-1.5">
              <span className="text-muted-foreground">رقم الحساب:</span>
              <span className="font-mono font-bold text-primary text-sm">0123456789</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-muted-foreground">رقم الآيبان (IBAN):</span>
              <span className="font-mono font-bold text-primary text-xs" dir="ltr">LY88 0001 0123 4567 8901 2345</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground pt-1">
            💬 تم إرسال هذه البيانات بالإضافة إلى الفاتورة التفصيلية إلى هاتفك عبر واتساب تلقائياً.
          </p>
        </div>
      )}

      {isPending && reference ? (
        <Skeleton className="h-48 w-full rounded-2xl" />
      ) : order ? (
        <div className="space-y-4">
          <ul className="space-y-2.5 rounded-2xl border border-border bg-card p-4 text-xs sm:text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <span className="min-w-0">
                  <span className="font-bold text-foreground line-clamp-1">{item.product_name}</span>
                  <span className="text-muted-foreground font-mono">
                    {item.variant_label ? `${item.variant_label} · ` : ''}×{item.quantity}
                  </span>
                </span>
                <span className="shrink-0 font-mono font-bold text-price">{formatPrice(item.total_price)}</span>
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
            <p className="rounded-2xl border border-border bg-muted/40 p-4 text-xs">
              <span className="font-bold text-foreground">عنوان التوصيل:</span> {order.city_name} ·{' '}
              {order.region_name} — {order.shipping_address}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button asChild size="lg" className="rounded-xl">
          <Link to="/me/orders">متابعة طلباتي</Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="rounded-xl">
          <Link to="/products">مواصلة التسوّق</Link>
        </Button>
      </div>
    </div>
  )
}
