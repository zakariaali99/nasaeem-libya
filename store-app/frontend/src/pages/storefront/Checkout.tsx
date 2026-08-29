import {
  AlertTriangle,
  Banknote,
  Building2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Truck,
  User,
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
import { useMe } from '@/lib/queries/auth'
import { LuxuryGiftingSection, type GiftingState } from '@/components/storefront/LuxuryGiftingSection'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

export default function CheckoutPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  usePageTitle('إتمام الطلب والدفع — نسائم ليبيا', 'أدخل عنوان التوصيل واختر طريقة الدفع.')

  const { data: user } = useMe()
  const { data: order, isPending, isError, error, refetch } = useOrder(orderId)
  const { data: promo } = useActiveCartPromotion()
  const confirm = useConfirmCheckout()

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [cityId, setCityId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState('')
  const [payment, setPayment] = useState('manual_payment')
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

  useEffect(() => {
    if (user?.name && !customerName) setCustomerName(user.name)
    if (user?.phone_number && !customerPhone) setCustomerPhone(user.phone_number)
  }, [user])

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

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === cityId),
    [cities, cityId],
  )

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

    // Validation for guest customer name & phone
    const errs: Record<string, string[]> = {}
    if (!customerName.trim() && !user?.name) {
      errs.customer_name = ['الاسم الثلاثي مطلوب لإتمام الطلب']
    }
    if (!customerPhone.trim() && !user?.phone_number) {
      errs.customer_phone = ['رقم الهاتف مطلوب للتواصل والتسليم']
    }
    if (!cityId) {
      errs.city_id = ['يرجى اختيار مدينة التوصيل']
    }
    if (!address.trim()) {
      errs.address = ['يرجى كتابة العنوان التفصيلي للتوصيل']
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setFormError('يرجى استكمال البيانات المطلوبة قبل إتمام الطلب.')
      return
    }

    try {
      const result = await confirm.mutateAsync({
        order_id: order.id,
        city_id: cityId,
        region_id: regionId || '',
        address,
        delivery_method_code: method,
        payment_method: payment,
        customer_name: customerName || user?.name || '',
        customer_phone: customerPhone || user?.phone_number || '',
        customer_notes: notes,
        is_gift: String(gifting.is_gift),
        gift_wrap_type: gifting.gift_wrap_type,
        gift_sender_name: gifting.gift_sender_name,
        gift_recipient_name: gifting.gift_recipient_name,
        gift_message: gifting.gift_message,
        hide_invoice_prices: String(gifting.hide_invoice_prices),
      })

      const confirmedOrder = (result as any).order || result
      const whatsappLink = (result as any).whatsapp_link

      if (whatsappLink) {
        sessionStorage.setItem('last_whatsapp_link', whatsappLink)
        window.open(whatsappLink, '_blank')
      }

      navigate(`/checkout/complete?order=${encodeURIComponent(confirmedOrder.order_number || order.order_number)}`)
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
  const regularShipping = selectedRegion
    ? selectedRegion.delivery_fee
    : selectedCity
      ? selectedCity.delivery_fee
      : order.shipping_total
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
          {/* Customer Identification (Name & Libyan Phone) */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="size-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">بيانات العميل المستلم</h2>
              </div>
              {!user && (
                <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  شراء مباشر وسريع
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="الاسم الثلاثي بالكامل *" htmlFor="customer_name" error={fieldErrors.customer_name?.[0]}>
                <Input
                  id="customer_name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله المحمودي"
                  className="h-11 rounded-xl text-xs font-bold"
                  required
                />
              </Field>

              <Field label="رقم هاتف الواتساب الليبي *" htmlFor="customer_phone" error={fieldErrors.customer_phone?.[0]}>
                <Input
                  id="customer_phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0912345678 أو 0921234567"
                  dir="ltr"
                  className="h-11 rounded-xl text-xs font-mono font-bold"
                  required
                />
              </Field>
            </div>

            {!user && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl">
                💡 سيتم إنشاء حساب لك تلقائياً بكلمة مرور مؤقتة (000000) وتزويدك بالفاتورة التفصيلية عبر واتساب، ويمكنك تغيير كلمة المرور متى شئت.
              </p>
            )}
          </section>

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
                <Field label="المدينة *" htmlFor="city" error={fieldErrors.city_id?.[0]}>
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

                {regions.length > 0 ? (
                  <Field label="المنطقة والحي (اختياري)" htmlFor="region" error={fieldErrors.region_id?.[0]}>
                    <Select
                      id="region"
                      value={regionId}
                      onChange={(event) => setRegionId(event.target.value)}
                      disabled={!cityId}
                      aria-invalid={Boolean(fieldErrors.region_id)}
                      className="h-11 rounded-xl"
                    >
                      <option value="">{cityId ? 'كل أحياء ومناطق المدينة' : 'اختر المدينة أولاً'}</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <div className="flex flex-col justify-center">
                    <span className="text-xs font-bold text-foreground mb-1.5">نطاق التوصيل</span>
                    <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3.5 py-2.5 text-xs text-primary font-bold min-h-11">
                      <Truck className="size-4 shrink-0" />
                      <span>
                        {selectedCity
                          ? `توصيل سريع لكافة أحياء ${selectedCity.name}`
                          : 'اختر المدينة لتحديد التوصيل'}
                      </span>
                    </div>
                  </div>
                )}
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

          {/* Luxury Gifting Suite */}
          <LuxuryGiftingSection value={gifting} onChange={setGifting} />

          {/* Payment Methods Section */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Banknote className="size-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">طريقة الدفع</h2>
            </div>

            <div className="space-y-3">
              {/* Cash On Delivery Option */}
              <label
                className={cn(
                  'flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all',
                  payment === 'manual_payment'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                    : 'border-border bg-background hover:bg-muted/30'
                )}
              >
                <input
                  type="radio"
                  name="payment_choice"
                  value="manual_payment"
                  checked={payment === 'manual_payment'}
                  onChange={() => setPayment('manual_payment')}
                  className="mt-1 size-4 accent-primary"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-bold text-sm text-foreground">الدفع عند الاستلام كاش</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    الدفع نقداً للمندوب عند استلام العطر ومعاينته والتأكد من جودته.
                  </p>
                </div>
              </label>

              {/* Bank Transfer Option */}
              <label
                className={cn(
                  'flex items-start gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all',
                  payment === 'bank_transfer'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                    : 'border-border bg-background hover:bg-muted/30'
                )}
              >
                <input
                  type="radio"
                  name="payment_choice"
                  value="bank_transfer"
                  checked={payment === 'bank_transfer'}
                  onChange={() => setPayment('bank_transfer')}
                  className="mt-1 size-4 accent-primary"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="size-4 text-primary" />
                    <span className="font-bold text-sm text-foreground">تحويل مصرفي مباشر</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    تحويل قيمة العطر عبر تطبيق مصرفك (الجمهورية، التجاري الوطني، شمال أفريقيا، النوران، إلخ).
                  </p>
                </div>
              </label>

              {/* Prominent WhatsApp Bank Transfer Notice */}
              {payment === 'bank_transfer' && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-2 animate-fade-rise">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm">
                    <MessageSquare className="size-4 shrink-0" />
                    <span>إشعار التحويل المصرفي التلقائي عبر واتساب</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    سيتم التواصل معك تلقائياً عبر واتساب لتزويدك ببيانات الحساب المصرفي ورقم الآيبان (IBAN) للتحويل، وإرسال الفاتورة التفصيلية بعد إتمام الطلب مباشرة.
                  </p>
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
              loading={confirm.isPending}
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
            loading={confirm.isPending}
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
