import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FilterX,
  Loader2,
  PackageCheck,
  Printer,
  ShoppingBag,
  Trash2,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { DataTable } from '@/components/admin/DataTable'
import { QuickOrderModal } from '@/components/admin/QuickOrderModal'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Button } from '@/components/ui/button'
import { formatNumber, formatPrice } from '@/lib/format'
import { useBulkOrderAction, useMyOrders } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { Order } from '@/types/api'

export default function AdminOrders() {
  usePageTitle('إدارة الطلبات والمبيعات — لوحة التحكم')
  const navigate = useNavigate()
  const url = useUrlState({ search: '', status: '', shipping: '', page: '1' })
  const params = { get: (k: string) => String(url.get(k) ?? '') }
  const currentStatus = params.get('status')
  const currentShipping = params.get('shipping')
  const currentSearch = params.get('search')

  const [quickOrderOpen, setQuickOrderOpen] = React.useState(false)
  const [bulkFeedback, setBulkFeedback] = React.useState<string | null>(null)

  const query = useMyOrders({
    search: currentSearch || undefined,
    status: currentStatus || undefined,
    page: params.get('page'),
    limit: 20,
  })

  const bulkAction = useBulkOrderAction()

  const orders = query.data?.items ?? []
  const totalOrders = query.data?.meta?.total ?? 0

  const handleBulkAction = async (action: 'mark_processing' | 'mark_shipped' | 'mark_completed' | 'mark_cancelled', targetIds: string[]) => {
    if (!targetIds || targetIds.length === 0) return
    try {
      const res = await bulkAction.mutateAsync({
        order_ids: targetIds,
        action,
      })
      setBulkFeedback(res.message)
      setTimeout(() => setBulkFeedback(null), 4000)
    } catch {
      setBulkFeedback('حدث خطأ أثناء تنفيذ العملية الجماعية')
      setTimeout(() => setBulkFeedback(null), 4000)
    }
  }

  // Calculate quick metrics
  const pendingCount = orders.filter((o) => o.status === 'pending').length
  const processingCount = orders.filter((o) => o.status === 'processing').length
  const completedCount = orders.filter((o) => o.status === 'completed').length

  const hasActiveFilters = Boolean(currentStatus || currentShipping || currentSearch)

  const filterChips = [
    {
      id: 'all',
      label: `كل الطلبات (${totalOrders})`,
      active: !currentStatus && !currentShipping,
      onClick: () => url.set({ status: '', shipping: '', page: 1 }),
    },
    {
      id: 'pending',
      label: 'بانتظار التأكيد',
      active: currentStatus === 'pending',
      onClick: () => url.set({ status: 'pending', page: 1 }),
    },
    {
      id: 'processing',
      label: 'قيد التجهيز والمعالجة',
      active: currentStatus === 'processing',
      onClick: () => url.set({ status: 'processing', page: 1 }),
    },
    {
      id: 'completed',
      label: 'مكتمل ومسلّم',
      active: currentStatus === 'completed',
      onClick: () => url.set({ status: 'completed', page: 1 }),
    },
    {
      id: 'cancelled',
      label: 'ملغي ومسترجع',
      active: currentStatus === 'cancelled',
      onClick: () => url.set({ status: 'cancelled', page: 1 }),
    },
  ]

  const columns = [
    {
      key: 'order_number',
      header: 'رقم وتاريخ الطلب',
      cell: (order: Order) => (
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors block">
            #{order.order_number}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground block">
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
      header: 'العميل ومكان الاستلام',
      cell: (o: Order) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
            {o.user?.name ? o.user.name.charAt(0) : <User className="size-3.5" />}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-xs sm:text-sm text-foreground block truncate">
              {o.user?.name || 'عميل المتجر'}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="font-mono">{o.user?.phone_number || '—'}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'قيمة الطلب والأصناف',
      cell: (o: Order) => (
        <div className="space-y-0.5">
          <span className="font-mono font-extrabold text-price text-xs sm:text-sm block">
            {formatPrice(o.total)}
          </span>
          <span className="text-[11px] text-muted-foreground font-semibold">
            {o.items?.length ?? 1} أصناف عطرية
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'status',
      header: 'حالة الطلب',
      cell: (o: Order) => <StatusBadge status={o.status} />,
    },
    {
      key: 'shipping_status',
      header: 'حالة الشحن والتوصيل',
      cell: (o: Order) => <StatusBadge status={o.shipping_status} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'end' as const,
      cell: (o: Order) => (
        <Link
          to={`/admin/orders/${o.order_number}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-2xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all inline-flex items-center gap-1"
        >
          <span>معالجة الطلب</span>
          <ArrowUpRight className="size-3.5" />
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="إدارة الطلبات والمبيعات"
        description="متابعة طلبات العطور الواردة، تحديث الحالات التشغيلية، ومعالجة الشحنات"
        action={
          <Button
            onClick={() => setQuickOrderOpen(true)}
            className="h-10 px-4 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <Zap className="size-4" />
            <span>إضافة طلب يدوي سريع (⚡)</span>
          </Button>
        }
      />

      {bulkFeedback && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 text-xs font-bold text-primary animate-fade-rise flex items-center justify-between">
          <span>{bulkFeedback}</span>
          <button
            type="button"
            onClick={() => setBulkFeedback(null)}
            className="text-primary hover:opacity-80"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* KPI Metric Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي الطلبات</span>
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">{formatNumber(totalOrders)}</p>
          <p className="text-[11px] text-muted-foreground">طلب مسجل بالمتجر</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>بانتظار التأكيد</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{formatNumber(pendingCount)}</p>
          <p className="text-[11px] text-muted-foreground">تحتاج مراجعة فورية</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>قيد التجهيز والشحن</span>
            <Truck className="size-4 text-sky-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">{formatNumber(processingCount)}</p>
          <p className="text-[11px] text-muted-foreground">في طور التجهيز للمندوب</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>المكتملة والمسلّمة</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatNumber(completedCount)}</p>
          <p className="text-[11px] text-muted-foreground">تم تسليمها للعملاء بنجاح</p>
        </div>
      </div>

      {/* Main Orders DataTable */}
      <DataTable
        columns={columns}
        rows={orders}
        rowKey={(o: Order) => o.id}
        isLoading={query.isPending}
        total={totalOrders}
        pages={query.data?.meta?.pages ?? 1}
        page={Number(params.get('page')) || 1}
        onPageChange={(page) => url.set({ page })}
        search={String(currentSearch)}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        searchPlaceholder="ابحث برقم الطلب، اسم العميل، أو رقم الهاتف..."
        filterChips={filterChips}
        bulkActions={(selected, clear) => (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 text-xs font-bold rounded-lg border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
            >
              <Link to={`/admin/orders/batch-waybills?ids=${selected.join(',')}`}>
                <Printer className="size-3.5 me-1" />
                <span>طباعة البوالص ({selected.length})</span>
              </Link>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkAction.isPending}
              onClick={async () => {
                await handleBulkAction('mark_processing', selected)
                clear()
              }}
              className="h-8 text-xs font-bold rounded-lg border-sky-500/30 text-sky-600 hover:bg-sky-500/10"
            >
              {bulkAction.isPending ? <Loader2 className="size-3 me-1 animate-spin" /> : <Clock className="size-3.5 me-1 text-sky-500" />}
              <span>قيد التجهيز</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkAction.isPending}
              onClick={async () => {
                await handleBulkAction('mark_shipped', selected)
                clear()
              }}
              className="h-8 text-xs font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10"
            >
              {bulkAction.isPending ? <Loader2 className="size-3 me-1 animate-spin" /> : <Truck className="size-3.5 me-1" />}
              <span>تسليم للمندوب</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkAction.isPending}
              onClick={async () => {
                await handleBulkAction('mark_completed', selected)
                clear()
              }}
              className="h-8 text-xs font-bold rounded-lg border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
            >
              {bulkAction.isPending ? <Loader2 className="size-3 me-1 animate-spin" /> : <PackageCheck className="size-3.5 me-1 text-emerald-500" />}
              <span>مكتمل ومسلّم</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={bulkAction.isPending}
              onClick={async () => {
                await handleBulkAction('mark_cancelled', selected)
                clear()
              }}
              className="h-8 text-xs font-bold rounded-lg border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5 me-1" />
              <span>إلغاء</span>
            </Button>
          </div>
        )}
        toolbar={
          hasActiveFilters ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => url.set({ status: '', shipping: '', search: '', page: 1 })}
              className="h-10 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
            >
              <FilterX className="size-3.5" />
              <span>مسح كل الفلاتر</span>
            </Button>
          ) : null
        }
        onRowClick={(order) => navigate(`/admin/orders/${order.order_number}`)}
        emptyTitle="لا توجد طلبات مطابقة"
        emptyDescription="جرّب تعديل عبارة البحث أو اختيار حالة تصفية أخرى من الأعلى."
      />

      {/* Quick Order Modal */}
      <QuickOrderModal open={quickOrderOpen} onOpenChange={setQuickOrderOpen} />
    </div>
  )
}
