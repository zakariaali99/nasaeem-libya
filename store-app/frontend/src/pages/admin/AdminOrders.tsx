import { Eye, FilterX, MessageCircle, Printer, User, X, Zap } from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/admin/DataTable'
import { OrderQuickView } from '@/components/admin/OrderQuickView'
import { OrderStageSelect } from '@/components/admin/OrderStageSelect'
import { QuickOrderModal } from '@/components/admin/QuickOrderModal'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { FEATURES } from '@/lib/features'
import { formatNumber, formatPrice, whatsappUrl } from '@/lib/format'
import { STAGE_BY_VALUE, STAGES } from '@/lib/orderStages'
import { useBulkOrderAction, useMyOrders, useStageCounts } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import { cn } from '@/lib/utils'
import type { Order, OrderStage } from '@/types/api'

/** The stages shown as counters above the list — the ones that need work. */
const KPI_STAGES: OrderStage[] = ['new', 'preparing', 'out_for_delivery', 'delivered']

const rowIcon =
  'inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export default function AdminOrders() {
  usePageTitle('إدارة الطلبات والمبيعات — لوحة التحكم')
  const navigate = useNavigate()
  const url = useUrlState({ search: '', stage: '', page: '1' })
  const currentStage = String(url.get('stage') ?? '') as OrderStage | ''
  const currentSearch = String(url.get('search') ?? '')
  const page = Number(url.get('page')) || 1

  const [quickOrderOpen, setQuickOrderOpen] = React.useState(false)
  const [viewing, setViewing] = React.useState<string | null>(null)
  const [feedback, setFeedback] = React.useState<{ text: string; failed?: string[] } | null>(null)

  const query = useMyOrders({
    search: currentSearch || undefined,
    stage: currentStage || undefined,
    page,
    limit: 20,
  })
  const counts = useStageCounts()
  const bulkAction = useBulkOrderAction()

  const orders = query.data?.items ?? []
  const totalOrders = query.data?.meta?.total ?? 0

  const flash = (text: string, failed?: string[]) => {
    setFeedback({ text, failed })
    window.setTimeout(() => setFeedback(null), failed?.length ? 9000 : 4000)
  }

  const moveSelected = async (stage: OrderStage, ids: string[], clear: () => void) => {
    if (!ids.length) return
    if (stage === 'cancelled' && !window.confirm(`إلغاء ${ids.length} طلبات؟ يرجع المخزون المحجوز لها.`)) return
    try {
      const result = await bulkAction.mutateAsync({ order_ids: ids, action: stage })
      flash(result.message, result.failed.map((f) => `#${f.order_number}: ${f.reason}`))
      clear()
    } catch (err) {
      flash(err instanceof Error ? err.message : 'حدث خطأ أثناء تنفيذ العملية الجماعية')
    }
  }

  const filterChips = [
    {
      id: 'all',
      label: `كل الطلبات (${formatNumber(counts.data?.all ?? totalOrders)})`,
      active: !currentStage,
      onClick: () => url.set({ stage: '', page: 1 }),
    },
    ...STAGES.map((stage) => ({
      id: stage.value,
      label: `${stage.label}${counts.data ? ` (${formatNumber(counts.data[stage.value])})` : ''}`,
      active: currentStage === stage.value,
      onClick: () => url.set({ stage: stage.value, page: 1 }),
    })),
  ]

  const columns = [
    {
      key: 'order_number',
      header: 'رقم وتاريخ الطلب',
      cell: (order: Order) => (
        <div className="space-y-0.5">
          <span className="block font-mono text-xs font-bold text-foreground transition-colors group-hover:text-primary sm:text-sm">
            #{order.order_number}
          </span>
          <span className="block font-mono text-[11px] text-muted-foreground">
            {new Date(order.created_at).toLocaleDateString('ar-LY', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'user',
      header: 'العميل',
      cell: (o: Order) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
            {o.user?.name ? o.user.name.charAt(0) : <User className="size-3.5" />}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-xs font-bold text-foreground sm:text-sm">
              {o.user?.name || 'عميل المتجر'}
            </span>
            <span className="block font-mono text-[11px] text-muted-foreground">
              {o.user?.phone_number || '—'}
              {o.city_name ? ` · ${o.city_name}` : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'القيمة',
      cell: (o: Order) => (
        <div className="space-y-0.5">
          <span className="block font-mono text-xs font-extrabold text-price sm:text-sm">{formatPrice(o.total)}</span>
          <span className="text-[11px] font-semibold text-muted-foreground">
            {o.items?.length === 1 ? 'صنف واحد' : `${o.items?.length ?? 0} أصناف`}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'stage',
      header: 'المرحلة',
      cell: (o: Order) => (
        <OrderStageSelect order={o} size="sm" onChanged={(stage) => flash(`#${o.order_number}: ${STAGE_BY_VALUE[stage].label}`)} />
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      align: 'end' as const,
      cell: (o: Order) => {
        const chat = o.user?.phone_number ? whatsappUrl(o.user.phone_number) : null
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button type="button" className={rowIcon} onClick={() => setViewing(o.id)} aria-label={`عرض سريع للطلب #${o.order_number}`} title="عرض سريع">
              <Eye className="size-4" aria-hidden="true" />
            </button>
            {chat ? (
              <a href={chat} target="_blank" rel="noopener noreferrer" className={rowIcon} aria-label={`واتساب العميل — #${o.order_number}`} title="واتساب العميل">
                <MessageCircle className="size-4" aria-hidden="true" />
              </a>
            ) : null}
            <Link to={`/admin/orders/${o.id}/invoice`} className={rowIcon} aria-label={`فاتورة الطلب #${o.order_number}`} title="الفاتورة">
              <Printer className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="إدارة الطلبات والمبيعات"
        description="غيّر مرحلة أي طلب من القائمة مباشرة، والمخزون والمبالغ تتبعها تلقائياً"
        action={
          <Button
            onClick={() => setQuickOrderOpen(true)}
            className="h-10 gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90"
          >
            <Zap className="size-4" />
            <span>إضافة طلب يدوي</span>
          </Button>
        }
      />

      {feedback && (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs font-bold text-primary animate-fade-rise"
        >
          <div className="space-y-1">
            <p>{feedback.text}</p>
            {feedback.failed?.map((line) => (
              <p key={line} className="font-medium text-destructive">{line}</p>
            ))}
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-primary hover:opacity-80" aria-label="إغلاق">
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Counters across all orders (not just this page); each one filters. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_STAGES.map((value) => {
          const stage = STAGE_BY_VALUE[value]
          return (
            <button
              key={value}
              type="button"
              onClick={() => url.set({ stage: value, page: 1 })}
              className={cn(
                'space-y-1 rounded-2xl border bg-card p-4 text-start shadow-2xs transition-colors hover:border-primary/50',
                currentStage === value ? 'border-primary ring-1 ring-primary/30' : 'border-border',
              )}
            >
              <span className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{stage.label}</span>
                <stage.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="block font-mono text-xl font-black text-foreground sm:text-2xl">
                {counts.data ? formatNumber(counts.data[value]) : '—'}
              </span>
            </button>
          )
        })}
      </div>

      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(o: Order) => o.id}
        isLoading={query.isPending}
        total={totalOrders}
        pages={query.data?.meta?.pages ?? 1}
        page={page}
        onPageChange={(next) => url.set({ page: next })}
        search={currentSearch}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        searchPlaceholder="ابحث برقم الطلب، اسم العميل، أو رقم الهاتف..."
        filterChips={filterChips}
        bulkActions={(selected, clear) => (
          <div className="flex flex-wrap items-center gap-2">
            {FEATURES.shipping && (
              <Button asChild size="sm" variant="outline" className="h-8 rounded-lg text-xs font-bold">
                <Link to={`/admin/orders/batch-waybills?ids=${selected.join(',')}`}>
                  <Printer className="me-1 size-3.5" />
                  <span>طباعة البوالص ({selected.length})</span>
                </Link>
              </Button>
            )}
            <span className="text-xs font-bold text-muted-foreground">نقل المحدد إلى:</span>
            {STAGES.map((stage) => (
              <Button
                key={stage.value}
                size="sm"
                variant="outline"
                disabled={bulkAction.isPending}
                onClick={() => moveSelected(stage.value, selected, clear)}
                className={cn('h-8 gap-1 rounded-lg border text-xs font-bold', stage.tone)}
              >
                <stage.icon className="size-3.5" aria-hidden="true" />
                {stage.label}
              </Button>
            ))}
          </div>
        )}
        toolbar={
          currentStage || currentSearch ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => url.set({ stage: '', search: '', page: 1 })}
              className="h-10 gap-1.5 rounded-xl border-destructive/30 text-xs font-bold text-destructive hover:bg-destructive/10"
            >
              <FilterX className="size-3.5" />
              <span>مسح الفلاتر</span>
            </Button>
          ) : null
        }
        onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
        emptyTitle="لا توجد طلبات مطابقة"
        emptyDescription="جرّب تعديل عبارة البحث أو اختيار مرحلة أخرى من الأعلى."
      />

      <OrderQuickView orderId={viewing} onOpenChange={(open) => !open && setViewing(null)} onChanged={(text) => flash(text)} />
      <QuickOrderModal open={quickOrderOpen} onOpenChange={setQuickOrderOpen} />
    </div>
  )
}
