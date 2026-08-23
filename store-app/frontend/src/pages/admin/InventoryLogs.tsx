import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

import { DataTable, type Column } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useInventoryLogs } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { InventoryLog } from '@/types/api'

export default function AdminInventoryLogsPage() {
  usePageTitle('سجل حركات المخزون — لوحة التحكم')
  const { get, set } = useUrlState()
  const page = Number(get('page') || 1)
  const reason = get('reason')

  const query = useInventoryLogs({ page, reason: reason || undefined })

  const filterChips = [
    {
      id: 'all',
      label: 'كل الحركات',
      active: !reason,
      onClick: () => set({ reason: '', page: 1 }),
    },
    {
      id: 'restock',
      label: 'إعادة تخزين',
      active: reason === 'restock',
      onClick: () => set({ reason: 'restock', page: 1 }),
    },
    {
      id: 'sale',
      label: 'مبيعات',
      active: reason === 'sale',
      onClick: () => set({ reason: 'sale', page: 1 }),
    },
    {
      id: 'return',
      label: 'مرتجع',
      active: reason === 'return',
      onClick: () => set({ reason: 'return', page: 1 }),
    },
    {
      id: 'reservation',
      label: 'حجز للطلبات',
      active: reason === 'reservation',
      onClick: () => set({ reason: 'reservation', page: 1 }),
    },
  ]

  const columns: Column<InventoryLog>[] = [
    {
      key: 'created_at',
      header: 'تاريخ الحركة',
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{formatDateTime(row.created_at)}</span>
      ),
    },
    {
      key: 'product',
      header: 'المنتج والمتغير',
      cell: (row) => (
        <div>
          <p className="font-bold text-foreground text-xs sm:text-sm">{row.product_name}</p>
          {row.variant_sku ? <p className="font-mono text-[11px] text-muted-foreground">{row.variant_sku}</p> : null}
        </div>
      ),
    },
    {
      key: 'change',
      header: 'التغيير بالكمية',
      cell: (row) =>
        row.change > 0 ? (
          <Badge tone="success" className="font-mono text-xs font-bold">
            +{formatNumber(row.change)}
          </Badge>
        ) : (
          <Badge tone="danger" className="font-mono text-xs font-bold">
            {formatNumber(row.change)}
          </Badge>
        ),
    },
    {
      key: 'reason',
      header: 'السبب والنوع',
      cell: (row) => (
        <span className="text-xs font-semibold text-foreground bg-muted/50 px-2 py-0.5 rounded-md border border-border/50">
          {row.reason_label}
        </span>
      ),
    },
    {
      key: 'user',
      header: 'المسؤول',
      cell: (row) => <span className="text-xs text-muted-foreground">{row.user_name || 'النظام التلقائي'}</span>,
    },
    {
      key: 'note',
      header: 'الملاحظة والبيان',
      cell: (row) => <span className="text-xs text-muted-foreground">{row.note || '—'}</span>,
    },
  ]

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="سجل حركات وتدقيق المخزون"
        description="سجل غير قابل للتعديل يوثق جميع عمليات الإضافة، الخصم، المبيعات، وتعديلات الجرد."
        action={
          <Button asChild variant="outline" size="sm" className="rounded-xl font-bold shadow-2xs gap-1.5 h-10 px-4">
            <Link to="/admin/inventory">
              <ArrowRight className="size-4 rtl:rotate-0" aria-hidden="true" />
              <span>العودة لجدول المخزون</span>
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error ? { message: 'تعذّر تحميل سجل المخزون' } : null}
        onRetry={() => query.refetch()}
        page={page}
        pages={query.data?.meta?.pages ?? 1}
        total={query.data?.meta?.total}
        onPageChange={(next) => set({ page: next })}
        filterChips={filterChips}
        emptyTitle="لا توجد حركات مسجلة"
        emptyDescription="ستظهر هنا كل تعديلات المخزون ومبيعات المتجر تلقائياً."
      />
    </div>
  )
}
