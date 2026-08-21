import { Badge } from '@/components/ui/badge'
import { discountPercent, formatPercent } from '@/lib/format'

export interface DiscountBadgeProps {
  price: number | string | null | undefined
  compareAtPrice?: number | string | null
}

/**
 * Derived from the same two prices the card displays — never from a separate
 * field. If there is no real discount the badge does not render at all, so a
 * badge can never contradict the price beside it.
 */
export function DiscountBadge({ price, compareAtPrice }: DiscountBadgeProps) {
  const percent = discountPercent(price, compareAtPrice)
  if (percent === null) return null

  return (
    <Badge tone="discount" aria-label={`خصم ${percent} بالمئة`}>
      خصم {formatPercent(percent)}
    </Badge>
  )
}
