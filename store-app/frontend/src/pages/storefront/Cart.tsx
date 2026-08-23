import { ArrowRight, Check, Percent, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DiscoveryBoxBanner } from '@/components/storefront/DiscoveryBoxBanner'
import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { LoyaltyVipBadge } from '@/components/storefront/LoyaltyVipBadge'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { QuantityStepper } from '@/components/storefront/QuantityStepper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import {
  useApplyDiscount,
  useCart,
  useCreateOrder,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/lib/queries/cart'
import { usePageTitle } from '@/lib/usePageTitle'
import type { CartLine } from '@/types/api'

export default function CartPage() {
  usePageTitle('سلة التسوّق — نسائم ليبيا', 'راجع المنتجات والعطور قبل إتمام عملية الشراء.')

  const navigate = useNavigate()
  const { data: cart, isPending, isError, error, refetch } = useCart()
  const { data: user } = useMe()
  const createOrder = useCreateOrder()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  if (isPending) return <CartSkeleton />
  if (isError) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <h1 className="mb-4 text-2xl font-bold">سلة التسوّق</h1>
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-14">
        <h1 className="mb-6 text-2xl font-bold">سلة التسوّق</h1>
        <EmptyState
          icon={<ShoppingBag className="size-8" aria-hidden="true" />}
          title="سلة التسوّق فارغة"
          description="لم تُضف أي عطور إلى سلتك بعد. تصفّح تشكيلة نسائم ليبيا الفاخرة واختر ما يناسب ذوقك."
          action={
            <Button asChild size="lg" className="rounded-xl font-bold">
              <Link to="/products">تصفّح العطور الآن</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const proceed = async () => {
    setCheckoutError(null)
    if (!user) {
      navigate('/login?next=%2Fcart')
      return
    }
    try {
      const order = await createOrder.mutateAsync({})
      navigate(`/checkout/${order.id}`)
    } catch (failure) {
      setCheckoutError(
        failure instanceof ApiError ? failure.message : 'تعذّر إنشاء الطلب، حاول مرة أخرى',
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 animate-fade-rise space-y-6">
      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">سلة المشتريات</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            لديك <span className="font-bold text-foreground font-mono">{cart.items.length}</span> أصناف في سلتك
          </p>
        </div>
        <Link
          to="/products"
          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          <span>إضافة المزيد من العطور</span>
          <ArrowRight className="size-3.5 rtl:rotate-180" />
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        {/* Cart Items List */}
        <div className="space-y-4">
          <ul className="space-y-3">
            {cart.items.map((line) => (
              <CartLineItem key={line.id} line={line} />
            ))}
          </ul>

          <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
            <Truck className="size-5 text-primary shrink-0" />
            <span>يتم احتساب رسوم التوصيل الدقيقة بناءً على مدينتك في الخطوة التالية.</span>
          </div>
        </div>

        {/* Desktop Sticky Summary */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <LoyaltyVipBadge />
          <DiscountForm currentCode={cart.discount_code} error={cart.discount_error} />
          
          <div className="rounded-2xl border border-border bg-card p-5 shadow-xs space-y-4">
            <OrderSummary
              subtotal={cart.subtotal}
              discountTotal={cart.discount_total}
              shippingTotal={cart.shipping_total}
              total={cart.total}
              shippingNote="يُحدد حسب المدينة عند الدفع"
            />

            {checkoutError ? (
              <p role="alert" className="text-xs font-semibold text-destructive">
                {checkoutError}
              </p>
            ) : null}

            <Button
              size="lg"
              block
              loading={createOrder.isPending}
              onClick={proceed}
              className="rounded-xl font-bold text-sm h-12 shadow-sm"
            >
              متابعة الشراء
            </Button>

            <Button asChild variant="outline" block className="rounded-xl font-semibold text-xs h-10">
              <Link to="/products">مواصلة التسوّق</Link>
            </Button>

            <div className="border-t border-border/80 pt-3 text-center space-y-1">
              <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <ShieldCheck className="size-3.5 text-emerald-500" />
                <span>دفع آمن 100% ومشفر</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className="pt-4">
        <DiscoveryBoxBanner />
      </div>
    </div>
  )
}

function CartLineItem({ line }: { line: CartLine }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()

  return (
    <li className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-2xs hover:border-primary/30 transition-all">
      <Link
        to={`/products/${encodeURIComponent(line.slug)}`}
        className="shrink-0 focus-visible:outline-2 focus-visible:outline-ring"
      >
        {line.image ? (
          <img
            src={line.image.renditions?.thumb || line.image.url}
            alt=""
            width={84}
            height={84}
            loading="lazy"
            className="size-20 sm:size-24 rounded-xl bg-muted/40 object-cover border border-border"
          />
        ) : (
          <span className="block size-20 sm:size-24 rounded-xl bg-muted border border-border" aria-hidden="true" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-bold leading-snug text-foreground">
              <Link
                to={`/products/${encodeURIComponent(line.slug)}`}
                className="line-clamp-2 hover:text-primary transition-colors"
              >
                {line.name}
              </Link>
            </h2>
            {line.variant_label ? (
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{line.variant_label}</p>
            ) : null}
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              سعر القطعة: {formatPrice(line.unit_price)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => remove.mutate(line.id)}
            aria-label={`حذف ${line.name} من السلة`}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <QuantityStepper
            value={line.quantity}
            max={line.available_stock ?? undefined}
            onChange={(quantity) => update.mutate({ id: line.id, quantity })}
            label={`كمية ${line.name}`}
          />
          <span className="font-mono text-sm sm:text-base font-extrabold text-price">
            {formatPrice(line.total_price)}
          </span>
        </div>
      </div>
    </li>
  )
}

function DiscountForm({
  currentCode,
  error,
}: {
  currentCode: string
  error: string | null
}) {
  const [code, setCode] = useState(currentCode)
  const apply = useApplyDiscount()
  const message = apply.error instanceof ApiError ? apply.error.message : error

  return (
    <form
      className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-2xs"
      onSubmit={(event) => {
        event.preventDefault()
        const trimmed = code.trim()
        if (trimmed) apply.mutate(trimmed)
      }}
    >
      <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
        <Percent className="size-3.5 text-primary" />
        <span>هل لديك كوبون خصم؟</span>
      </div>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="أدخل كود الخصم…"
          className="h-10 rounded-xl font-mono uppercase text-xs"
        />
        <Button
          type="submit"
          variant="outline"
          loading={apply.isPending}
          disabled={!code.trim()}
          className="rounded-xl text-xs font-bold px-4 h-10 shrink-0"
        >
          تطبيق
        </Button>
      </div>
      {currentCode && !message && (
        <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
          <Check className="size-3" />
          <span>تم تطبيق الكوبون بنجاح ({currentCode})</span>
        </p>
      )}
      {message ? (
        <p role="alert" className="text-[11px] font-semibold text-destructive">
          {message}
        </p>
      ) : null}
    </form>
  )
}

function CartSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    </div>
  )
}
