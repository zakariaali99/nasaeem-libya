import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, CheckCircle2, Clock, Copy, Package, Truck } from 'lucide-react'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { ErrorState } from '@/components/storefront/ErrorState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useOrder } from '@/lib/queries/orders'

export default function MyOrderDetail() {
  const { orderId = '' } = useParams()
  usePageTitle('تفاصيل الطلب')
  const { data: order, isPending, isError, refetch } = useOrder(orderId)
  const [copied, setCopied] = useState(false)

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <ErrorState onRetry={() => refetch()} />
        <p className="mt-4 text-center">
          <Link to="/me/orders" className="font-semibold text-primary underline">
            العودة إلى طلباتي
          </Link>
        </p>
      </div>
    )
  }

  // Calculate progress step
  const getStepStatus = () => {
    if (order.status === 'cancelled') return -1
    if (order.shipping_status === 'delivered' || order.status === 'completed') return 4
    if (order.shipping_status === 'shipped' || order.shipping_status === 'in_transit') return 3
    if (order.status === 'processing' || order.shipping_status === 'preparing') return 2
    return 1
  }

  const currentStep = getStepStatus()

  const steps = [
    { num: 1, label: 'تم تأكيد الطلب', icon: Clock },
    { num: 2, label: 'قيد التجهيز والتغليف', icon: Package },
    { num: 3, label: 'مع مندوب التوصيل', icon: Truck },
    { num: 4, label: 'تم التسليم بنجاح', icon: CheckCircle2 },
  ]

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
        <div>
          <span className="text-xs font-semibold text-muted-foreground">رقم الطلب</span>
          <h1 className="text-xl font-bold font-mono text-foreground sm:text-2xl">
            {order.order_number}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            بتاريخ {new Date(order.created_at).toLocaleDateString('ar-LY')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Visual Timeline (if not cancelled) */}
      {currentStep !== -1 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-sm font-bold text-foreground mb-6">مراحل تنفيذ وتوصيل الطلب</h2>
          <div className="grid grid-cols-4 gap-2 text-center relative">
            {/* Connecting line */}
            <div className="absolute top-4 start-8 end-8 h-1 bg-muted -z-0" />
            <div
              className="absolute top-4 start-8 h-1 bg-primary transition-all duration-500 -z-0"
              style={{ width: `${Math.min(100, Math.max(0, (currentStep - 1) * 33.33))}%` }}
            />

            {steps.map((s) => {
              const Icon = s.icon
              const isDone = currentStep >= s.num
              const isCurrent = currentStep === s.num

              return (
                <div key={s.num} className="flex flex-col items-center gap-2 relative z-10">
                  <div
                    className={`flex size-9 items-center justify-center rounded-full border-2 transition-all ${
                      isDone
                        ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                        : 'border-border bg-card text-muted-foreground'
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span
                    className={`text-[11px] leading-tight ${
                      isCurrent
                        ? 'font-bold text-primary'
                        : isDone
                        ? 'font-semibold text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Items Section */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs">
        <h2 className="mb-4 text-base font-bold text-foreground">المنتجات المطلوبة</h2>
        <ul className="divide-y divide-border/60">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <span className="font-semibold text-foreground">{item.product_name}</span>
                {item.variant_label && (
                  <span className="block text-xs text-muted-foreground">{item.variant_label}</span>
                )}
                <span className="text-xs text-muted-foreground">الكمية: {item.quantity}</span>
              </div>
              <span className="font-mono font-bold text-foreground">{formatPrice(item.total_price)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Financial Breakdown */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-2 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>المجموع الفرعي</span>
          <span className="font-mono">{formatPrice(order.subtotal)}</span>
        </div>
        {Number(order.discount_total) > 0 && (
          <div className="flex justify-between text-emerald-600 font-semibold">
            <span>الخصم المطبق</span>
            <span className="font-mono">−{formatPrice(order.discount_total)}</span>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <span>رسوم التوصيل</span>
          <span className="font-mono">{formatPrice(order.shipping_total)}</span>
        </div>
        <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
          <span>الإجمالي النهائي</span>
          <span className="font-mono text-primary text-lg">{formatPrice(order.total)}</span>
        </div>
      </section>

      {/* Shipping Address & Courier Tracking */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">بيانات التوصيل والشحنة</h2>
          <StatusBadge status={order.shipping_status} />
        </div>

        <p className="text-muted-foreground leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/50">
          {order.shipping_address || 'عنوان التوصيل المسجل مع الطلب'}
        </p>

        {order.tracking_number && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div>
              <span className="block text-xs font-semibold text-primary">رقم التتبع الخاص بالشحنة:</span>
              <span className="font-mono text-sm font-bold text-foreground">{order.tracking_number}</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleCopyTracking(order.tracking_number!)}
              className="text-xs"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ الرقم'}</span>
            </Button>
          </div>
        )}
      </section>

      <div className="pt-2 text-center">
        <Link
          to="/me/orders"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          ← العودة إلى قائمة طلباتي
        </Link>
      </div>
    </div>
  )
}
