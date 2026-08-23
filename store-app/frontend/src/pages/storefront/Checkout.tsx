import {
  AlertTriangle,
  CreditCard,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorState } from '@/components/storefront/ErrorState'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useConfirmCheckout } from '@/lib/queries/cart'
import { useCities, useDeliveryMethods, useOrder, useRegions } from '@/lib/queries/delivery'
import { useActiveCartPromotion } from '@/lib/queries/orders'
import { useInitiatePayment, usePublicPaymentMethods } from '@/lib/queries/payments'
import { LuxuryGiftingSection, type GiftingState } from '@/components/storefront/LuxuryGiftingSection'
import { usePageTitle } from '@/lib/usePageTitle'

export default function CheckoutPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  usePageTitle('إتمام الطلب والدفع — نسائم ليبيا', 'أدخل عنوان التوصيل واختر طريقة الدفع.')

  const { data: order, isPending, isError, error, refetch } = useOrder(orderId)
  const { data: promo } = useActiveCartPromotion()
  const confirm = useConfirmCheckout()
  const initiatePayment = useInitiatePayment()
  const { data: availablePaymentMethods } = usePublicPaymentMethods()

  const [cityId, setCityId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState('')
  const [payment, setPayment] = useState('manual_payment')
  const [transferReceipt, setTransferReceipt] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [gifting, setGifting] = useState<GiftingState>({
    is_gift: false,
    gift_wrap_type: 'CLASSIC_ELEGANCE',
    gift_sender_name: '',
    gift_recipient_name: '',
    gift_message: '',
    hide_invoice_prices: false,
  })

  const {
    data: cityData,
    isPending: citiesPending,
    isError: citiesError,
    error: citiesFetchError,
    refetch: refetchCities,
  } = useCities()
  const { data: regionData } = useRegions(cityId || undefined)
  const { data: methods } = useDeliveryMethods()

  const cities = cityData?.cities ?? []
  const regions = regionData?.regions ?? []

  useEffect(() => {
    if (methods?.length && !method) setMethod(methods[0]!.code)
  }, [methods, method])

  useEffect(() => {
    setRegionId('')
  }, [cityId])

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === regionId),
    [regions, regionId],
  )

  if (isPending) return <CheckoutSkeleton />

  if (isError || !order) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center space-y-4">
        <Alert tone="error">
          {error instanceof ApiError ? error.message : 'تعذّر تحميل بيانات الطلب.'}
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          إعادة المحاولة
        </Button>
      </div>
    )
  }

  if (order.status !== 'pending') {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center space-y-4">
        <Alert tone="info">
          هذا الطلب مكتمل أو قيد المعالجة بالفعل.
          <Link
            to={`/orders/${encodeURIComponent(order.order_number)}`}
            className="block mt-2 font-bold text-primary hover:underline"
          >
            عرض تفاصيل الطلب
          </Link>
        </Alert>
      </div>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFieldErrors({})
    setFormError(null)
    try {
      await confirm.mutateAsync({
        order_id: order.id,
        region_id: regionId,
        address,
        delivery_method_code: method,
        payment_method: payment,
        customer_notes: notes,
        is_gift: String(gifting.is_gift),
        gift_wrap_type: gifting.gift_wrap_type,
        gift_sender_name: gifting.gift_sender_name,
        gift_recipient_name: gifting.gift_recipient_name,
        gift_message: gifting.gift_message,
        hide_invoice_prices: String(gifting.hide_invoice_prices),
      })

      if (['moamalat', 'plutu', 'sadad_pay', 'binance_pay'].includes(payment)) {
        try {
          const initResult = await initiatePayment.mutateAsync({
            order_id: order.id,
            method_code: payment,
          })
          if (initResult.action === 'redirect' && initResult.gateway_url) {
            window.location.href = initResult.gateway_url
            return
          }
          navigate(`/checkout/redirect?order_id=${encodeURIComponent(order.id)}`)
          return
        } catch {
          navigate(`/checkout/redirect?order_id=${encodeURIComponent(order.id)}`)
          return
        }
      }

      if (payment === 'manual_payment') {
        try {
          await initiatePayment.mutateAsync({
            order_id: order.id,
            method_code: payment,
            user_input: transferReceipt ? { transferReceipt } : {},
          })
        } catch {
          // Manual payment record created during initiation
        }
      }

      navigate(`/checkout/complete?order=${encodeURIComponent(order.order_number)}`)
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFieldErrors(failure.errors ?? {})
        setFormError(failure.message)
      } else {
        setFormError('تعذّر تأكيد الطلب، حاول مرة أخرى')
      }
    }
  }

  const isFreeShipping = Boolean(
    promo?.is_active && order && Number(order.subtotal) >= Number(promo.min_order_amount),
  )
  const regularShipping = selectedRegion ? selectedRegion.delivery_fee : order.shipping_total
  const shipping = isFreeShipping ? '0.00' : regularShipping
  const giftWrapFee = gifting.is_gift && gifting.gift_wrap_type === 'ROYAL_VELVET' ? 15 : 0
  const total = (
    Number(order.subtotal) - Number(order.discount_total) + Number(shipping) + giftWrapFee
  ).toFixed(2)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 animate-fade-rise space-y-6">
      {/* Checkout Steps Progress Bar */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-2 border-b border-border/80">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-mono">1</span>
          <span>السلة</span>
        </div>
        <div className="h-0.5 w-6 sm:w-12 bg-primary" />
        <div className="flex items-center gap-2 text-xs font-bold text-primary">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono">2</span>
          <span>العنوان والدفع</span>
        </div>
        <div className="h-0.5 w-6 sm:w-12 bg-border" />
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-mono">3</span>
          <span>تأكيد الطلب</span>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">إتمام الطلب وتحديد التوصيل</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          رقم الطلب المؤقت: <span className="font-mono font-bold text-foreground">#{order.order_number}</span>
        </p>
      </div>

      <form className="grid gap-8 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem] items-start" onSubmit={submit} noValidate>
        <div className="space-y-6">
          {/* Shipping Address Section */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">عنوان ومكان التوصيل</h2>
            </div>

            {citiesError ? (
              <ErrorState error={citiesFetchError} onRetry={() => refetchCities()} />
            ) : !citiesPending && cities.length === 0 ? (
              <Alert tone="error">
                <AlertTriangle className="sr-only" aria-hidden="true" />
                {cityData?.message ??
                  'لا توجد مدن توصيل مُعرّفة في المتجر حالياً، يرجى التواصل معنا لإتمام الطلب'}
              </Alert>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="المدينة *" htmlFor="city">
                  <Select
                    id="city"
                    value={cityId}
                    onChange={(event) => setCityId(event.target.value)}
                    className="h-11 rounded-xl"
                    required
                  >
                    <option value="">اختر المدينة</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="المنطقة والحي *" htmlFor="region" error={fieldErrors.region_id?.[0]}>
                  {cityId && regions.length === 0 ? (
                    <p className="text-xs text-muted-foreground pt-3">
                      {regionData?.message ?? 'لا توجد مناطق توصيل لهذه المدينة حالياً'}
                    </p>
                  ) : (
                    <Select
                      id="region"
                      value={regionId}
                      onChange={(event) => setRegionId(event.target.value)}
                      disabled={!cityId}
                      aria-invalid={Boolean(fieldErrors.region_id)}
                      className="h-11 rounded-xl"
                      required
                    >
                      <option value="">{cityId ? 'اختر المنطقة' : 'اختر المدينة أولاً'}</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name} — توصيل {formatPrice(region.delivery_fee)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            )}

            <Field label="العنوان بالتفصيل *" htmlFor="address" error={fieldErrors.address?.[0]}>
              <Textarea
                id="address"
                rows={2}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="الشارع، أقرب نقطة دالة، رقم العمارة أو المنزل..."
                aria-invalid={Boolean(fieldErrors.address)}
                className="rounded-xl text-xs sm:text-sm"
                required
              />
            </Field>

            <Field label="ملاحظات إضافية للتوصيل (اختياري)" htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="الوقت المفضل للتسليم أو أي توجيهات للمندوب..."
                className="rounded-xl text-xs sm:text-sm"
              />
            </Field>
          </section>

          {/* Delivery Courier Section */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Truck className="size-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">شركة التوصيل والشحن</h2>
            </div>

            {methods?.length ? (
              <Field label="اختر شركة التوصيل" htmlFor="method">
                <Select
                  id="method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                  className="h-11 rounded-xl"
                >
                  {methods.map((option) => (
                    <option key={option.id} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="text-xs text-muted-foreground">
                التوصيل المباشر عبر أسطول نسائم ليبيا إلى عنوانك.
              </p>
            )}
          </section>

          {/* Luxury Gifting Suite */}
          <LuxuryGiftingSection value={gifting} onChange={setGifting} />

          {/* Payment Methods Section */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CreditCard className="size-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">طريقة الدفع</h2>
            </div>

            <div className="space-y-2.5">
              {availablePaymentMethods && availablePaymentMethods.length > 0 ? (
                availablePaymentMethods.map((m) => (
                  <PaymentChoice
                    key={m.id}
                    value={m.method_code}
                    checked={payment === m.method_code}
                    onChange={setPayment}
                    title={m.display_name}
                    description={m.description || ''}
                  />
                ))
              ) : (
                <>
                  <PaymentChoice
                    value="manual_payment"
                    checked={payment === 'manual_payment'}
                    onChange={setPayment}
                    title="تحويل مصرفي مباشر"
                    description="إرسال إيصال التحويل عبر التطبيق بعد تأكيد الطلب."
                  />
                  <PaymentChoice
                    value="bank_cards_on_delivery"
                    checked={payment === 'bank_cards_on_delivery'}
                    onChange={setPayment}
                    title="الدفع بالبطاقة عند الاستلام (POS)"
                    description="الدفع بالبطاقة المصرفية عبر جهاز نقاط البيع لدى مندوب التوصيل."
                  />
                </>
              )}

              {payment === 'manual_payment' && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5 animate-fade-rise">
                  <p className="text-xs text-primary font-medium">
                    يرجى تحويل قيمة الطلب إلى الحساب المصرفي المعتمد للمتجر، وإدخال رقم الإشعار أو مرجع التحويل لتسريع التحقق وتجهيز طلبك:
                  </p>
                  <Field label="رقم مرجع التحويل أو إشعار الإيداع (اختياري)" htmlFor="transferReceipt">
                    <Input
                      id="transferReceipt"
                      value={transferReceipt}
                      onChange={(e) => setTransferReceipt(e.target.value)}
                      placeholder="مثال: TRX-884920 أو رقم إشعار موبي كاش / سداد"
                      className="h-10 text-xs font-mono"
                    />
                  </Field>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Order Summary Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground border-b border-border/80 pb-2">
              ملخص الأصناف في الطلب
            </h3>
            
            <ul className="space-y-2.5 text-xs max-h-48 overflow-y-auto">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <span className="font-bold text-foreground line-clamp-1">{item.product_name}</span>
                    <span className="text-muted-foreground font-mono">
                      {item.variant_label ? `${item.variant_label} · ` : ''}×{item.quantity}
                    </span>
                  </div>
                  <span className="shrink-0 font-mono font-bold text-price">{formatPrice(item.total_price)}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-border/80 pt-3">
              <OrderSummary
                subtotal={order.subtotal}
                discountTotal={order.discount_total}
                shippingTotal={shipping}
                total={total}
                isFreeShipping={isFreeShipping}
                shippingNote="رسوم التوصيل محتسبة للمنطقة المحددة"
              />
            </div>

            {formError ? (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {formError}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              block
              loading={confirm.isPending || initiatePayment.isPending}
              className="rounded-xl font-bold text-sm h-12 shadow-sm"
            >
              تأكيد الطلب الآن
            </Button>

            <div className="border-t border-border/80 pt-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>ضمان نسائم ليبيا الذهبي للأصالة والجودة</span>
              </div>
            </div>
          </div>
        </aside>
      </form>

      {/* Mobile Sticky Checkout Bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 px-4 backdrop-blur-md shadow-2xl lg:hidden pb-safe">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div>
            <span className="text-[10px] text-muted-foreground block font-medium">الإجمالي النهائي:</span>
            <span className="font-mono text-base font-extrabold text-price">{formatPrice(total)}</span>
          </div>
          <Button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              submit(e)
            }}
            loading={confirm.isPending || initiatePayment.isPending}
            className="rounded-xl font-bold h-11 px-6 text-xs shadow-md gap-1.5"
          >
            <span>تأكيد الطلب</span>
          </Button>
        </div>
      </div>
      <div className="h-16 lg:hidden" aria-hidden="true" />
    </div>
  )
}

function PaymentChoice({
  value,
  checked,
  onChange,
  title,
  description,
}: {
  value: string
  checked: boolean
  onChange: (value: string) => void
  title: string
  description: string
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-all shadow-2xs ${
        checked
          ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
          : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      <input
        type="radio"
        name="payment_method"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-0.5 size-4 accent-primary"
      />
      <div className="min-w-0 flex-1">
        <span className="block text-xs sm:text-sm font-bold text-foreground">{title}</span>
        {description && (
          <span className="block text-[11px] text-muted-foreground mt-0.5">{description}</span>
        )}
      </div>
    </label>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-xs font-bold text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[11px] font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6" aria-busy="true">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    </div>
  )
}
