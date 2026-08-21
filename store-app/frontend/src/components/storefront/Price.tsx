import { cn } from '@/lib/utils'
import { discountPercent, formatPrice } from '@/lib/format'

export interface PriceProps {
  price: number | string | null | undefined
  compareAtPrice?: number | string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZES = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' } as const

/**
 * The current price, and the struck-through `compare_at_price` beside it.
 *
 * **The badge, the struck price and the charged price come from these same two
 * numbers.** The reference gave the badge its own field and shipped a "20% off"
 * badge next to an undiscounted price — a discount the number did not reflect.
 * Here disagreement is not possible: there is one input.
 */
export function Price({ price, compareAtPrice, size = 'md', className }: PriceProps) {
  const percent = discountPercent(price, compareAtPrice)
  const onSale = percent !== null

  return (
    <span className={cn('inline-flex flex-wrap items-baseline gap-2', className)}>
      <span
        className={cn('font-bold tabular-nums', SIZES[size], onSale ? 'text-price-sale' : 'text-price')}
      >
        {formatPrice(price)}
      </span>
      {onSale ? (
        <s className="text-sm tabular-nums text-muted-foreground" aria-label="السعر قبل الخصم">
          {formatPrice(compareAtPrice)}
        </s>
      ) : null}
    </span>
  )
}
