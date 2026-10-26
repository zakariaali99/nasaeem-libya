import {
  AlertCircle,
  ArrowLeft,
  Copy,
  CreditCard,
  ExternalLink,
  MapPin,
  MessageCircle,
  Package,
  Pencil,
  Phone,
  Printer,
  RotateCcw,
  ShieldCheck,
  User,
  Gift,
  History,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { CustomerDrawer } from '@/components/admin/CustomerDrawer'
import { OrderEditDialog } from '@/components/admin/OrderEditDialog'
import { OrderStageSelect } from '@/components/admin/OrderStageSelect'
import { OrderTrackingTimeline } from '@/components/admin/OrderTrackingTimeline'
import { RefundModal } from '@/components/admin/RefundModal'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LineThumb } from '@/components/ui/line-thumb'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { FEATURES } from '@/lib/features'
import { formatDateTime, formatPrice } from '@/lib/format'
import { describeEffect, NEXT_STAGE, STAGE_BY_VALUE } from '@/lib/orderStages'
import { useChangeStage, useOrder, useUpdateOrder } from '@/lib/queries/orders'
import { useVerifyPayment } from '@/lib/queries/payments'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

/** Cash at the door: given back by moving the order to "returned", never by a refund. */
const PAY_ON_DELIVERY = new Set(['', 'manual_payment', 'cod', 'cash_on_delivery', 'bank_cards_on_delivery'])

/** The stored payment codes, in the words the checkout shows the customer. */
const PAYMENT_LABELS: Record<string, string> = {
  '': 'الدفع عند الاستلام',
  manual_payment: 'الدفع عند الاستلام',
  cod: 'الدفع عند الاستلام',
  cash_on_delivery: 'الدفع عند الاستلام',
  bank_transfer: 'تحويل مصرفي',
  bank: 'تحويل مصرفي',
}

