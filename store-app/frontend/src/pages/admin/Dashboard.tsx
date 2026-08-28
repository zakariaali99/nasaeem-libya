import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calendar,
  CalendarRange,
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
  const [isCustom, setIsCustom] = React.useState(false)
  const [customStart, setCustomStart] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().slice(0, 10)
  })
  const [customEnd, setCustomEnd] = React.useState(() => new Date().toISOString().slice(0, 10))

  const queryParam = isCustom
    ? { start_date: customStart, end_date: customEnd }
    : timeframe

  const { data, isPending } = useDashboardStats(queryParam)
  const { data: recentOrdersData, isPending: ordersPending } = useMyOrders({ limit: 5 })
  const [hoveredPoint, setHoveredPoint] = React.useState<{
    date: string
    revenue: string
    orders?: number
    xPercent: number
    yPercent: number
  } | null>(null)

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

  const series = data.series && data.series.length > 0 ? data.series : []
  const revenueValues = series.map((d) => Number(d.revenue))
  const maxRevenue = Math.max(...revenueValues, 100)
  const totalPeriodRevenue = data.timeframe_revenue
    ? Number(data.timeframe_revenue)
    : revenueValues.reduce((a, b) => a + b, 0)

  // Pure SVG coordinate points (0..700 width, 0..200 height)
  // Left Column numbers are completely in HTML outside this SVG
  const chartPoints = series.map((d, index) => {
    const x = (index / (series.length - 1 || 1)) * 700
    const y = 200 * (1 - (maxRevenue > 0 ? Number(d.revenue) / maxRevenue : 0))
    return { x, y, date: d.date, orders: d.orders, revenue: d.revenue }
  })

  const linePath = chartPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const areaPath =
    chartPoints.length > 0
      ? `
    ${linePath}
    L 700 200
    L 0 200
    Z
  `
      : ''

  // Smart non-colliding X-axis date labels (5 to 7 evenly distributed)
  const isLongRange = series.length > 45
  const sampleCount = Math.min(series.length, isLongRange ? 6 : Math.min(series.length, 6))
  const displayDateLabels =
    series.length <= 6
      ? series.map((s) => s.date)
      : Array.from({ length: sampleCount }, (_, i) => {
          const idx = Math.round((i / (sampleCount - 1)) * (series.length - 1))
          return series[idx]?.date || ''
        })

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

  const activeTimeframeLabel = isCustom
    ? `مخصص (${customStart} إلى ${customEnd})`
    : timeframes.find((t) => t.value === timeframe)?.label || 'الفترة المحددة'

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

      {/* Earnings Over Time Chart Section with Dedicated Y-Axis Column & Custom Date Range */}
      <section className="rounded-3xl border border-border bg-card p-4 sm:p-6 shadow-2xs space-y-5 max-w-full overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <TrendingUp className="size-4" />
              </span>
              <h2 className="text-base font-bold text-foreground">مخطط الإيرادات والمبيعات</h2>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              تطور إجمالي الإيرادات اليومية بالدينار الليبي (د.ل) — {activeTimeframeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Dynamic Timeframe Selector Pills */}
            <div className="flex items-center rounded-xl bg-muted/60 p-1 border border-border text-xs font-bold">
              {timeframes.map((tf) => (
                <button
                  key={tf.label}
                  type="button"
                  onClick={() => {
                    setIsCustom(false)
                    setTimeframe(tf.value)
                  }}
                  className={`rounded-lg px-2.5 py-1 transition-all ${
                    !isCustom && timeframe === tf.value
                      ? 'bg-card text-foreground font-bold shadow-2xs border border-border/50'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tf.label}
                </button>
              ))}

              {/* Custom Range Toggle Button */}
              <button
                type="button"
                onClick={() => setIsCustom((prev) => !prev)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 transition-all ${
                  isCustom
                    ? 'bg-primary text-primary-foreground font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarRange className="size-3.5" />
                <span>مخصص</span>
              </button>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary font-mono shadow-2xs">
              <DollarSign className="size-3.5" />
              <span>إجمالي الفترة: {formatPrice(totalPeriodRevenue)}</span>
            </span>
          </div>
        </div>

        {/* Custom Date Range Picker Bar (Shown when 'مخصص' is active) */}
        {isCustom && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs animate-fade-rise">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span className="font-bold text-foreground">تحديد الفترة المخصصة:</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground font-medium">من:</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-mono font-bold text-foreground focus:border-primary focus:outline-none shadow-2xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted-foreground font-medium">إلى:</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-xl border border-border bg-card px-2.5 py-1 text-xs font-mono font-bold text-foreground focus:border-primary focus:outline-none shadow-2xs"
              />
            </div>
            <span className="text-[11px] text-muted-foreground">
              (يتم تحديث البيانات والإحصائيات مباشرة عند تغيير التواريخ)
            </span>
          </div>
        )}

        {/* HTML 2-Column Chart Layout - Physically Isolated Left Price Column & Zero Collisions */}
        <div className="space-y-2 select-none" dir="ltr">
          <div className="flex items-stretch gap-0 h-56 sm:h-64 md:h-72">
            {/* Left Column: Dedicated Y-Axis Scale (Physical HTML Column) */}
            <div className="w-24 sm:w-28 shrink-0 flex flex-col justify-between py-1 pr-3 text-right border-r border-border/70 select-none">
              {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                const val = maxRevenue * ratio
                return (
                  <span key={ratio} className="font-mono text-[11px] font-bold text-muted-foreground leading-none">
                    {formatPrice(val)}
                  </span>
                )
              })}
            </div>

            {/* Right Column: Isolated SVG Canvas */}
            <div className="flex-1 min-w-0 relative h-full">
              <svg
                viewBox="0 0 700 200"
                preserveAspectRatio="none"
                className="w-full h-full cursor-crosshair"
                onMouseLeave={() => setHoveredPoint(null)}
                onMouseMove={(e) => {
                  if (chartPoints.length === 0) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                  const idx = Math.round(pct * (chartPoints.length - 1))
                  const point = chartPoints[idx]
                  if (point) {
                    setHoveredPoint({
                      date: point.date,
                      revenue: point.revenue,
                      orders: point.orders,
                      xPercent: (point.x / 700) * 100,
                      yPercent: (point.y / 200) * 100,
                    })
                  }
                }}
              >
                <defs>
                  <linearGradient id="dashboardRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* 5 Horizontal Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = 200 * (1 - ratio)
                  return (
                    <line
                      key={ratio}
                      x1={0}
                      y1={y}
                      x2={700}
                      y2={y}
                      stroke="var(--color-border)"
                      strokeDasharray="4 4"
                      strokeOpacity={0.65}
                    />
                  )
                })}

                {/* Area Fill */}
                {areaPath && <path d={areaPath} fill="url(#dashboardRevenueGradient)" />}

                {/* Line */}
                {linePath && (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Data Point Circles - Render all for short range, active on hover for long range */}
                {!isLongRange
                  ? chartPoints.map((point) => (
                      <circle
                        key={point.date}
                        cx={point.x}
                        cy={point.y}
                        r={hoveredPoint?.date === point.date ? 5.5 : 3}
                        className="fill-card stroke-primary transition-all duration-150 cursor-pointer"
                        strokeWidth={2}
                      />
                    ))
                  : hoveredPoint && (
                      <circle
                        cx={(hoveredPoint.xPercent / 100) * 700}
                        cy={(hoveredPoint.yPercent / 100) * 200}
                        r={6}
                        className="fill-card stroke-primary transition-all duration-75"
                        strokeWidth={2.5}
                      />
                    )}
              </svg>

              {/* Floating Hover Tooltip */}
              {hoveredPoint && (
                <div
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-popover/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur-md transition-all font-sans whitespace-nowrap mb-2"
                  style={{
                    left: `${hoveredPoint.xPercent}%`,
                    top: `${hoveredPoint.yPercent}%`,
                  }}
                >
                  <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <Calendar className="size-3" />
                    <span>{hoveredPoint.date}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono">
                    <span className="font-bold text-price text-xs">{formatPrice(hoveredPoint.revenue)}</span>
                    {hoveredPoint.orders !== undefined && (
                      <span className="text-[10px] text-muted-foreground font-sans">({hoveredPoint.orders} طلب)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dedicated Non-Colliding X-Axis Labels Row */}
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground pt-2.5 border-t border-border/60 ml-24 sm:ml-28">
            {displayDateLabels.map((item, idx) => (
              <span key={idx} className="truncate">
                {item}
              </span>
            ))}
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
