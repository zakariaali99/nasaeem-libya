import {
  BarChart3,
  Crown,
  DollarSign,
  Flame,
  MapPin,
  Percent,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber, formatPrice } from '@/lib/format'
import { useExecutiveAnalytics } from '@/lib/queries/executiveAnalytics'
import { usePageTitle } from '@/lib/usePageTitle'

export default function ExecutiveAnalytics() {
  usePageTitle('التحليلات التنفيذية والذكاء التجاري — لوحة التحكم')
  const { data, isLoading, refetch, isFetching } = useExecutiveAnalytics()

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

  return (
    <div className="space-y-6 animate-fade-rise">
      {/* Executive Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              التحليلات التنفيذية والذكاء التجاري
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            مؤشرات الأرباح الحقيقية، الأداء الجغرافي للمدن الليبية، والماركات العطرية الأعلى ربحية
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="min-h-11 rounded-xl text-xs font-bold gap-2 bg-card border-border"
        >
          <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>تحديث المؤشرات</span>
        </Button>
      </div>

      {/* Top Financial & Operational Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Revenue */}
        <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي المبيعات</span>
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
          <p className="text-[11px] text-muted-foreground">متوسط هامش ~55%</p>
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
          <p className="text-[11px] text-muted-foreground">لكل طلب مكتمل</p>
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
            دورة الشراء: ~{data.avg_days_between_orders} يوماً
          </p>
        </div>
      </div>

      {/* Main Grids: Libyan Cities Heatmap + Brand Profitability */}
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
            {data.city_breakdown.map((city, idx) => (
              <div key={city.city_name} className="space-y-1.5">
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
            ))}
          </div>
        </div>

        {/* Fragrance Brands Profitability */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-border/80 pb-4">
            <div className="flex items-center gap-2">
              <Flame className="size-5 text-primary" />
              <h2 className="font-bold text-sm sm:text-base text-foreground">
                الماركات العطرية الأعلى ربحية
              </h2>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              الأعلى عائداً
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-start">
                  <th className="pb-3 text-start font-bold">الماركة العطرية</th>
                  <th className="pb-3 text-center font-bold">المبيعات</th>
                  <th className="pb-3 text-center font-bold">هامش الربح</th>
                  <th className="pb-3 text-end font-bold">صافي الدخل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.brand_performance.map((brand) => (
                  <tr key={brand.brand_name} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3.5 font-bold text-foreground">{brand.brand_name}</td>
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
          <Button asChild variant="outline" size="sm" className="min-h-11 rounded-xl text-xs font-bold">
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
              <p className="font-mono text-xs text-muted-foreground">{user.phone_number}</p>
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs font-mono">
                <span className="text-muted-foreground">الإنفاق التراكمي:</span>
                <span className="font-extrabold text-price">{formatPrice(user.lifetime_spend)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
