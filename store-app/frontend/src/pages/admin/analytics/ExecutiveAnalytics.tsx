import {
  BarChart3,
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
  const { data, isLoading, refetch, isFetching } = useExecutiveAnalytics(timeframe)
  const [hoveredTrend, setHoveredTrend] = React.useState<{ date: string; revenue: string; x: number; y: number } | null>(null)

  const timeframes: { label: string; value: number | string }[] = [
    { label: '7 أيام', value: 7 },
    { label: '30 يوماً', value: 30 },
    { label: '90 يوماً', value: 90 },
    { label: 'الشهر الحالي', value: 'month' },
    { label: 'السنة الحالية', value: 'year' },
    { label: 'كل الأوقات', value: 'all' },
  ]

  const activeTimeframeLabel = timeframes.find((t) => t.value === timeframe)?.label || 'الفترة المحددة'

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

  // Trend Chart Coordinate Calculations
  const trendSeries = (data.trend_series && data.trend_series.length > 0) ? data.trend_series : []
  const trendRevenues = trendSeries.map((s) => Number(s.revenue))
  const maxTrendRevenue = Math.max(...trendRevenues, 100)

  const chartWidth = 840
  const chartHeight = 220
  const paddingLeft = 130
  const paddingRight = 25
  const paddingTop = 20
  const paddingBottom = 40

  const plotWidth = chartWidth - paddingLeft - paddingRight
  const plotHeight = chartHeight - paddingTop - paddingBottom

  const trendPoints = trendSeries.map((d, index) => {
    const x = paddingLeft + (index / (trendSeries.length - 1 || 1)) * plotWidth
    const y = paddingTop + plotHeight * (1 - Number(d.revenue) / maxTrendRevenue)
    return { x, y, date: d.date, revenue: d.revenue }
  })

  const trendLinePath = trendPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  const trendAreaPath = trendPoints.length > 0 ? `
    ${trendLinePath}
    L ${paddingLeft + plotWidth} ${paddingTop + plotHeight}
    L ${paddingLeft} ${paddingTop + plotHeight}
    Z
  ` : ''

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

      {/* Periodic Trend Chart Section */}
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

          <div className="relative w-full overflow-x-auto overflow-y-hidden pt-2 no-scrollbar">
            <div className="min-w-[600px] sm:min-w-full">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-44 sm:h-56"
                onMouseLeave={() => setHoveredTrend(null)}
              >
                <defs>
                  <linearGradient id="execTrendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines & Left Isolated Price Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = paddingTop + plotHeight * (1 - ratio)
                  const val = maxTrendRevenue * ratio
                  return (
                    <g key={ratio}>
                      <line
                        x1={paddingLeft}
                        y1={y}
                        x2={chartWidth - paddingRight}
                        y2={y}
                        stroke="var(--color-border)"
                        strokeDasharray="4 4"
                        strokeOpacity={0.7}
                      />
                      <text
                        x={paddingLeft - 16}
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
                <path d={trendAreaPath} fill="url(#execTrendGradient)" />

                {/* Line */}
                <path
                  d={trendLinePath}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Points */}
                {trendPoints.map((point, idx) => {
                  const step = trendSeries.length > 25 ? Math.ceil(trendSeries.length / 8) : trendSeries.length > 14 ? 2 : 1
                  const showXLabel = idx % step === 0 || idx === trendSeries.length - 1

                  return (
                    <g key={point.date}>
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={hoveredTrend?.date === point.date ? 5.5 : 3.5}
                        className="fill-card stroke-primary transition-all duration-150 cursor-pointer"
                        strokeWidth={2}
                        onMouseEnter={() =>
                          setHoveredTrend({
                            date: point.date,
                            revenue: point.revenue,
                            x: point.x,
                            y: point.y,
                          })
                        }
                      />
                      {showXLabel && (
                        <text
                          x={point.x}
                          y={chartHeight - 10}
                          textAnchor="middle"
                          className="text-[10px] fill-muted-foreground font-mono font-medium"
                        >
                          {point.date.slice(5)}
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Tooltip */}
              {hoveredTrend && (
                <div
                  className="pointer-events-none absolute rounded-xl border border-border bg-popover/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur-md transition-all -translate-x-1/2 -translate-y-full z-10"
                  style={{
                    left: `${(hoveredTrend.x / chartWidth) * 100}%`,
                    top: `${(hoveredTrend.y / chartHeight) * 100}%`,
                  }}
                >
                  <p className="font-mono text-[10px] text-muted-foreground">{hoveredTrend.date}</p>
                  <p className="font-mono text-xs font-bold text-price">{formatPrice(hoveredTrend.revenue)}</p>
                </div>
              )}
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
