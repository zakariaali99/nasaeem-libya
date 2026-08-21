import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'

export interface StockBadgeProps {
  /** `false` means unlimited — skip every stock check. */
  trackQuantity: boolean
  availableStock: number
  inStock: boolean
  lowStockThreshold?: number
  className?: string
}

/** Three states, each with its own token colour and its own Arabic wording. */
export function StockBadge({
  trackQuantity,
  availableStock,
  inStock,
  lowStockThreshold = 5,
  className,
}: StockBadgeProps) {
  if (!trackQuantity || (inStock && availableStock > lowStockThreshold)) {
    if (!inStock) return <Out className={className} />
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-sm text-in-stock', className)}>
        <Dot className="bg-in-stock" />
        متوفر
      </span>
    )
  }

  if (!inStock) return <Out className={className} />

  // In stock, but the count says zero — the two disagree, so say the safe thing
  // rather than "بقي 0 فقط", which reads as a contradiction.
  if (availableStock <= 0) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-sm text-in-stock', className)}>
        <Dot className="bg-in-stock" />
        متوفر
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-low-stock', className)}>
      <Dot className="bg-low-stock" />
      بقي {formatNumber(availableStock)} فقط
    </span>
  )
}

function Out({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-out-of-stock', className)}>
      <Dot className="bg-out-of-stock" />
      غير متوفر حالياً
    </span>
  )
}

function Dot({ className }: { className: string }) {
  return <span className={cn('size-2 rounded-full', className)} aria-hidden="true" />
}
