import {
  AlertTriangle,
  Banknote,
  Building2,
  MapPin,
  MessageSquare,
  ShieldCheck,
  User,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { Link, useNavigate } from '@/lib/i18nRouter'

import { ErrorState } from '@/components/storefront/ErrorState'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LineThumb } from '@/components/ui/line-thumb'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { FEATURES } from '@/lib/features'
import { formatPrice } from '@/lib/format'
import { useCheckoutOrder, useConfirmCheckout } from '@/lib/queries/cart'
import { useCities, useDeliveryMethods, useRegions } from '@/lib/queries/delivery'
import { useActiveCartPromotion, useAddresses } from '@/lib/queries/orders'
import { useMe } from '@/lib/queries/auth'
import { LuxuryGiftingSection, type GiftingState } from '@/components/storefront/LuxuryGiftingSection'
import { useSiteText } from '@/lib/siteText'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

export default function CheckoutPage() {
  const { orderId = '' } = useParams()
  const navigate = useNavigate()
  usePageTitle(t('checkout.title'), t('checkout.metaDescription'))
  const guaranteeNote = useSiteText()('checkout.guarantee')

  const { data: user } = useMe()
  const { data: order, isPending, isError, error, refetch } = useCheckoutOrder(orderId)
  const { data: savedAddresses } = useAddresses(Boolean(user))
  const formRef = useRef<HTMLFormElement>(null)
  // The region of a saved address, applied once that city's regions have loaded.
  const pendingRegion = useRef('')
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
    setRegionId(pendingRegion.current)
    pendingRegion.current = ''
  }, [cityId])

  const applySavedAddress = (saved: { city: string | null; region: string | null; address: string }) => {
    pendingRegion.current = saved.region ?? ''
    if (saved.city === cityId) setRegionId(saved.region ?? '')
    setCityId(saved.city ?? '')
    setAddress(saved.address)
  }

  const selectedCity = useMemo(
    () => cities.find((city) => city.id === cityId),
    [cities, cityId],
  )
  // Alphabetical, so a city is where the customer looks for it.
  const sortedCities = useMemo(
    () => [...cities].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [cities],
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
          {error instanceof ApiError ? error.message : t('checkout.loadFailed')}
        </Alert>
        <Button onClick={() => refetch()} variant="outline">
          {t('common.retry')}
        </Button>
      </div>
    )
  }

  if (order.status !== 'pending') {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center space-y-4">
        <Alert tone="info">
          {order.status === 'cancelled'
            ? t('checkout.expired')
            : t('checkout.alreadyConfirmed')}
          <Link
            to={order.status === 'cancelled' ? '/products' : user ? `/me/orders/${order.id}` : '/'}
            className="block mt-2 font-bold text-primary hover:underline"
          >
            {order.status === 'cancelled' ? t('checkout.browseProducts') : user ? t('checkout.viewOrder') : t('checkout.backToStore')}
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
      errs.customer_name = [t('checkout.nameRequired')]
    }
    const phoneDigits = (customerPhone.trim() || user?.phone_number || '').replace(/[^\d]/g, '')
    if (!phoneDigits) {
      errs.customer_phone = [t('checkout.phoneRequired')]
    } else if (!/^(?:218|0)?9[1-5]\d{7}$/.test(phoneDigits)) {
      // The number becomes the account: a mistyped one cannot be called back.
      errs.customer_phone = [t('checkout.phoneInvalid')]
    }
    if (!cityId) {
      errs.city_id = [t('checkout.cityRequired')]
    }
    if (!address.trim()) {
      errs.address = [t('checkout.addressRequired')]
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setFormError(t('checkout.completeForm'))
      // Take the customer to the first field that needs them: the confirm
      // button sits a full screen below it on a phone.
      const first = ['customer_name', 'customer_phone', 'city_id', 'address'].find((key) => errs[key])
      const target = formRef.current?.querySelector<HTMLElement>(
        `#${first === 'city_id' ? 'city' : first}`,
      )
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      target?.focus({ preventScroll: true })
      return
    }

    try {
      const result = await confirm.mutateAsync({
        order_id: order.id,
        city_id: cityId,
        region_id: regionId || '',
        address,
        delivery_method_code: FEATURES.shipping ? method : '',
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

      const orderNumber = result.order.order_number || order.order_number

      // Not opened automatically: the confirmation page offers WhatsApp as a
      // button the customer may or may not use.
      try {
        if (result.whatsapp_link) sessionStorage.setItem(`whatsapp_link:${orderNumber}`, result.whatsapp_link)
      } catch {
        // storage unavailable (private mode) — the page simply shows no button
      }

      navigate(
        `/checkout/complete?order=${encodeURIComponent(orderNumber)}&id=${encodeURIComponent(result.order.id)}`,
      )
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFieldErrors(failure.errors ?? {})
        setFormError(failure.message)
      } else {
        setFormError(t('checkout.confirmFailed'))
      }
    }
  }

  const isFreeShipping = Boolean(
    FEATURES.shipping &&
      promo?.is_active &&
      order &&
      Number(order.subtotal) >= Number(promo.min_order_amount),
  )
  // With delivery quoted by the store on confirmation there is no fee to
  // preview; the server charges none either.
  const regularShipping = !FEATURES.shipping
    ? '0.00'
    : selectedRegion
      ? selectedRegion.delivery_fee
      : selectedCity
        ? selectedCity.delivery_fee
        : order.shipping_total
  const shipping = isFreeShipping ? '0.00' : regularShipping
  const giftWrapFee = FEATURES.gifting && gifting.is_gift && gifting.gift_wrap_type === 'ROYAL_VELVET' ? 15 : 0
  const total = (
    Number(order.subtotal) - Number(order.discount_total) + Number(shipping) + giftWrapFee
  ).toFixed(2)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 animate-fade-rise space-y-6">
      {/* Checkout Steps Progress Bar */}
      <div className="flex items-center justify-center gap-2 sm:gap-4 py-2 border-b border-border/80">
        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-mono">1</span>
          <span>{t('checkout.stepCart')}</span>
        </div>
        <div className="h-0.5 w-6 sm:w-12 bg-primary" />
        <div className="flex items-center gap-2 text-xs font-bold text-primary">
          <span className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono">2</span>
          <span>{t('checkout.stepAddress')}</span>
        </div>
        <div className="h-0.5 w-6 sm:w-12 bg-border" />
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground font-mono">3</span>
          <span>{t('checkout.stepConfirm')}</span>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('checkout.heading')}</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {t('checkout.tempNumber')} <bdi className="font-mono font-bold text-foreground">#{order.order_number}</bdi>
        </p>
      </div>

      <form ref={formRef} className="grid gap-8 lg:grid-cols-[1fr_24rem] xl:grid-cols-[1fr_26rem] items-start" onSubmit={submit} noValidate>
        <div className="space-y-6">
          {/* Customer Identification (Name & Libyan Phone) */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="size-4" />
                </div>
                <h2 className="text-base sm:text-lg font-bold text-foreground">{t('checkout.customer')}</h2>
              </div>
              {!user && (
                <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                  {t('checkout.noAccount')}
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('checkout.fullName')} htmlFor="customer_name" error={fieldErrors.customer_name?.[0]}>
                <Input
                  id="customer_name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={t('checkout.namePlaceholder')}
                  autoComplete="name"
                  aria-invalid={Boolean(fieldErrors.customer_name)}
                  className="h-11 rounded-xl text-sm font-bold placeholder:font-normal placeholder:text-muted-foreground/70"
                  required
                />
              </Field>

              <Field label={t('checkout.phone')} htmlFor="customer_phone" error={fieldErrors.customer_phone?.[0]}>
                <Input
                  id="customer_phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0912345678"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  dir="ltr"
                  aria-invalid={Boolean(fieldErrors.customer_phone)}
                  className="h-11 rounded-xl text-sm font-mono font-bold placeholder:font-normal placeholder:text-muted-foreground/70"
                  required
                />
              </Field>
            </div>

            {!user && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl">
                {t('checkout.noPassword')}
              </p>
            )}
          </section>

          {/* Shipping Address Section */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">{t('checkout.delivery')}</h2>
            </div>

            {citiesError ? (
              <ErrorState error={citiesFetchError} onRetry={() => refetchCities()} />
            ) : !citiesPending && cities.length === 0 ? (
              <Alert tone="error">
                <AlertTriangle className="sr-only" aria-hidden="true" />
                {cityData?.message ??
                  t('checkout.noCities')}
              </Alert>
            ) : (
              <>
              {(savedAddresses ?? []).length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-foreground">{t('checkout.savedAddresses')}</p>
                  <div className="flex flex-wrap gap-2">
                    {(savedAddresses ?? []).map((saved) => (
                      <button
                        key={saved.id}
                        type="button"
                        onClick={() => applySavedAddress(saved)}
                        className={cn(
                          'min-h-11 max-w-full rounded-xl border px-3 py-2 text-start text-xs transition-colors',
                          saved.city === cityId && saved.address === address
                            ? 'border-primary bg-primary/10 text-foreground'
                            : 'border-border bg-background hover:bg-muted/40',
                        )}
                      >
                        <span className="block font-bold">
                          {saved.city_name}
                          {saved.region_name ? ` — ${saved.region_name}` : ''}
                        </span>
                        <span className="block truncate text-muted-foreground">{saved.address}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('checkout.city')} htmlFor="city" error={fieldErrors.city_id?.[0]}>
                  <Select
                    id="city"
                    value={cityId}
                    onChange={(event) => setCityId(event.target.value)}
                    className="h-11 rounded-xl"
                    required
                  >
                    <option value="">{t('checkout.chooseCity')}</option>
                    {sortedCities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {regions.length > 0 ? (
                  <Field label={t('checkout.region')} htmlFor="region" error={fieldErrors.region_id?.[0]}>
                    <Select
                      id="region"
                      value={regionId}
                      onChange={(event) => setRegionId(event.target.value)}
                      disabled={!cityId}
                      aria-invalid={Boolean(fieldErrors.region_id)}
                      className="h-11 rounded-xl"
                    >
                      <option value="">{cityId ? t('checkout.allRegions') : t('checkout.cityFirst')}</option>
                      {regions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
              </div>
              </>
            )}

            <Field label={t('checkout.address')} htmlFor="address" error={fieldErrors.address?.[0]}>
              <Textarea
                id="address"
                rows={2}
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder={t('checkout.addressPlaceholder')}
                aria-invalid={Boolean(fieldErrors.address)}
                className="rounded-xl text-xs sm:text-sm"
                required
              />
            </Field>

            <Field label={t('checkout.notes')} htmlFor="notes">
              <Textarea
                id="notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder={t('checkout.notesPlaceholder')}
                className="rounded-xl text-xs sm:text-sm"
              />
            </Field>
          </section>

          {/* Luxury Gifting Suite */}
          {FEATURES.gifting ? <LuxuryGiftingSection value={gifting} onChange={setGifting} /> : null}

          {/* Payment Methods Section */}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 border-b border-border/80 pb-3">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Banknote className="size-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">{t('checkout.payment')}</h2>
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
                    <span className="font-bold text-sm text-foreground">{t('checkout.cod')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('checkout.codText')}
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
                    <span className="font-bold text-sm text-foreground">{t('checkout.bank')}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('checkout.bankText')}
                  </p>
                </div>
              </label>

              {/* Prominent WhatsApp Bank Transfer Notice */}
              {payment === 'bank_transfer' && (
                <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 space-y-2 animate-fade-rise">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs sm:text-sm">
                    <MessageSquare className="size-4 shrink-0" />
                    <span>{t('checkout.bankHow')}</span>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                    {t('checkout.bankHowText')}
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
              {t('checkout.itemsSummary')}
            </h3>
            
            <ul className="space-y-2.5 text-xs max-h-72 overflow-y-auto">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <LineThumb image={item.image} alt={item.product_name} size={48} />
                    <div className="min-w-0">
                      <span className="block font-bold text-foreground line-clamp-1">{item.product_name}</span>
                      <span className="text-muted-foreground font-mono">
                        {item.variant_label ? `${item.variant_label} · ` : ''}×{item.quantity}
                      </span>
                    </div>
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
                shippingNote={t('checkout.shippingForRegion')}
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
              {t('checkout.confirmNow')}
            </Button>

            <div className="border-t border-border/80 pt-3 text-center space-y-1">
              {guaranteeNote && (
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
                  <ShieldCheck className="size-3.5 text-emerald-500" />
                  <span>{guaranteeNote}</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </form>

      {/* Mobile sticky confirm bar. Rendered on <body>: inside this page's
          entrance animation a `fixed` element is positioned against the page,
          not the screen, so the bar sat at the very bottom of the form and
          behind the navigation instead of staying in view. */}
      {createPortal(
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-card/95 p-3 px-4 backdrop-blur-md shadow-lg lg:hidden">
        <div className="flex items-center justify-between gap-3 max-w-lg mx-auto">
          <div>
            <span className="text-[10px] text-muted-foreground block font-medium">{t('checkout.finalTotal')}</span>
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
            <span>{t('checkout.confirm')}</span>
          </Button>
        </div>
      </div>,
        document.body,
      )}
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
