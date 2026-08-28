import {
  BarChart3,
  Calendar,
  CalendarRange,
  CreditCard,
  Crown,
  DollarSign,
  Flame,
  MapPin,
  Percent,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Truck,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPrice } from '@/lib/format'
import { useExecutiveAnalytics } from '@/lib/queries/executiveAnalytics'
import { usePageTitle } from '@/lib/usePageTitle'

export default function ExecutiveAnalytics() {
  usePageTitle('التحليلات التنفيذية والذكاء التجاري — لوحة التحكم')
  const [timeframe, setTimeframe] = React.useState<number | string>(30)
  const [isCustom, setIsCustom] = React.useState(false)
  const [customStart, setCustomStart] = React.useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().slice(0, 10)
  })
  const [customEnd, setCustomEnd] = React.useState(() => new Date().toISOString().slice(0, 10))

  const queryParam = isCustom
    ? { start_date: customStart, end_date: customEnd }
    : timeframe

  const { data, isLoading, refetch, isFetching } = useExecutiveAnalytics(queryParam)
  const [hoveredTrend, setHoveredTrend] = React.useState<{
    date: string
    revenue: string
    orders?: number
    xPercent: number
    yPercent: number
  } | null>(null)

  const timeframes: { label: string; value: number | string }[] = [
    { label: '7 أيام', value: 7 },
    { label: '14 يوماً', value: 14 },
    { label: '30 يوماً', value: 30 },
    { label: '90 يوماً', value: 90 },
    { label: 'الشهر الحالي', value: 'month' },
    { label: 'السنة الحالية', value: 'year' },
    { label: 'كل الأوقات', value: 'all' },
  ]

  const activeTimeframeLabel = isCustom
    ? `مخصص (${customStart} إلى ${customEnd})`
    : timeframes.find((t) => t.value === timeframe)?.label || 'الفترة المحددة'

  if (isLoading || !data) {
    return (
      <div className="space-y-6 animate-fade-rise">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-3xl" />
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    )
  }

  // Trend Chart Coordinate Calculations (0..700 width, 0..200 height)
  const trendSeries = data.trend_series && data.trend_series.length > 0 ? data.trend_series : []
  const trendRevenues = trendSeries.map((s) => Number(s.revenue))
  const maxTrendRevenue = Math.max(...trendRevenues, 100)

  const trendPoints = trendSeries.map((d, index) => {
    const x = (index / (trendSeries.length - 1 || 1)) * 700
    const y = 200 * (1 - (maxTrendRevenue > 0 ? Number(d.revenue) / maxTrendRevenue : 0))
    return { x, y, date: d.date, orders: d.orders, revenue: d.revenue }
  })

  const trendLinePath = trendPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')

  const trendAreaPath =
    trendPoints.length > 0
      ? `
    ${trendLinePath}
    L 700 200
    L 0 200
    Z
  `
      : ''

  // Smart non-colliding X-axis date labels (5 to 7 evenly distributed)
  const isLongTrendRange = trendSeries.length > 45
  const sampleCount = Math.min(trendSeries.length, isLongTrendRange ? 6 : Math.min(trendSeries.length, 6))
  const displayTrendDateLabels =
    trendSeries.length <= 6
      ? trendSeries.map((s) => s.date)
      : Array.from({ length: sampleCount }, (_, i) => {
          const idx = Math.round((i / (sampleCount - 1)) * (trendSeries.length - 1))
          return trendSeries[idx]?.date || ''
        })

  return (
    <div className="space-y-6 animate-fade-rise">
      {/* Executive Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BarChart3 className="size-4.5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              التحليلات التنفيذية والذكاء التجاري
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            مؤشرات الأرباح اللحظية، الأداء الجغرافي للمدن الليبية، والماركات العطرية الأعلى طلباً — {activeTimeframeLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Timeframe Selector Pills */}
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

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="min-h-9 rounded-xl text-xs font-bold gap-2 bg-card border-border shadow-2xs"
          >
            <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>تحديث</span>
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker Bar (Shown when 'مخصص' is active) */}
      {isCustom && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-xs animate-fade-rise">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="font-bold text-foreground">تحديد الفترة المخصصة للتحليلات:</span>
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
            (يتم احتساب مؤشرات الأرباح وتوزيع المدن ومبيعات العطور اللحظية تلقائياً)
          </span>
        </div>
      )}

      {/* Top Financial & Operational Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي المبيعات المؤكدة</span>
            <DollarSign className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">
            {formatPrice(data.total_revenue)}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
            <TrendingUp className="size-3" />
            <span>{formatNumber(data.total_orders_count)} طلب مؤكد</span>
          </div>
        </div>

        {/* Estimated Net Profit */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>صافي الأرباح التقديرية</span>
            <Sparkles className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-price">
            {formatPrice(data.estimated_profit)}
          </p>
          <p className="text-[11px] text-muted-foreground">متوسط هامش أرباح ~55%</p>
        </div>

        {/* Average Order Value (AOV) */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>متوسط قيمة السلة (AOV)</span>
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">
            {formatPrice(data.average_order_value)}
          </p>
          <p className="text-[11px] text-muted-foreground">لكل طلب مؤكد بالفترة</p>
        </div>

        {/* Retention & Repeat Rate */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>معدل تكرار الشراء</span>
            <Percent className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-primary">
            %{data.repeat_purchase_rate}
          </p>
          <p className="text-[11px] text-muted-foreground">
            دورة تكرار الطلب: ~{data.avg_days_between_orders} يوماً
          </p>
        </div>
      </div>

      {/* Periodic Trend Chart Section - Isolated 2-Column HTML Layout */}
      {trendSeries.length > 0 && (
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4.5 text-primary" />
              <h2 className="font-bold text-sm sm:text-base text-foreground">
                مسار تطور الإيرادات اللحظية ({activeTimeframeLabel})
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-primary">
              إجمالي الفترة: {formatPrice(data.total_revenue)}
            </span>
          </div>

          <div className="space-y-2 select-none" dir="ltr">
            <div className="flex items-stretch gap-0 h-52 sm:h-60">
              {/* Left Column: Dedicated Y-Axis Scale (Physical HTML Column) */}
              <div className="w-24 sm:w-28 shrink-0 flex flex-col justify-between py-1 pr-3 text-right border-r border-border/70 select-none">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio) => {
                  const val = maxTrendRevenue * ratio
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
                  onMouseLeave={() => setHoveredTrend(null)}
                  onMouseMove={(e) => {
                    if (trendPoints.length === 0) return
                    const rect = e.currentTarget.getBoundingClientRect()
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                    const idx = Math.round(pct * (trendPoints.length - 1))
                    const point = trendPoints[idx]
                    if (point) {
                      setHoveredTrend({
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
                    <linearGradient id="execTrendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
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
                  {trendAreaPath && <path d={trendAreaPath} fill="url(#execTrendGradient)" />}

                  {/* Line */}
                  {trendLinePath && (
                    <path
                      d={trendLinePath}
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Data Point Circles - Render all for short range, active on hover for long range */}
                  {!isLongTrendRange
                    ? trendPoints.map((point) => (
                        <circle
                          key={point.date}
                          cx={point.x}
                          cy={point.y}
                          r={hoveredTrend?.date === point.date ? 5.5 : 3}
                          className="fill-card stroke-primary transition-all duration-150 cursor-pointer"
                          strokeWidth={2}
                        />
                      ))
                    : hoveredTrend && (
                        <circle
                          cx={(hoveredTrend.xPercent / 100) * 700}
                          cy={(hoveredTrend.yPercent / 100) * 200}
                          r={6}
                          className="fill-card stroke-primary transition-all duration-75"
                          strokeWidth={2.5}
                        />
                      )}
                </svg>

                {/* Floating Hover Tooltip */}
                {hoveredTrend && (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-popover/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur-md transition-all font-sans whitespace-nowrap mb-2"
                    style={{
                      left: `${hoveredTrend.xPercent}%`,
                      top: `${hoveredTrend.yPercent}%`,
                    }}
                  >
                    <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <Calendar className="size-3" />
                      <span>{hoveredTrend.date}</span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono">
                      <span className="font-bold text-price text-xs">{formatPrice(hoveredTrend.revenue)}</span>
                      {hoveredTrend.orders !== undefined && (
                        <span className="text-[10px] text-muted-foreground font-sans">({hoveredTrend.orders} طلب)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dedicated Non-Colliding X-Axis Labels Row */}
            <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground pt-2.5 border-t border-border/60 ml-24 sm:ml-28">
              {displayTrendDateLabels.map((item, idx) => (
                <span key={idx} className="truncate">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Grids: Libyan Cities Heatmap + Fragrance Sales Breakdown */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Libyan Geographic Distribution */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div className="flex items-center gap-2">
              <MapPin className="size-5 text-primary" />
              <h2 className="font-bold text-sm sm:text-base text-foreground">
                التوزيع الجغرافي للمبيعات (المدن الليبية)
              </h2>
            </div>
            <span className="text-xs font-bold text-muted-foreground font-mono">
              {data.city_breakdown.length} مدن نشطة
            </span>
          </div>

          <div className="space-y-4">
            {data.city_breakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد طلبات مسجلة للمدن في هذه الفترة</p>
            ) : (
              data.city_breakdown.map((city, idx) => (
                <div key={`${city.city_name}-${idx}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="font-mono text-muted-foreground text-[11px]">{idx + 1}.</span>
                      <span>{city.city_name}</span>
                    </span>
                    <div className="flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">{city.orders_count} طلب</span>
                      <span className="font-bold text-foreground">{formatPrice(city.revenue)}</span>
                      <span className="text-primary font-bold">({city.percentage}%)</span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.max(city.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Perfumes & Fragrance Items Profitability */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-primary" />
              <h2 className="font-bold text-sm sm:text-base text-foreground">
                العطور والأصناف الأكثر مبيعاً
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              الأعلى طلباً
            </span>
          </div>

          <div className="overflow-x-auto">
            {data.brand_performance.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">لا توجد مبيعات أصناف مسجلة في هذه الفترة</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-start">
                    <th className="pb-3 text-start font-bold">العطر / الصنف</th>
                    <th className="pb-3 text-center font-bold">المبيعات</th>
                    <th className="pb-3 text-center font-bold">هامش الربح</th>
                    <th className="pb-3 text-end font-bold">صافي الدخل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.brand_performance.map((brand, idx) => (
                    <tr key={`${brand.brand_name}-${idx}`} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3.5 font-bold text-foreground truncate max-w-44">{brand.brand_name}</td>
                      <td className="py-3.5 text-center font-mono text-muted-foreground">
                        {brand.units_sold} قطعة ({formatPrice(brand.revenue)})
                      </td>
                      <td className="py-3.5 text-center font-mono">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                          %{brand.margin_percent}
                        </span>
                      </td>
                      <td className="py-3.5 text-end font-mono font-bold text-price">
                        {formatPrice(brand.net_profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods & Couriers Performance */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Payment Methods Breakdown */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3.5">
            <div className="flex items-center gap-2">
              <CreditCard className="size-5 text-primary" />
              <h2 className="font-bold text-sm sm:text-base text-foreground">
                توزيع بوابات وطرق الدفع
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {(!data.payment_methods_breakdown || data.payment_methods_breakdown.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد عمليات دفع في الفترة المحددة</p>
            ) : (
              data.payment_methods_breakdown.map((pm) => (
                <div key={pm.method_code} className="rounded-2xl border border-border bg-muted/20 p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-foreground">{pm.label}</p>
                    <p className="text-muted-foreground font-mono text-[11px] mt-0.5">{pm.orders_count} طلب مؤكد</p>
                  </div>
                  <div className="text-end font-mono">
                    <p className="font-bold text-foreground">{formatPrice(pm.revenue)}</p>
                    <p className="text-primary font-bold text-[11px]">({pm.percentage}%)</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delivery Couriers Breakdown */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3.5">
            <div className="flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              <h2 className="font-bold text-sm sm:text-base text-foreground">
                أداء شركات التوصيل واللوجستيات
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {(!data.delivery_couriers_breakdown || data.delivery_couriers_breakdown.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-4">لا توجد شحنات مسجلة في الفترة المحددة</p>
            ) : (
              data.delivery_couriers_breakdown.map((cr, idx) => (
                <div key={`${cr.courier_name}-${idx}`} className="rounded-2xl border border-border bg-muted/20 p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-foreground">{cr.courier_name}</p>
                    <p className="text-muted-foreground font-mono text-[11px] mt-0.5">{cr.orders_count} طرد مسلم</p>
                  </div>
                  <div className="text-end font-mono">
                    <p className="font-bold text-foreground">{formatPrice(cr.revenue)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* VIP High Rollers Cohort Table */}
      <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-4">
          <div className="flex items-center gap-2">
            <Crown className="size-5 text-primary" />
            <h2 className="font-bold text-sm sm:text-base text-foreground">
              كبار العملاء الأكثر إنفاقاً (VIP High Rollers)
            </h2>
          </div>
          <Button asChild variant="outline" size="sm" className="min-h-9 rounded-xl text-xs font-bold">
            <Link to="/admin/users">عرض كافة العملاء</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.vip_top_spenders.map((user) => (
            <div
              key={user.id}
              className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2 hover:border-primary/40 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground truncate">{user.name}</span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-extrabold text-primary">
                  {user.vip_tier === 'DIAMOND' ? '💎 ماسي' : user.vip_tier === 'GOLD' ? '🥇 ذهبي' : '🥈 فضي'}
                </span>
              </div>
              <p className="font-mono text-xs text-muted-foreground" dir="ltr">{user.phone_number}</p>
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs font-mono">
                <span className="text-muted-foreground">الإنفاق المؤكد:</span>
                <span className="font-extrabold text-price">{formatPrice(user.lifetime_spend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
