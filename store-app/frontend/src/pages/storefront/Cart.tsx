import { ShoppingBag, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { OrderSummary } from '@/components/storefront/OrderSummary'
import { QuantityStepper } from '@/components/storefront/QuantityStepper'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import {
  useApplyDiscount,
  useCart,
  useCreateOrder,
  useRemoveCartItem,
  useUpdateCartItem,
} from '@/lib/queries/cart'
import { useMe } from '@/lib/queries/auth'
import { usePageTitle } from '@/lib/usePageTitle'
import type { CartLine } from '@/types/api'

export default function CartPage() {
  usePageTitle('سلة التسوّق', 'راجع منتجاتك قبل إتمام الطلب.')

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
          title="سلتك فارغة"
          description="لم تُضف أي منتج بعد. تصفّح العطور والأطقم واختر ما يناسبك."
          action={
            <Button asChild size="lg">
              <Link to="/products">تصفّح المنتجات</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const proceed = async () => {
    setCheckoutError(null)
    if (!user) {
      // Auth is required at checkout, not at add-to-cart. The basket survives
      // the round trip: it merges into the account on login.
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
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">سلة التسوّق</h1>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {cart.items.map((line) => (
            <CartLineItem key={line.id} line={line} />
          ))}
        </ul>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <DiscountForm currentCode={cart.discount_code} error={cart.discount_error} />
          <OrderSummary
            subtotal={cart.subtotal}
            discountTotal={cart.discount_total}
            shippingTotal={cart.shipping_total}
            total={cart.total}
            shippingNote="تُحتسب رسوم التوصيل بعد اختيار المنطقة"
          />
          {checkoutError ? (
            <p role="alert" className="text-sm text-destructive">
              {checkoutError}
            </p>
          ) : null}
          <Button size="lg" block loading={createOrder.isPending} onClick={proceed}>
            متابعة الشراء
          </Button>
          <Button asChild variant="ghost" block>
            <Link to="/products">مواصلة التسوّق</Link>
          </Button>
        </aside>
      </div>
    </div>
  )
}

function CartLineItem({ line }: { line: CartLine }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()

  return (
    <li className="flex gap-3 rounded-lg border border-border bg-card p-3">
      <Link
        to={`/products/${encodeURIComponent(line.slug)}`}
        className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {line.image ? (
          <img
            src={line.image.renditions?.thumb || line.image.url}
            alt=""
            width={80}
            height={80}
            loading="lazy"
            className="size-20 rounded-md bg-muted object-cover"
          />
        ) : (
          <span className="block size-20 rounded-md bg-muted" aria-hidden="true" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-medium leading-snug">
              <Link
                to={`/products/${encodeURIComponent(line.slug)}`}
                className="line-clamp-2 hover:text-primary"
              >
                {line.name}
              </Link>
            </h2>
            {line.variant_label ? (
              <p className="text-sm text-muted-foreground">{line.variant_label}</p>
            ) : null}
            <p className="text-sm text-muted-foreground">
              سعر الوحدة: {formatPrice(line.unit_price)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => remove.mutate(line.id)}
            aria-label={`حذف ${line.name} من السلة`}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Trash2 className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <QuantityStepper
            value={line.quantity}
            max={line.available_stock ?? undefined}
            onChange={(quantity) => update.mutate({ id: line.id, quantity })}
            label={`كمية ${line.name}`}
          />
          <span className="text-base font-bold tabular-nums text-price">
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
      className="space-y-2 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (code.trim()) apply.mutate(code.trim())
      }}
    >
      <label htmlFor="discount-code" className="text-sm font-medium">
        كود الخصم
      </label>
      <div className="flex gap-2">
        <Input
          id="discount-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="أدخل الكود"
          aria-invalid={Boolean(message)}
          aria-describedby={message ? 'discount-error' : undefined}
        />
        <Button type="submit" variant="outline" loading={apply.isPending}>
          تطبيق
        </Button>
      </div>
      {message ? (
        <p id="discount-error" role="alert" className="text-sm text-destructive">
          {message}
        </p>
      ) : null}
      {currentCode && !message ? (
        <p className="text-sm text-success">تم تطبيق الكود «{currentCode}»</p>
      ) : null}
    </form>
  )
}

function CartSkeleton() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6" aria-busy="true">
      <span className="sr-only" role="status">
        جارٍ تحميل السلة…
      </span>
      <Skeleton className="mb-6 h-9 w-40" />
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}
