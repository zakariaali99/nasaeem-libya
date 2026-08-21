import { Minus, Plus } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  /** Usually the available stock. `undefined` means unlimited. */
  max?: number
  disabled?: boolean
  label?: string
  className?: string
}

/** Clamped in one place so no caller can produce 0, a negative, or more than
 * the shelf holds — the reference used a raw number input and let all three
 * reach the cart. */
export function clampQuantity(value: number, min: number, max?: number): number {
  const whole = Number.isFinite(value) ? Math.floor(value) : min
  const lower = Math.max(whole, min)
  return max === undefined ? lower : Math.min(lower, Math.max(max, min))
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  label = 'الكمية',
  className,
}: QuantityStepperProps) {
  const set = (next: number) => onChange(clampQuantity(next, min, max))
  const atMin = value <= min
  const atMax = max !== undefined && value >= max

  return (
    <div className={cn('inline-flex items-center rounded-md border border-input', className)}>
      <button
        type="button"
        onClick={() => set(value - 1)}
        disabled={disabled || atMin}
        aria-label="إنقاص الكمية"
        className="inline-flex size-11 items-center justify-center rounded-s-md text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <Minus className="size-5" aria-hidden="true" />
      </button>

      <span
        role="status"
        aria-label={label}
        className="inline-flex h-11 min-w-12 items-center justify-center px-2 text-base font-medium tabular-nums"
      >
        {formatNumber(value)}
      </span>

      <button
        type="button"
        onClick={() => set(value + 1)}
        disabled={disabled || atMax}
        aria-label="زيادة الكمية"
        className="inline-flex size-11 items-center justify-center rounded-e-md text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}
