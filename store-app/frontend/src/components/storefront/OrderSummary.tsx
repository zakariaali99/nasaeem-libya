import { formatPrice } from '@/lib/format'

export interface OrderSummaryProps {
  subtotal: string
  discountTotal: string
  shippingTotal: string
  total: string
  /** Shown in place of a zero delivery fee before a region is chosen. */
  shippingNote?: string
}

/** The totals block, shared by the cart, the checkout review and the order
 * screens, so the four numbers are laid out identically everywhere and the
 * customer never has to re-read them in a new shape. */
export function OrderSummary({
  subtotal,
  discountTotal,
  shippingTotal,
  total,
  shippingNote,
}: OrderSummaryProps) {
  const hasDiscount = Number(discountTotal) > 0
  const hasShipping = Number(shippingTotal) > 0

  return (
    <dl className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
      <Row label="المجموع الفرعي" value={formatPrice(subtotal)} />
      {hasDiscount ? (
        <Row label="الخصم" value={`− ${formatPrice(discountTotal)}`} tone="discount" />
      ) : null}
      <Row
        label="التوصيل"
        value={hasShipping ? formatPrice(shippingTotal) : shippingNote ?? formatPrice(0)}
        muted={!hasShipping && Boolean(shippingNote)}
      />
      <div className="flex items-baseline justify-between gap-4 border-t border-border pt-2">
        <dt className="text-base font-semibold">الإجمالي</dt>
        <dd className="text-lg font-bold tabular-nums text-price">{formatPrice(total)}</dd>
      </div>
    </dl>
  )
}

function Row({
  label,
  value,
  tone,
  muted = false,
}: {
  label: string
  value: string
  tone?: 'discount'
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          tone === 'discount'
            ? 'tabular-nums text-discount'
            : muted
              ? 'text-end text-xs text-muted-foreground'
              : 'tabular-nums'
        }
      >
        {value}
      </dd>
    </div>
  )
}
