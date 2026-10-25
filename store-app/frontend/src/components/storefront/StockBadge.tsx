import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

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
        {t('stock.inStock')}
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
        {t('stock.inStock')}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-low-stock', className)}>
      <Dot className="bg-low-stock" />
      {t('stock.limited')}
    </span>
  )
}

function Out({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm text-out-of-stock', className)}>
      <Dot className="bg-out-of-stock" />
      {t('stock.out')}
    </span>
  )
}

function Dot({ className }: { className: string }) {
  return <span className={cn('size-2 rounded-full', className)} aria-hidden="true" />
}
