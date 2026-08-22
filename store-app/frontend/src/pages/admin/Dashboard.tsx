import { Link } from 'react-router-dom'

import { useDashboardStats } from '@/lib/queries/orders'
import { formatPrice } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'

const TILES = [
  { key: 'pending_orders', label: 'طلبات بانتظار التأكيد', to: '/admin/orders?status=pending', tone: 'text-warning' },
  { key: 'processing_orders', label: 'قيد المعالجة', to: '/admin/orders?status=processing', tone: 'text-info' },
  { key: 'completed_orders', label: 'طلبات مكتملة', to: '/admin/orders?status=completed', tone: 'text-success' },
  { key: 'today_orders', label: 'طلبات اليوم', to: '/admin/orders', tone: '' },
] as const

export default function Dashboard() {
  const { data, isPending } = useDashboardStats()

  if (isPending || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    )
  }

  const maxRevenue = Math.max(...data.series.map((d) => Number(d.revenue)), 1)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TILES.map((tile) => (
          <Link
            key={tile.key}
            to={tile.to}
            className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary"
          >
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className={`mt-2 text-3xl font-bold ${tile.tone}`}>{data[tile.key]}</p>
          </Link>
        ))}
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">إيرادات الشهر</p>
          <p className="mt-2 text-2xl font-bold">{formatPrice(data.month_revenue)}</p>
        </div>
        <Link to="/admin/users" className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
          <p className="text-sm text-muted-foreground">العملاء</p>
          <p className="mt-2 text-3xl font-bold">{data.customers}</p>
        </Link>
        <Link to="/admin/inventory" className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
          <p className="text-sm text-muted-foreground">مخزون منخفض</p>
          <p className="mt-2 text-3xl font-bold text-warning">{data.low_stock}</p>
        </Link>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 font-semibold">إيرادات آخر ١٤ يوماً</h2>
        {/* Pure CSS bars — RTL-correct by construction: the first day starts at
            the inline start, and no charting library mirrors axes for us. */}
        <div dir="ltr" className="flex h-40 items-end gap-1.5">
          {[...data.series].reverse().map((day) => {
            const height = Math.max((Number(day.revenue) / maxRevenue) * 100, Number(day.revenue) > 0 ? 4 : 1)
            return (
              <div key={day.date} className="group relative flex-1" title={`${day.date}: ${formatPrice(day.revenue)}`}>
                <div
                  className="w-full rounded-t bg-primary transition-opacity group-hover:opacity-80"
                  style={{ height: `${height}%`, position: 'absolute', bottom: 0 }}
                />
                <div style={{ height: '100%' }} />
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">الإجمالي التراكمي: {formatPrice(data.revenue_total)}</p>
      </section>
    </div>
  )
}
