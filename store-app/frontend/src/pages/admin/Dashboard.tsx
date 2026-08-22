import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useDashboardStats } from '@/lib/queries/orders'
import { formatNumber, formatPrice } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'

export default function Dashboard() {
  const { data, isPending } = useDashboardStats()

  if (isPending || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }

  const maxRevenue = Math.max(...data.series.map((d) => Number(d.revenue)), 1)

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">لوحة الإدارة والتحكم</h1>
          <p className="text-sm text-muted-foreground mt-1">
            نظرة عامة على أداء المبيعات، الطلبات، والعمليات اللوجستية لمتجر نسائم ليبيا
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/orders"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <span>إدارة الطلبات</span>
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>

      {/* KPI Tiles Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Orders */}
        <Link
          to="/admin/orders?status=pending"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-amber-500/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">طلبات بانتظار التأكيد</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {formatNumber(data.pending_orders)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-amber-600 transition-colors">
            <span>عرض الطلبات الجديدة</span>
            <span className="font-sans">←</span>
          </div>
        </Link>

        {/* Processing Orders */}
        <Link
          to="/admin/orders?status=processing"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-sky-500/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">قيد المعالجة والتجهيز</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Package className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-sky-600 dark:text-sky-400">
            {formatNumber(data.processing_orders)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-sky-600 transition-colors">
            <span>متابعة التجهيز والشحن</span>
            <span className="font-sans">←</span>
          </div>
        </Link>

        {/* Completed Orders */}
        <Link
          to="/admin/orders?status=completed"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs transition-all duration-200 hover:shadow-md hover:border-emerald-500/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">طلبات مكتملة ومسلمة</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatNumber(data.completed_orders)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground group-hover:text-emerald-600 transition-colors">
            <span>عرض السجل المكتمل</span>
            <span className="font-sans">←</span>
          </div>
        </Link>

        {/* Month Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">إيرادات الشهر الحالي</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DollarSign className="size-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold font-mono text-primary">
            {formatPrice(data.month_revenue)}
          </p>
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600 font-semibold">
            <TrendingUp className="size-3.5" />
            <span>مبيعات نشطة</span>
          </div>
        </div>
      </div>

      {/* Secondary Metrics Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          to="/admin/orders"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-primary/40 transition-colors"
        >
          <div>
            <span className="text-xs text-muted-foreground">طلبات اليوم</span>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">
              {formatNumber(data.today_orders)}
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Clock className="size-5" />
          </div>
        </Link>

        <Link
          to="/admin/users"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-primary/40 transition-colors"
        >
          <div>
            <span className="text-xs text-muted-foreground">إجمالي العملاء المسجلين</span>
            <p className="text-xl font-bold font-mono text-foreground mt-0.5">
              {formatNumber(data.customers)}
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Users className="size-5" />
          </div>
        </Link>

        <Link
          to="/admin/inventory"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-4 shadow-xs hover:border-amber-500/40 transition-colors"
        >
          <div>
            <span className="text-xs text-muted-foreground">تنبيهات مخزون منخفض</span>
            <p className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
              {formatNumber(data.low_stock)}
            </p>
          </div>
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-5" />
          </div>
        </Link>
      </div>

      {/* Revenue Chart Section */}
      <section className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
          <div>
            <h2 className="font-bold text-foreground">مخطط الإيرادات اليومية (آخر 14 يوماً)</h2>
            <p className="text-xs text-muted-foreground">تتبع الإيرادات اليومية بالدينار الليبي</p>
          </div>
          <div className="text-end">
            <span className="text-xs text-muted-foreground">الإجمالي التراكمي:</span>
            <p className="font-mono text-lg font-bold text-primary">{formatPrice(data.revenue_total)}</p>
          </div>
        </div>

        {/* Pure CSS bars with RTL mirroring */}
        <div dir="ltr" className="flex h-44 items-end gap-2 pt-4">
          {[...data.series].reverse().map((day) => {
            const height = Math.max(
              (Number(day.revenue) / maxRevenue) * 100,
              Number(day.revenue) > 0 ? 6 : 2,
            )
            return (
              <div
                key={day.date}
                className="group relative flex-1 flex flex-col items-center h-full justify-end"
              >
                {/* Tooltip */}
                <div className="pointer-events-none absolute -top-8 hidden rounded-md bg-foreground px-2 py-1 text-[10px] font-bold text-background shadow-xs group-hover:block whitespace-nowrap z-10">
                  {day.date}: {formatPrice(day.revenue)}
                </div>

                <div
                  className="w-full rounded-t-md bg-primary/80 transition-all duration-300 group-hover:bg-primary"
                  style={{ height: `${height}%` }}
                />
                <span className="mt-2 text-[10px] text-muted-foreground truncate w-full text-center">
                  {day.date.slice(5)}
                </span>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
