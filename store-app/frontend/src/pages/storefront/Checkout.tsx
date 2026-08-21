import { AlertTriangle, Check } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ErrorState } from '@/components/storefront/ErrorState'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useConfirmCheckout } from '@/lib/queries/cart'
import { useCities, useDeliveryMethods, useOrder, useRegions } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'

export default function CheckoutPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  usePageTitle('إتمام الطلب', 'أدخل عنوان التوصيل واختر طريقة الدفع.')

  const { data: order, isPending, isError, error, refetch } = useOrder(orderId)
  const confirm = useConfirmCheckout()

  const [cityId, setCityId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState('')
  const [payment, setPayment] = useState('manual_payment')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const { data: cityData, isPending: citiesPending } = useCities()
  const { data: regionData } = useRegions(cityId || undefined)
  const { data: methods } = useDeliveryMethods()

  const cities = cityData?.cities ?? []
  const regions = regionData?.regions ?? []

  useEffect(() => {
    if (methods?.length && !method) setMethod(methods[0]!.code)
  }, [methods, method])

  // Changing city invalidates the chosen region — leaving a region from the
  // previous city selected is how an order gets shipped to the wrong place.
  useEffect(() => {
    setRegionId('')
  }, [cityId])

  const selectedRegion = useMemo(
    () => regions.find((region) => region.id === regionId),
    [regions, regionId],
  )

  if (isPending) return <CheckoutSkeleton />

  if (isError) {
    const missing = error instanceof ApiError && error.status === 404
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="mb-4 text-2xl font-bold">إتمام الطلب</h1>
        {missing ? (
          <Alert tone="error">
            الطلب غير موجود.{' '}
            <Link to="/cart" className="font-semibold underline">
              العودة إلى السلة
            </Link>
          </Alert>
        ) : (
          <ErrorState error={error} onRetry={() => refetch()} />
        )}
      </div>
    )
  }

  if (order.status !== 'pending') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-12">
        <h1 className="mb-4 text-2xl font-bold">إتمام الطلب</h1>
        <Alert tone="info">
          هذا الطلب ({order.order_number}) لم يعد بانتظار التأكيد.{' '}
          <Link to={`/me/orders/${order.id}`} className="font-semibold underline">
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
      })
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

  const shipping = selectedRegion ? selectedRegion.delivery_fee : order.shipping_total
  const total = (
    Number(order.subtotal) - Number(order.discount_total) + Number(shipping)
  ).toFixed(2)

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-1 text-2xl font-bold sm:text-3xl">إتمام الطلب</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        راجع طلبك وأدخل عنوان التوصيل. يُعرض رقم الطلب بعد التأكيد.
      </p>

      <form className="grid gap-8 lg:grid-cols-[1fr_20rem]" onSubmit={submit} noValidate>
        <div className="space-y-6">
          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">عنوان التوصيل</h2>

            {/* The empty-city failure the reference shipped: an empty <select>
                with no explanation, and a customer who could not order. */}
            {!citiesPending && cities.length === 0 ? (
              <Alert tone="error">
                <AlertTriangle className="sr-only" aria-hidden="true" />
                {cityData?.message ??
                  'لا توجد مدن توصيل مُعرّفة في المتجر حالياً، يرجى التواصل معنا لإتمام الطلب'}
              </Alert>
            ) : (
              <>
                <Field label="المدينة" htmlFor="city">
                  <Select
                    id="city"
                    value={cityId}
                    onChange={(event) => setCityId(event.target.value)}
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

                <Field label="المنطقة" htmlFor="region" error={fieldErrors.region_id?.[0]}>
                  {cityId && regions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {regionData?.message ?? 'لا توجد مناطق توصيل لهذه المدينة حالياً'}
                    </p>
                  ) : (
                    <Select
                      id="region"
                      value={regionId}
                      onChange={(event) => setRegionId(event.target.value)}
                      disabled={!cityId}
                      aria-invalid={Boolean(fieldErrors.region_id)}
                      required
                    >
                      <option value="">{cityId ? 'اختر المنطقة' : 'اختر المدينة أولاً'}</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name} — {formatPrice(region.delivery_fee)}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </>
            )}

            <Field label="العنوان بالتفصيل" htmlFor="address" error={fieldErrors.address?.[0]}>
              <Textarea
                id="address"
                rows={3}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="الشارع، أقرب نقطة دالة، رقم المبنى"
                aria-invalid={Boolean(fieldErrors.address)}
                required
              />
            </Field>

            <Field label="ملاحظات (اختياري)" htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="أي تعليمات إضافية للتوصيل"
              />
            </Field>
          </section>

          <section className="space-y-4 rounded-lg border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">طريقة التوصيل</h2>
            {methods?.length ? (
              <Field label="شركة التوصيل" htmlFor="method">
                <Select
                  id="method"
                  value={method}
                  onChange={(event) => setMethod(event.target.value)}
                >
                  {methods.map((option) => (
                    <option key={option.id} value={option.code}>
                      {option.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <p className="text-sm text-muted-foreground">
                لم تُفعّل أي شركة توصيل بعد؛ سنتواصل معك لترتيب التوصيل.
              </p>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">طريقة الدفع</h2>
            {/*
              Only the two methods that need no gateway integration are offered
              here. The six gateways arrive in Phase 6, and listing one that
              cannot yet take a payment would be a button that does nothing.
            */}
            <PaymentChoice
              value="manual_payment"
              checked={payment === 'manual_payment'}
              onChange={setPayment}
              title="تحويل بنكي"
              description="سنرسل لك تفاصيل الحساب، وتُرفق إيصال التحويل بعد الدفع."
            />
            <PaymentChoice
              value="bank_cards_on_delivery"
              checked={payment === 'bank_cards_on_delivery'}
              onChange={setPayment}
              title="بطاقة عند الاستلام"
              description="الدفع بالبطاقة عبر جهاز المندوب عند التسليم."
            />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ul className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="line-clamp-1">{item.product_name}</span>
                  <span className="text-muted-foreground">
                    {item.variant_label ? `${item.variant_label} · ` : ''}×{item.quantity}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums">{formatPrice(item.total_price)}</span>
              </li>
            ))}
          </ul>

          <OrderSummary
            subtotal={order.subtotal}
            discountTotal={order.discount_total}
            shippingTotal={shipping}
            total={total}
            shippingNote="اختر المنطقة لحساب رسوم التوصيل"
          />

          {formError ? (
            <Alert tone="error" role="alert">
              {formError}
            </Alert>
          ) : null}

          <Button type="submit" size="lg" block loading={confirm.isPending}>
            <Check aria-hidden="true" />
            تأكيد الطلب
          </Button>
          <Button asChild variant="ghost" block>
            <Link to="/cart">العودة إلى السلة</Link>
          </Button>
        </aside>
      </form>
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
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 has-checked:border-primary has-checked:bg-primary/5">
      <input
        type="radio"
        name="payment_method"
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="mt-1 size-5 accent-primary"
      />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
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
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CheckoutSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6" aria-busy="true">
      <span className="sr-only" role="status">
        جارٍ تحميل الطلب…
      </span>
      <Skeleton className="mb-6 h-9 w-48" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
