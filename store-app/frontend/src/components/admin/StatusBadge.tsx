import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'

const LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  processing: 'قيد المعالجة',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  refunded: 'مسترجع',
  accepted: 'تم القبول',
  delivered: 'تم التوصيل',
  returned: 'مرتجع',
  waiting_for_verification: 'بانتظار التحقق',
  failed: 'فشل',
}

const TONES: Record<string, 'success' | 'warning' | 'primary' | 'danger' | 'neutral'> = {
  pending: 'warning',
  processing: 'primary',
  accepted: 'primary',
  completed: 'success',
  delivered: 'success',
  cancelled: 'danger',
  refunded: 'danger',
  returned: 'danger',
  waiting_for_verification: 'warning',
  failed: 'danger',
}

const ICONS: Record<string, React.ElementType> = {
  pending: Clock,
  processing: Package,
  accepted: Truck,
  completed: CheckCircle2,
  delivered: CheckCircle2,
  cancelled: XCircle,
  refunded: RotateCcw,
  returned: RotateCcw,
  waiting_for_verification: Clock,
  failed: AlertCircle,
}

export function StatusBadge({ status, showIcon = true }: { status: string; showIcon?: boolean }) {
  const tone = TONES[status] ?? 'neutral'
  const label = LABELS[status] ?? status
  const Icon = ICONS[status]
  const isLive = status === 'pending' || status === 'processing' || status === 'waiting_for_verification'

  return (
    <Badge tone={tone} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold">
      {isLive ? (
        <span className="pulse-dot size-2 shrink-0 bg-current" aria-hidden="true" />
      ) : showIcon && Icon ? (
        <Icon className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{label}</span>
    </Badge>
  )
}