export default function AdminOrderDetail() {
  const { orderIdOrNumber = '' } = useParams()
  const { data: order, isPending } = useOrder(orderIdOrNumber)
  const update = useUpdateOrder(orderIdOrNumber)
  const verifyPayment = useVerifyPayment(orderIdOrNumber)
  const [copied, setCopied] = useState(false)
  const [copiedTracking, setCopiedTracking] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [notesDraft, setNotesDraft] = useState<string | null>(null)
  const [stageMessage, setStageMessage] = useState<string | null>(null)
  const change = useChangeStage(order?.id ?? '')

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

  const phoneNumber = order.user?.phone_number || ''
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
  // Opens the customer's chat with an empty box: the operator writes their own
  // message (owner's request — no pre-written text).
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.startsWith('0') ? '218' + cleanPhone.slice(1) : cleanPhone}`
    : null

  const next = NEXT_STAGE[order.stage] ? STAGE_BY_VALUE[NEXT_STAGE[order.stage]!] : null

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
          {order.editable && (
            <Button
              size="sm"
              onClick={() => setEditOpen(true)}
              className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs"
            >
              <Pencil className="size-4" />
              <span>تعديل الطلب</span>
            </Button>
          )}

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

          {FEATURES.shipping && (
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs border-primary/30 text-primary hover:bg-primary/10"
          >
            <Link to={`/admin/orders/${order.id}/waybill`}>
              <Printer className="size-4" />
              <span>بوليصة الشحن (4x6 / 80mm)</span>
            </Link>
          </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs"
          >
            <Link to={`/admin/orders/${order.id}/invoice`}>
              <Printer className="size-4" />
              <span>الفاتورة الرسمية (A4)</span>
            </Link>
          </Button>

          {order.payments && order.payments.length > 0 && order.payments[0]?.status === 'completed' && !PAY_ON_DELIVERY.has(order.payment_method) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRefundModalOpen(true)}
              className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RotateCcw className="size-4" />
              <span>استرداد مالي</span>
            </Button>
          )}
        </div>
      </div>

      {/* The order's stage: pick any stage from any stage; stock and money follow. */}
      <div className="rounded-3xl border border-border bg-card p-5 shadow-2xs print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-sm font-bold text-foreground">مرحلة الطلب</h2>
            <OrderStageSelect order={order} onChanged={(stage) => setStageMessage(STAGE_BY_VALUE[stage].label)} />
            {stageMessage ? (
              <p className="text-xs font-bold text-success" role="status">تم النقل إلى «{stageMessage}»</p>
            ) : null}
          </div>
          {next ? (
            <Button
              loading={change.isPending}
              onClick={() => change.mutate({ stage: next.value }, { onSuccess: () => setStageMessage(next.label) })}
              className="h-11 gap-2 rounded-xl px-5 text-sm font-bold"
            >
              <next.icon className="size-4" aria-hidden="true" />
              <span>الخطوة التالية: {next.label}</span>
            </Button>
          ) : null}
        </div>
        {change.error ? (
          <p className="mt-2 text-xs text-destructive" role="alert">{change.error.message}</p>
        ) : null}
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
                    <LineThumb image={item.image} alt={item.product_name} size={48} />
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
              {(Number(order.shipping_total) > 0 || FEATURES.shipping) && (
                <div className="flex justify-between text-muted-foreground">
                  <span>رسوم التوصيل والشحن:</span>
                  <span className="font-mono font-semibold text-foreground">{formatPrice(order.shipping_total)}</span>
                </div>
              )}
              {Number(order.gift_wrap_fee ?? 0) > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>رسوم تغليف الهدية:</span>
                  <span className="font-mono font-semibold text-foreground">{formatPrice(order.gift_wrap_fee!)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border/80 pt-2 text-sm font-extrabold text-foreground">
                <span>المبلغ الإجمالي النهائي:</span>
                <span className="font-mono text-base text-price">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Staff notes — never shown to the customer. */}
          <div className="space-y-3 rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-6 print:hidden">
            <label htmlFor="admin-notes" className="block text-sm font-bold text-foreground">
              ملاحظات الإدارة <span className="font-normal text-muted-foreground">(داخلية، لا يراها العميل)</span>
            </label>
            <Textarea
              id="admin-notes"
              value={notesDraft ?? order.admin_notes ?? ''}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="مثال: العميل يفضّل الاتصال بعد الخامسة"
              className="min-h-20"
            />
            {notesDraft !== null && notesDraft !== (order.admin_notes ?? '') ? (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  loading={update.isPending}
                  onClick={() => update.mutate({ admin_notes: notesDraft }, { onSuccess: () => setNotesDraft(null) })}
                >
                  حفظ الملاحظات
                </Button>
                <Button size="sm" variant="outline" onClick={() => setNotesDraft(null)}>
                  تراجع
                </Button>
              </div>
            ) : null}
          </div>

          {/* Every stage change: who, when, why, and what it did. */}
          <div className="space-y-4 rounded-3xl border border-border bg-card p-5 shadow-xs sm:p-6 print:hidden">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <History className="size-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-bold text-foreground">سجل مراحل الطلب</h3>
            </div>
            {order.stage_events?.length ? (
              <ol className="space-y-4">
                {order.stage_events.map((event) => {
                  const to = STAGE_BY_VALUE[event.to_stage]
                  return (
                    <li key={event.id} className="flex gap-3">
                      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border', to.tone)}>
                        <to.icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 space-y-1 text-xs">
                        <p className="font-bold text-foreground">
                          {STAGE_BY_VALUE[event.from_stage].label} ← {to.label}
                        </p>
                        <p className="text-muted-foreground">
                          {formatDateTime(event.created_at)}
                          {event.changed_by ? ` · ${event.changed_by}` : ''}
                        </p>
                        {event.note ? <p className="text-foreground">«{event.note}»</p> : null}
                        {event.effects.length ? (
                          <ul className="list-inside list-disc text-muted-foreground">
                            {event.effects.map((effect, i) => (
                              <li key={i}>{describeEffect(effect)}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : (
              <p className="text-xs text-muted-foreground">
                لم تتغير مرحلة هذا الطلب منذ تسجيل السجل. كل تغيير من الآن يُحفظ هنا مع اسم من قام به.
              </p>
            )}
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
                  {order.user ? (
                    <button
                      type="button"
                      onClick={() => setCustomerOpen(true)}
                      className="block truncate text-start font-bold text-sm text-foreground underline-offset-4 hover:text-primary hover:underline"
                      title="فتح ملف العميل"
                    >
                      {order.user.name || 'عميل بلا اسم'}
                    </button>
                  ) : (
                    <p className="font-bold text-sm text-foreground truncate">طلب بلا حساب عميل</p>
                  )}
                  <p className="font-mono text-xs text-muted-foreground">{order.user?.phone_number || '—'}</p>
                </div>
              </div>
              {order.user ? (
                <Button type="button" variant="outline" size="sm" className="h-9 w-full rounded-xl text-xs font-bold" onClick={() => setCustomerOpen(true)}>
                  ملف العميل: التصنيف والوسوم وسجل التواصل
                </Button>
              ) : null}
            </div>
          </div>
          {order.user ? <CustomerDrawer customerId={customerOpen ? order.user.id : null} onOpenChange={(open) => !open && setCustomerOpen(false)} /> : null}

          {/* Delivery Address & Tracking Details Card */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <MapPin className="size-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">عنوان العميل</h3>
            </div>

            <div className="space-y-3 text-xs">
              {FEATURES.shipping && order.delivery_method_name && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">شركة التوصيل:</span>
                  <Badge tone="primary" className="font-bold text-xs">
                    {order.delivery_method_name}
                  </Badge>
                </div>
              )}

              {FEATURES.shipping && order.tracking_number && (
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-primary">رقم التتبع والشحنة:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(order.tracking_number)
                          setCopiedTracking(true)
                          setTimeout(() => setCopiedTracking(false), 2000)
                        }}
                        className="inline-flex items-center gap-1 font-mono text-xs font-extrabold text-foreground hover:text-primary transition-colors cursor-pointer"
                        title="نسخ رقم التتبع"
                      >
                        <span>{order.tracking_number}</span>
                        <Copy className="size-3 text-muted-foreground" />
                      </button>
                      {copiedTracking && (
                        <span className="text-[10px] font-bold text-success animate-fade-in">تم النسخ</span>
                      )}
                    </div>
                  </div>
                  {order.tracking_url && (
                    <a
                      href={order.tracking_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
                    >
                      <span>تتبع الشحنة على نظام الشركة</span>
                      <ExternalLink className="size-3 rtl:rotate-180" />
                    </a>
                  )}
                </div>
              )}

              <div>
                <span className="text-muted-foreground block mb-0.5">المدينة والمنطقة:</span>
                <p className="font-bold text-foreground text-sm">
                  {[order.city_name, order.region_name].filter(Boolean).join(' — ') || '—'}
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
                  <p className="font-medium text-foreground bg-warning/10 p-2.5 rounded-xl border border-warning/25 text-warning">
                    {order.customer_notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* What the customer asked for when they ticked "send as a gift".
              The checkout collected it and charged for it, but nothing here
              showed it, so the store could not know a gift had been ordered. */}
          {order.is_gift && (
            <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5 sm:p-6 shadow-xs space-y-3 text-xs">
              <div className="flex items-center gap-2 border-b border-primary/20 pb-3">
                <Gift className="size-4 text-primary" aria-hidden="true" />
                <h3 className="font-bold text-sm text-foreground">طلب هدية</h3>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">نوع التغليف:</span>
                <span className="font-bold text-foreground">
                  {order.gift_wrap_type === 'ROYAL_VELVET' ? 'التغليف المخملي (برسوم)' : 'التغليف الكلاسيكي (مجاني)'}
                </span>
              </div>
              {order.gift_sender_name ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">من:</span>
                  <span className="font-bold text-foreground">{order.gift_sender_name}</span>
                </div>
              ) : null}
              {order.gift_recipient_name ? (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">إلى:</span>
                  <span className="font-bold text-foreground">{order.gift_recipient_name}</span>
                </div>
              ) : null}
              {order.gift_message ? (
                <div>
                  <span className="mb-0.5 block text-muted-foreground">رسالة الإهداء:</span>
                  <p className="whitespace-pre-line rounded-xl border border-border bg-card p-2.5 font-medium text-foreground">
                    {order.gift_message}
                  </p>
                </div>
              ) : null}
              {order.hide_invoice_prices ? (
                <p className="font-bold text-warning">العميل طلب عدم إظهار الأسعار داخل الطرد.</p>
              ) : null}
            </div>
          )}

          {/* Courier Live Tracking Timeline */}
          {FEATURES.shipping && <OrderTrackingTimeline orderNumberOrId={order.order_number || order.id} />}

          {/* Payment Method & Ledger Card */}
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <CreditCard className="size-4 text-primary" />
              <h3 className="font-bold text-sm text-foreground">طريقة وحالة الدفع</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">طريقة الدفع:</span>
                <Badge tone="neutral" className="font-semibold text-xs">
                  {PAYMENT_LABELS[order.payment_method || ''] ?? order.payment_method ?? 'الدفع عند الاستلام'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">حالة السداد:</span>
                <StatusBadge status={order.payment_status || 'unpaid'} />
              </div>

              {/* Admin Payment Attempts & Verification Ledger */}
              {order.admin_payments && order.admin_payments.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2.5">
                  <span className="font-bold text-[11px] text-foreground block">
                    سجل حركات السداد ({order.admin_payments.length}):
                  </span>
                  <div className="space-y-2">
                    {order.admin_payments.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-1.5 text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground">{PAYMENT_LABELS[p.method_code] ?? p.method_code}</span>
                          <StatusBadge status={p.status} />
                        </div>
                        <div className="flex items-center justify-between text-muted-foreground font-mono">
                          <span>المبلغ: {formatPrice(p.amount)}</span>
                          <span>{p.created_at ? formatDateTime(p.created_at) : ''}</span>
                        </div>
                        {p.reference_id && (
                          <p className="font-mono text-[10px] text-muted-foreground truncate">
                            مرجع: {p.reference_id}
                          </p>
                        )}
                        {p.status === 'waiting_for_verification' && (
                          <Button
                            size="sm"
                            loading={verifyPayment.isPending}
                            onClick={() => verifyPayment.mutate({ paymentId: p.id })}
                            className="w-full mt-1.5 h-8 text-xs font-bold rounded-lg gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                          >
                            <ShieldCheck className="size-3.5" />
                            <span>تأكيد واستلام الدفعة</span>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <OrderEditDialog order={order} lookup={orderIdOrNumber} open={editOpen} onOpenChange={setEditOpen} />

      <RefundModal
        order={order}
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
      />
    </div>
  )
}
