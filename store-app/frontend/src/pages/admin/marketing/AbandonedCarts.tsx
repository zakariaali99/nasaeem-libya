import {
  CheckCircle2,
  Clock,
  MessageCircle,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/format'
import {
  useAbandonedCarts,
  useMarkCartRecovered,
  useSendAbandonedWhatsApp,
} from '@/lib/queries/abandonedCarts'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AbandonedCartsPage() {
  usePageTitle('السلات المتروكة واسترجاع المبيعات — لوحة الإدارة', 'متابعة السلات المتروكة ومراسلة العملاء عبر الواتساب.')

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'reminded' | 'recovered'>('all')
  const [minutesCutoff, setMinutesCutoff] = useState<number>(15)
  const [searchQuery, setSearchQuery] = useState<string>('')

  const { data: abandonedData, isLoading, refetch } = useAbandonedCarts({
    status: statusFilter,
    minutes: minutesCutoff,
    q: searchQuery || undefined,
  })
  const sendWhatsApp = useSendAbandonedWhatsApp()
  const markRecovered = useMarkCartRecovered()

  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const stats = abandonedData?.stats || {
    total_abandoned_value: '0.00',
    abandoned_count: 0,
    recovered_count: 0,
    recovery_rate_percent: 0,
  }
  const carts = abandonedData?.carts || []

  const handleSendWhatsApp = async (cartId: string, whatsappLink: string) => {
    try {
      const res = await sendWhatsApp.mutateAsync(cartId)
      setActionSuccess(res?.message || 'تم إرسال التذكير بنجاح وتجهيز رسالة الواتساب')
      const targetUrl = res?.whatsapp_link || whatsappLink
      if (targetUrl) {
        window.open(targetUrl, '_blank')
      }
      setTimeout(() => setActionSuccess(null), 4000)
    } catch {
      // Fallback open link
      if (whatsappLink) window.open(whatsappLink, '_blank')
    }
  }

  const handleMarkRecovered = async (cartId: string) => {
    await markRecovered.mutateAsync(cartId)
    setActionSuccess('تم تحديث حالة السلة إلى مسترجعة بنجاح')
    setTimeout(() => setActionSuccess(null), 3000)
  }

  return (
    <div className="space-y-6 animate-fade-rise">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground flex items-center gap-2">
            <span>استرجاع السلات المتروكة</span>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
              الواتساب الذكي
            </span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            متابعة الزوار الذين لم يكملوا الدفع ومراسلتهم مباشرة بكوبونات مخصصة (NASAEEM5)
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="min-h-11 rounded-xl text-xs gap-1.5 font-bold"
        >
          <RefreshCw className="size-3.5" />
          <span>تحديث السلات</span>
        </Button>
      </div>

      {actionSuccess && (
        <Alert tone="success" role="status">
          {actionSuccess}
        </Alert>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">إجمالي المبيعات المتروكة</span>
            <ShoppingBag className="size-4 text-primary" />
          </div>
          <p className="font-mono text-lg sm:text-xl font-black text-primary">
            {formatPrice(stats.total_abandoned_value)}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">عدد السلات المتروكة</span>
            <span className="text-xs font-bold text-foreground">سلة</span>
          </div>
          <p className="font-mono text-lg sm:text-xl font-black text-foreground">
            {stats.abandoned_count}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">السلات المسترجعة</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="font-mono text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.recovered_count}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">معدل الاسترجاع</span>
            <TrendingUp className="size-4 text-amber-500" />
          </div>
          <p className="font-mono text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
            %{stats.recovery_rate_percent}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xs">
        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/60 p-1 border border-border text-xs font-bold">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'all'
                ? 'bg-card text-foreground font-bold shadow-2xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            جميع السلات
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'pending'
                ? 'bg-card text-amber-600 dark:text-amber-400 font-bold shadow-2xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            بانتظار المتابعة
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('reminded')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'reminded'
                ? 'bg-card text-primary font-bold shadow-2xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            تم إرسال تذكير
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('recovered')}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              statusFilter === 'recovered'
                ? 'bg-card text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs border border-border/50'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            مسترجعة
          </button>
        </div>

        {/* Timeframe & Search Input */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            <select
              value={minutesCutoff}
              onChange={(e) => setMinutesCutoff(Number(e.target.value))}
              className="rounded-xl border border-border bg-background px-2.5 py-1.5 text-xs font-bold text-foreground focus:border-primary focus:outline-none shadow-2xs"
            >
              <option value={0}>كافة السلات (بما فيها الحالية)</option>
              <option value={15}>غير نشطة منذ 15 دقيقة</option>
              <option value={60}>غير نشطة منذ ساعة</option>
              <option value={360}>غير نشطة منذ 6 ساعات</option>
              <option value={1440}>غير نشطة منذ 24 ساعة</option>
            </select>
          </div>

          <div className="relative min-w-48 sm:min-w-64">
            <Search className="size-3.5 absolute start-3 top-3 text-muted-foreground" />
            <Input
              type="text"
              placeholder="ابحث بالاسم، الهاتف، أو العطر..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-8 h-9 text-xs rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Abandoned Carts Table */}
      <div className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">جاري تحميل السلات المتروكة...</div>
        ) : carts.length === 0 ? (
          <div className="p-12 text-center text-xs font-bold text-muted-foreground space-y-2">
            <ShoppingBag className="size-8 mx-auto text-muted-foreground/50" />
            <p>لا توجد سلات متروكة مطابقة للفلترة الحالية.</p>
            <p className="text-[11px] text-muted-foreground/80 font-normal">
              كافة عمليات التسوق جارية بنجاح أو تم استرجاعها 🎉
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                <tr>
                  <th className="p-3.5 text-start">العميل والهاتف</th>
                  <th className="p-3.5 text-start">الأصناف في السلة</th>
                  <th className="p-3.5 text-start">قيمة السلة</th>
                  <th className="p-3.5 text-start">آخر نشاط</th>
                  <th className="p-3.5 text-start">حالة الاسترجاع</th>
                  <th className="p-3.5 text-end">إجراءات المتابعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {carts.map((cart) => (
                  <tr key={cart.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-3.5 font-medium text-foreground">
                      <div className="font-bold">{cart.customer_name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground dir-ltr text-start">
                        {cart.phone_number || 'غير متوفر'}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <div className="space-y-0.5 max-w-xs">
                        {cart.items.map((item, idx) => (
                          <div key={idx} className="truncate text-foreground font-medium">
                            • {item.product_name} <span className="text-muted-foreground font-mono">({item.quantity}×)</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-primary">
                      {formatPrice(cart.cart_total)}
                    </td>
                    <td className="p-3.5 text-muted-foreground font-mono text-[11px]">
                      {new Date(cart.last_activity_at).toLocaleDateString('ar-LY', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3.5">
                      {cart.is_recovered ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          <span>تم الاسترجاع</span>
                        </span>
                      ) : cart.recovery_sms_sent_at ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-extrabold text-primary">
                          <MessageCircle className="size-3" />
                          <span>تم إرسال تذكير</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                          بانتظار المتابعة
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={!cart.phone_number}
                          onClick={() => handleSendWhatsApp(cart.id, cart.whatsapp_link)}
                          loading={sendWhatsApp.isPending}
                          className="min-h-9 rounded-xl text-xs font-bold gap-1 px-3 shadow-2xs"
                        >
                          <MessageCircle className="size-3.5" />
                          <span>مراسلة بالواتساب</span>
                        </Button>

                        {!cart.is_recovered && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkRecovered(cart.id)}
                            loading={markRecovered.isPending}
                            className="min-h-9 rounded-xl text-xs font-bold"
                          >
                            <span>تأكيد الاسترجاع</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
