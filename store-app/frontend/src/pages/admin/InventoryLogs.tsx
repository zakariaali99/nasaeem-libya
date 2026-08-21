import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DataTable, type Column } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useInventoryLogs } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { InventoryLog } from '@/types/api'

const REASONS = [
  ['', 'كل الأسباب'],
  ['restock', 'إعادة تخزين'],
  ['sale', 'بيع'],
  ['reservation', 'حجز'],
  ['release', 'إلغاء حجز'],
  ['return', 'مرتجع'],
  ['correction', 'تصحيح'],
  ['manual', 'تعديل يدوي'],
] as const

export default function AdminInventoryLogsPage() {
  usePageTitle('سجل المخزون — لوحة التحكم')
  const { get, set } = useUrlState()
  const page = Number(get('page') || 1)
  const reason = get('reason')

  const query = useInventoryLogs({ page, reason: reason || undefined })

  const columns: Column<InventoryLog>[] = [
    {
      key: 'created_at',
      header: 'التاريخ',
      cell: (row) => <span className="text-muted-foreground">{formatDateTime(row.created_at)}</span>,
    },
    {
      key: 'product',
      header: 'المنتج',
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.product_name}</p>
          {row.variant_sku ? <p className="text-xs text-muted-foreground">{row.variant_sku}</p> : null}
        </div>
      ),
    },
    {
      key: 'change',
      header: 'التغيير',
      cell: (row) =>
        row.change > 0 ? (
          <Badge tone="success">+{formatNumber(row.change)}</Badge>
        ) : (
          <Badge tone="danger">{formatNumber(row.change)}</Badge>
        ),
    },
    { key: 'reason', header: 'السبب', cell: (row) => row.reason_label },
    { key: 'user', header: 'بواسطة', cell: (row) => row.user_name || 'النظام' },
    { key: 'note', header: 'ملاحظة', cell: (row) => row.note || '—' },
  ]

  return (
    <>
      <PageHeader
        title="سجل المخزون"
        description="سجل غير قابل للتعديل لكل حركة مخزون — من غيّر، وكم، ولماذا."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/inventory">
              <ArrowRight aria-hidden="true" />
              العودة للمخزون
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error ? { message: 'تعذّر تحميل السجل' } : null}
        onRetry={() => query.refetch()}
        page={page}
        pages={query.data?.meta?.pages ?? 1}
        total={query.data?.meta?.total}
        onPageChange={(next) => set({ page: next })}
        toolbar={
          <Select
            value={reason}
            onChange={(event) => set({ reason: event.target.value })}
            aria-label="تصفية حسب السبب"
            className="w-48"
          >
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        }
        emptyTitle="لا توجد حركات بعد"
        emptyDescription="ستظهر هنا كل تعديلات المخزون تلقائياً."
      />
    </>
  )
}
