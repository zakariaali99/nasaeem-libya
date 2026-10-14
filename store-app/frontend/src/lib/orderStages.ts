import { CheckCircle2, Clock, Package, RotateCcw, Truck, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { formatPrice } from '@/lib/format'
import type { OrderStage, StageEffect } from '@/types/api'

export interface StageInfo {
  value: OrderStage
  label: string
  icon: LucideIcon
  /** Token classes for the coloured pill / select. */
  tone: string
}

/** The six stages, in delivery order. Mirrors `OrderStage` on the server. */
export const STAGES: StageInfo[] = [
  { value: 'new', label: 'جديد', icon: Clock, tone: 'bg-warning/10 text-warning border-warning/30' },
  { value: 'preparing', label: 'قيد التجهيز', icon: Package, tone: 'bg-primary/10 text-primary border-primary/30' },
  { value: 'out_for_delivery', label: 'خرج للتوصيل', icon: Truck, tone: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30' },
  { value: 'delivered', label: 'تم التسليم', icon: CheckCircle2, tone: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  { value: 'returned', label: 'مرتجع', icon: RotateCcw, tone: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30' },
  { value: 'cancelled', label: 'ملغي', icon: XCircle, tone: 'bg-destructive/10 text-destructive border-destructive/30' },
]

export const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((s) => [s.value, s])) as Record<OrderStage, StageInfo>

/** The usual next step, for the one-click button. */
export const NEXT_STAGE: Partial<Record<OrderStage, OrderStage>> = {
  new: 'preparing',
  preparing: 'out_for_delivery',
  out_for_delivery: 'delivered',
}

/** One line, in the operator's words, for what a stage change did or will do. */
export function describeEffect(effect: StageEffect): string {
  const what = effect.item ? `${effect.quantity} × «${effect.item}»` : ''
  switch (effect.kind) {
    case 'stock_out':
      return `يخرج من المخزن: ${what}`
    case 'reservation_released':
      return `يُلغى حجز: ${what}`
    case 'stock_back':
      return `يرجع إلى المخزون: ${what}`
    case 'damaged':
      return `تالف، لا يرجع للمخزون: ${what}`
    case 'reserved':
      return `يُحجز من جديد: ${what}`
    case 'back_to_reserved':
      return `يرجع من الطريق ويبقى محجوزاً: ${what}`
    case 'sale_booked':
      return `يُسجَّل المبلغ محصّلاً: ${formatPrice(effect.amount ?? '0')}`
    case 'sale_reversed':
      return `يُلغى تسجيل التحصيل: ${formatPrice(effect.amount ?? '0')}`
    default:
      return ''
  }
}
