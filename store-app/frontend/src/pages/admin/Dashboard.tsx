import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Plus,
  ShoppingBag,
  TrendingUp,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPrice } from '@/lib/format'
import { useDashboardStats, useMyOrders } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'
import type { Order } from '@/types/api'

export default function Dashboard() {
  usePageTitle('لوحة الإدارة والتحكم')
  const [timeframe, setTimeframe] = React.useState<number | string>(14)
  const { data, isPending } = useDashboardStats(timeframe)
  const { data: recentOrdersData, isPending: ordersPending } = useMyOrders({ limit: 5 })
  const [hoveredPoint, setHoveredPoint] = React.useState<{ date: string; revenue: string; x: number; y: number } | null>(null)

  if (isPending || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  const series = [...data.series].reverse() // chronological order
  const revenueValues = series.map((d) => Number(d.revenue))
  const maxRevenue = Math.max(...revenueValues, 100)
  const totalPeriodRevenue = data.timeframe_revenue
    ? Number(data.timeframe_revenue)
    : revenueValues.reduce((a, b) => a + b, 0)

  // Chart coordinate calculations - generous left gutter (140px) so prices have their own dedicated column
  const chartWidth = 840
  const chartHeight = 240
  const paddingLeft = 140
  const paddingRight = 25
  const paddingTop = 24
  const paddingBottom = 45

  const plotWidth = chartWidth - paddingLeft - paddingRight
  const plotHeight = chartHeight - paddingTop - paddingBottom

  const chartPoints = series.map((d, index) => {
    const x = paddingLeft + (index / (series.length - 1 || 1)) * plotWidth
    const y = paddingTop + plotHeight * (1 - Number(d.revenue) / maxRevenue)
    return { x, y, date: d.date, revenue: d.revenue }
  })

  const linePath = chartPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const areaPath = `
    ${linePath}
    L ${paddingLeft + plotWidth} ${paddingTop + plotHeight}
    L ${paddingLeft} ${paddingTop + plotHeight}
    Z
  `

  const totalOrders =
    data.pending_orders + data.processing_orders + data.completed_orders + data.cancelled_orders

  const deliverySuccessRate =
    totalOrders > 0
      ? Math.round((data.completed_orders / totalOrders) * 100)
      : 0

  const timeframes: { label: string; value: number | string }[] = [
    { label: '7 أيام', value: 7 },
    { label: '14 يوماً', value: 14 },
    { label: '30 يوماً', value: 30 },
    { label: '90 يوماً', value: 90 },
    { label: 'الشهر الحالي', value: 'month' },
    { label: 'السنة الحالية', value: 'year' },
  ]

  const activeTimeframeLabel = timeframes.find((t) => t.value === timeframe)?.label || 'الفترة المحددة'

  return (
    <div className="space-y-8 animate-fade-rise">
      {/* Low stock warning banner */}
      {data.low_stock > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-300">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold">تنبيه مستويات المخزون</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                يوجد <span className="font-bold">{formatNumber(data.low_stock)}</span> منتجات قاربت على النفاد وتحتاج إلى إعادة طلب.
              </p>
            </div>
          </div>
          <Link
            to="/admin/inventory"
            className="text-xs font-bold text-amber-700 dark:text-amber-300 underline hover:no-underline"
          >
            عرض المنتجات المنخفضة ←
          </Link>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">لوحة التحكم والعمليات</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            نظرة شاملة على أداء المتجر، المبيعات اللحظية، والعمليات اللوجستية في ليبيا
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/products/new"
            className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground shadow-2xs hover:bg-muted transition-colors"
          >
            <Plus className="size-4 text-primary" />
            <span>منتج جديد</span>
          </Link>
          <Link
            to="/admin/orders"
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
          >
            <ShoppingBag className="size-4" />
            <span>متابعة الطلبات</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Grid (4 columns) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إجمالي الإيرادات (المؤكدة)</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Coins className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-extrabold font-mono text-price truncate">{formatPrice(data.revenue_total)}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <TrendingUp className="size-3.5" />
            <span>{formatNumber(data.customers)} عميل مسجل بالمتجر</span>
          </div>
        </div>

        {/* Orders In Processing */}
        <Link
          to="/admin/orders?status=processing"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">طلبات قيد التجهيز والشحن</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-105 transition-transform">
              <Clock className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-extrabold font-mono text-foreground">{formatNumber(data.processing_orders)}</p>
            {data.pending_orders > 0 && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                +{data.pending_orders} جديدة
              </span>
            )}
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <span>{data.today_orders} طلب جديد اليوم</span>
          </div>
        </Link>

        {/* Completed Orders */}
        <Link
          to="/admin/orders?status=completed"
          className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">الطلبات المسلمة بنجاح</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-extrabold font-mono text-foreground">{formatNumber(data.completed_orders)}</p>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <TrendingUp className="size-3.5" />
            <span>
              {totalOrders > 0
                ? `تسليم ناجح بنسبة ${deliverySuccessRate}%`
                : 'لا توجد طلبات مكتملة بعد'}
            </span>
          </div>
        </Link>

        {/* Month Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">إيرادات الشهر الحالي</span>
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <DollarSign className="size-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <p className="text-2xl font-extrabold font-mono text-primary truncate">{formatPrice(data.month_revenue)}</p>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            <TrendingUp className="size-3.5" />
            <span>مبيعات تراكمية ممتازة</span>
          </div>
        </div>
      </div>

      {/* Earnings Over Time Chart Section with Dedicated Y-Axis Column & Dynamic Timeframes */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xs space-y-4 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">مخطط الإيرادات والمبيعات</h2>
            <p className="text-xs text-muted-foreground">تطور إجمالي الإيرادات اليومية بالدينار الليبي (د.ل) — {activeTimeframeLabel}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dynamic Timeframe Selector Pills */}
            <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border text-xs font-bold">
              {timeframes.map((tf) => (
                <button
                  key={tf.label}
                  type="button"
                  onClick={() => setTimeframe(tf.value)}
                  className={`rounded-lg px-2.5 py-1 transition-all ${
                    timeframe === tf.value
                      ? 'bg-card text-foreground font-bold shadow-2xs border border-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary font-mono">
              <TrendingUp className="size-3.5" />
              <span>إجمالي {activeTimeframeLabel}: {formatPrice(totalPeriodRevenue)}</span>
            </span>
          </div>
        </div>

        {/* SVG Area Chart - Isolated Left Column for Prices & Zero Collision */}
        <div className="relative w-full overflow-x-auto overflow-y-hidden pt-2 no-scrollbar">
          <div className="min-w-[620px] sm:min-w-full">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-52 sm:h-64 md:h-76"
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Dedicated Left Y-Axis Shaded Column Guide */}
              <rect
                x={0}
                y={0}
                width={paddingLeft - 10}
                height={chartHeight}
                className="fill-transparent"
              />

              {/* Horizontal Grid lines & Isolated Price Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingTop + plotHeight * (1 - ratio)
                const val = maxRevenue * ratio
                return (
                  <g key={ratio}>
                    {/* Grid line starting cleanly at paddingLeft */}
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="var(--color-border)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.7}
                    />
                    {/* Dedicated Y-Axis Price Label strictly left of paddingLeft */}
                    <text
                      x={paddingLeft - 18}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[11px] fill-muted-foreground font-mono font-bold"
                    >
                      {formatPrice(val)}
                    </text>
                  </g>
                )
              })}

              {/* Area Fill */}
              <path d={areaPath} fill="url(#revenueGradient)" />

              {/* Line Path */}
              <path
                d={linePath}
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Point Circles & Smart X-Axis Labels */}
              {chartPoints.map((point, idx) => {
                // Smart sampling for X-Axis labels to avoid overlapping on dense ranges
                const step = series.length > 30 ? Math.ceil(series.length / 10) : series.length > 15 ? 2 : 1
                const showXLabel = idx % step === 0 || idx === series.length - 1

                return (
                  <g key={point.date}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={hoveredPoint?.date === point.date ? 6 : 3.5}
                      className="fill-card stroke-primary transition-all duration-150 cursor-pointer"
                      strokeWidth={2}
                      onMouseEnter={() =>
                        setHoveredPoint({
                          date: point.date,
                          revenue: point.revenue,
                          x: point.x,
                          y: point.y,
                        })
                      }
                    />
                    {/* Date labels at bottom */}
                    {showXLabel && (
                      <text
                        x={point.x}
                        y={chartHeight - 12}
                        textAnchor="middle"
                        className="text-[11px] fill-muted-foreground font-mono font-medium"
                      >
                        {point.date.slice(5)}
                      </text>
                    )}
                  </g>
                )
              })}
            </svg>

            {/* Interactive Tooltip */}
            {hoveredPoint && (
              <div
                className="pointer-events-none absolute rounded-xl border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md transition-all -translate-x-1/2 -translate-y-full z-10"
                style={{
                  left: `${(hoveredPoint.x / chartWidth) * 100}%`,
                  top: `${(hoveredPoint.y / chartHeight) * 100}%`,
                }}
              >
                <p className="font-mono text-[11px] text-muted-foreground">{hoveredPoint.date}</p>
                <p className="font-mono text-xs font-bold text-price mt-0.5">
                  {formatPrice(hoveredPoint.revenue)}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Split Section: Recent Orders & Operational Summary */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders (2 Columns) */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xs space-y-4 lg:col-span-2 max-w-full overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">أحدث الطلبات المستلمة</h2>
              <p className="text-xs text-muted-foreground">متابعة سريعة لأحدث عمليات الشراء في المتجر</p>
            </div>
            <Link
              to="/admin/orders"
              className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span>عرض كل الطلبات</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {ordersPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : !recentOrdersData?.items?.length ? (
            <div className="py-10 text-center text-xs text-muted-foreground">لا توجد طلبات حديثة مسجلة بعد.</div>
          ) : (
            <div className="divide-y divide-border/50 overflow-x-auto w-full no-scrollbar">
              <table className="w-full min-w-[480px] text-start text-xs">
                <thead>
                  <tr className="text-muted-foreground font-semibold">
                    <th className="pb-2 text-start">رقم الطلب</th>
                    <th className="pb-2 text-start">العميل</th>
                    <th className="pb-2 text-start">المبلغ</th>
                    <th className="pb-2 text-start">الحالة</th>
                    <th className="pb-2 text-end">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {recentOrdersData.items.map((order: Order) => (
                    <tr key={order.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 font-mono font-bold text-foreground">{order.order_number}</td>
                      <td className="py-3 text-muted-foreground">
                        {order.user?.name || order.user?.phone_number || 'عميل'}
                      </td>
                      <td className="py-3 font-mono font-semibold text-price">{formatPrice(order.total)}</td>
                      <td className="py-3">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="py-3 text-end">
                        <Link
                          to={`/admin/orders/${order.order_number}`}
                          className="rounded-lg border border-border px-2.5 py-1 font-semibold text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors inline-flex items-center gap-1"
                        >
                          <span>عرض</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Operational Highlights (1 Column) */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-border/60 pb-3">
              <h2 className="text-base font-bold text-foreground">المؤشرات التشغيلية</h2>
              <p className="text-xs text-muted-foreground">ملخص سريع للنشاط اليومي</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">طلبات اليوم</span>
                    <span className="text-[11px] text-muted-foreground">نشاط المبيعات الحالي</span>
                  </div>
                </div>
                <span className="font-mono text-base font-extrabold text-foreground">
                  {formatNumber(data.today_orders)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
                    <Users className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">العملاء المسجلون</span>
                    <span className="text-[11px] text-muted-foreground">قاعدة بيانات العملاء</span>
                  </div>
                </div>
                <span className="font-mono text-base font-extrabold text-foreground">
                  {formatNumber(data.customers)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <Boxes className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">تنبيهات المخزون</span>
                    <span className="text-[11px] text-muted-foreground">أصناف تحتاج تجديد</span>
                  </div>
                </div>
                <span className="font-mono text-base font-extrabold text-amber-600 dark:text-amber-400">
                  {formatNumber(data.low_stock)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/admin/customization"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-foreground shadow-2xs hover:bg-muted transition-colors"
            >
              <span>تخصيص الواجهة الرئيسية</span>
              <ArrowUpRight className="size-3.5 text-primary" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
