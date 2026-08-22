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
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONES[status] ?? 'neutral'}>{LABELS[status] ?? status}</Badge>
}
