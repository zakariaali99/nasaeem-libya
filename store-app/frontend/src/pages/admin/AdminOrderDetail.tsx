import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Printer,
  RotateCcw,
  Truck,
  User,
  XCircle,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatPrice } from '@/lib/format'
import { useOrder, useUpdateOrder } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'pending', label: 'استلام الطلب', icon: Clock },
  { id: 'processing', label: 'قيد التجهيز', icon: Package },
  { id: 'accepted', label: 'مع المندوب / الشحن', icon: Truck },
  { id: 'completed', label: 'تم التسليم بنجاح', icon: CheckCircle2 },
]

export default function AdminOrderDetail() {
  const { orderIdOrNumber = '' } = useParams()
  const { data: order, isPending } = useOrder(orderIdOrNumber)
  const update = useUpdateOrder(orderIdOrNumber)
  const [copied, setCopied] = useState(false)

  usePageTitle(order ? `الطلب #${order.order_number} — لوحة التحكم` : 'تفاصيل الطلب')

  if (isPending) {
    return (
      <div className="space-y-6 animate-fade-rise">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 lg:col-span-2 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-xl text-center py-16 space-y-4">
        <AlertCircle className="size-12 text-destructive mx-auto" />
        <h2 className="text-xl font-bold text-foreground">الطلب غير موجود</h2>
        <p className="text-xs text-muted-foreground">ربما تم حذف الطلب أو أن رقم الطلب غير صحيح.</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/admin/orders">العودة لقائمة الطلبات</Link>
        </Button>
      </div>
    )
  }

  const copyOrderNumber = () => {
    navigator.clipboard.writeText(order.order_number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  const phoneNumber = order.user?.phone_number || ''
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('0') ? '218' + cleanPhone.slice(1) : cleanPhone}?text=${encodeURIComponent(
        `مرحباً ${order.user?.name || 'عميلنا العزيز'}، بخصوص طلبك رقم #${order.order_number} من متجر نسائم ليبيا للعطور...`,
      )}`
    : null

  // Determine current active step index
  const currentStepIndex =
    order.status === 'completed'
      ? 3
      : order.shipping_status === 'accepted' || order.shipping_status === 'delivered'
      ? 2
      : order.status === 'processing'
      ? 1
      : 0

  return (
    <div className="space-y-6 animate-fade-rise print:m-0 print:p-0">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/orders"
              className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="العودة للطلبات"
            >
              <ArrowLeft className="size-4 rtl:rotate-0" />
            </Link>
            <h1 className="font-mono text-2xl sm:text-3xl font-black text-foreground">
              #{order.order_number}
            </h1>
            <button
              type="button"
              onClick={copyOrderNumber}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title={copied ? 'تم النسخ!' : 'نسخ رقم الطلب'}
            >
              <Copy className="size-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            تاريخ الإنشاء: {formatDateTime(order.created_at)}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {whatsappUrl && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1.5 h-10 px-3.5 shadow-2xs"
            >
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" />
                <span>واتساب العميل</span>
              </a>
            </Button>
          )}

          {phoneNumber && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs"
            >
              <a href={`tel:${phoneNumber}`}>
                <Phone className="size-4 text-primary" />
                <span>اتصال</span>
              </a>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs"
          >
            <Printer className="size-4" />
            <span>طباعة الفاتورة</span>
          </Button>
        </div>
      </div>

      {/* Visual Order Lifecycle Stepper */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs print:hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STEPS.map((step, idx) => {
            const Icon = step.icon
            const isPassed = idx <= currentStepIndex && order.status !== 'cancelled'
            const isCurrent = idx === currentStepIndex && order.status !== 'cancelled'
            return (
              <div key={step.id} className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-2xl border transition-all',
                    isCurrent
                      ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : isPassed
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-border bg-muted/40 text-muted-foreground',
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <span className={cn('block text-xs font-bold truncate', isCurrent ? 'text-primary' : 'text-foreground')}>
                    {step.label}
                  </span>
                  <span className="block text-[10px] text-muted-foreground font-mono">
                    الخطوة {idx + 1}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Order Content Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Order Items & Quick Status Action Bar */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items Table Card */}
          <div className="rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
            <div className="border-b border-border p-5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Package className="size-5 text-primary" />
                <h3 className="font-bold text-sm sm:text-base text-foreground">الأصناف والمنتجات المطلوبة</h3>
              </div>
              <span className="font-mono text-xs font-bold bg-muted px-3 py-1 rounded-full text-foreground">
                {order.items?.length ?? 0} أصناف
              </span>
            </div>

            <div className="divide-y divide-border">
              {(order.items ?? []).map((item) => (
                <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted/40 border border-border p-1">
                      <Package className="size-6 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">{item.product_name}</h4>
                      {item.variant_label && (
                        <p className="text-xs text-muted-foreground font-medium">{item.variant_label}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        الكمية: <span className="font-bold text-foreground">{item.quantity}</span> × {formatPrice(item.unit_price)}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono font-extrabold text-sm sm:text-base text-price shrink-0">
                    {formatPrice(item.total_price)}
                  </span>
                </div>
              ))}
            </div>

            {/* Financial Totals Strip */}
            <div className="border-t border-border bg-muted/20 p-5 space-y-2 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>المجموع الفرعي للمنتجات:</span>
                <span className="font-mono font-semibold text-foreground">{formatPrice(order.subtotal)}</span>
              </div>
              {Number(order.discount_total) > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono">-{formatPrice(order.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>رسوم التوصيل والشحن:</span>
                <span className="font-mono font-semibold text-foreground">{formatPrice(order.shipping_total)}</span>
              </div>
              <div className="flex justify-between border-t border-border/80 pt-2 text-sm font-extrabold text-foreground">
                <span>المبلغ الإجمالي النهائي:</span>
                <span className="font-mono text-base text-price">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Operational Status Workflow Manager */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4 print:hidden">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm sm:text-base text-foreground">الإجراءات والتحويلات التشغيلية</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">الحالة الحالية:</span>
                <StatusBadge status={order.status} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                نقل حالة الطلب التشغيلية مباشرة مع تحديث سجل الحركات:
              </p>

              <div className="flex flex-wrap gap-2.5">
                {order.status === 'pending' && (
                  <Button
                    loading={update.isPending}
                    onClick={() => update.mutate({ status: 'processing' })}
                    className="rounded-xl text-xs font-bold h-10 px-5 gap-1.5 shadow-sm"
                  >
                    <Package className="size-4" />
                    <span>بدء التجهيز والمعالجة</span>
                  </Button>
                )}

                {order.status === 'processing' && (
                  <Button
                    loading={update.isPending}
                    onClick={() => update.mutate({ status: 'completed' })}
                    className="rounded-xl text-xs font-bold h-10 px-5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  >
                    <CheckCircle2 className="size-4" />
                    <span>تأكيد إكمال وتسليم الطلب</span>
                  </Button>
                )}

                {order.status !== 'cancelled' && order.status !== 'completed' && (
                  <Button
                    variant="outline"
                    loading={update.isPending}
                    onClick={() => update.mutate({ status: 'cancelled' })}
                    className="rounded-xl text-xs font-bold h-10 px-4 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                  >
                    <XCircle className="size-4" />
                    <span>إلغاء الطلب</span>
                  </Button>
                )}

                {order.status === 'completed' && (
                  <Button
                    variant="outline"
                    loading={update.isPending}
                    onClick={() => update.mutate({ status: 'refunded' })}
                    className="rounded-xl text-xs font-bold h-10 px-4 gap-1.5"
                  >
                    <RotateCcw className="size-4" />
                    <span>تسجيل استرجاع (Refund)</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Shipping Status Workflow */}
            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">حالة الشحن والتوصيل:</span>
                <StatusBadge status={order.shipping_status} />
              </div>

              <div className="flex flex-wrap gap-2.5">
                {order.shipping_status === 'pending' && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={update.isPending}
                    onClick={() => update.mutate({ shipping_status: 'accepted' })}
                    className="rounded-xl text-xs font-bold h-9 px-4 gap-1.5 border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20"
                  >
                    <Truck className="size-3.5" />
                    <span>تسليم للمندوب / الشحن</span>
                  </Button>
                )}

                {order.shipping_status === 'accepted' && (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={update.isPending}
                    onClick={() => update.mutate({ shipping_status: 'delivered' })}
                    className="rounded-xl text-xs font-bold h-9 px-4 gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>تم التوصيل للعميل</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Customer Card & Shipping Details */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Customer Profile Card */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <User className="size-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">بيانات العميل</h3>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm border border-primary/20">
                  {order.user?.name ? order.user.name.charAt(0) : <User className="size-4" />}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{order.user?.name || 'عميل مسجل'}</p>
                  <p className="font-mono text-xs text-muted-foreground">{order.user?.phone_number || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Address & Notes Card */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <MapPin className="size-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">عنوان ومكان التوصيل</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground block mb-0.5">المدينة والمنطقة:</span>
                <p className="font-bold text-foreground text-sm">
                  {order.shipping_city || order.shipping_region || 'مصراتة — ليبيا'}
                </p>
              </div>

              <div>
                <span className="text-muted-foreground block mb-0.5">العنوان التفصيلي:</span>
                <p className="font-medium text-foreground bg-muted/30 p-2.5 rounded-xl border border-border">
                  {order.shipping_address || 'العنوان المسجل لدى المتجر'}
                </p>
              </div>

              {order.customer_notes && (
                <div>
                  <span className="text-muted-foreground block mb-0.5">ملاحظات العميل:</span>
                  <p className="font-medium text-foreground bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/30 text-amber-900 dark:text-amber-200">
                    {order.customer_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Card */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <CreditCard className="size-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">طريقة وحالة الدفع</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">طريقة الدفع:</span>
                <Badge tone="neutral" className="font-semibold text-xs">
                  {order.payment_method || 'دفع عند الاستلام'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">حالة السداد:</span>
                <StatusBadge status={order.payment_status || 'unpaid'} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
