import { ArrowUpRight, CheckCircle2, Eye, Percent, Plus, Sparkles, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { DataTable } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useAdminCartPromotion, useUpdateAdminCartPromotion } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'

interface Discount {
  id: string
  code: string | null
  name: string
  type: 'percentage' | 'fixed'
  percentage: string | null
  value: string | null
  is_active: boolean
  usage_limit: number | null
  usage_count: number
  start_date: string | null
  end_date: string | null
}

function CartPromotionManagerCard() {
  const { data: promo, isLoading } = useAdminCartPromotion()
  const updatePromo = useUpdateAdminCartPromotion()

  const [isActive, setIsActive] = useState(true)
  const [minAmount, setMinAmount] = useState('200')
  const [title, setTitle] = useState('توصيل مجاني لجميع المدن')
  const [message, setMessage] = useState('أضف {remaining} د.ل للحصول على توصيل مجاني!')
  const [successMessage, setSuccessMessage] = useState('تهانينا! لقد حصلت على توصيل مجاني لكافة المدن 🚀')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (promo) {
      setIsActive(promo.is_active)
      setMinAmount(String(Number(promo.min_order_amount) || 200))
      setTitle(promo.title || 'توصيل مجاني لجميع المدن')
      setMessage(promo.message || 'أضف {remaining} د.ل للحصول على توصيل مجاني!')
      setSuccessMessage(promo.success_message || 'تهانينا! لقد حصلت على توصيل مجاني لكافة المدن 🚀')
    }
  }, [promo])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavedSuccess(false)
    await updatePromo.mutateAsync({
      is_active: isActive,
      min_order_amount: minAmount,
      title,
      message,
      success_message: successMessage,
    })
    setSavedSuccess(true)
    setTimeout(() => setSavedSuccess(false), 4000)
  }

  if (isLoading) {
    return <div className="h-44 rounded-2xl bg-card border border-border animate-pulse" />
  }

  const sampleSubtotal = 135
  const thresholdNum = Number(minAmount) || 200
  const remainingSample = Math.max(0, thresholdNum - sampleSubtotal)
  const sampleProgress = Math.min(100, (sampleSubtotal / thresholdNum) * 100)

  return (
    <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-5 sm:p-6 border-b border-border/80 bg-gradient-to-r from-primary/5 via-transparent to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Truck className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                عرض السلة والشحن المجاني التلقائي
              </h2>
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Sparkles className="size-3" />
                تلقائي
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              يظهر كشريط تقدم تفاعلي في سلة العميل، ويقوم بتصفير رسوم الشحن تلقائياً عند وصول المشتريات للحد الأدنى.
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <div className="flex items-center gap-3 self-end sm:self-center">
          <span className="text-xs font-bold text-foreground">
            {isActive ? 'العرض مفعّل' : 'العرض معطّل'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isActive}
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/20 ${
              isActive ? 'bg-primary' : 'bg-muted-foreground/30'
            }`}
          >
            <span
              className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                isActive ? 'ltr:translate-x-5 rtl:-translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Form Content */}
      <form onSubmit={handleSave} className="p-5 sm:p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              الحد الأدنى لقيمة السلة (د.ل) <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0"
                required
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full h-10 rounded-xl border border-input bg-background px-3 font-mono font-bold text-xs focus:ring-2 focus:ring-primary/20 text-start"
                placeholder="200"
              />
              <span className="absolute inset-y-0 end-3 flex items-center text-xs text-muted-foreground font-semibold">
                د.ل
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              القيمة التي يحصل العميل بعدها على شحن مجاني
            </span>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-foreground mb-1.5">
              عنوان العرض الترويجي
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20"
              placeholder="توصيل مجاني لجميع المدن"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              الاسم الإداري والتعريفي للعرض في النظام
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              نص الرسالة التشجيعية في السلة
            </label>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20"
              placeholder="أضف {remaining} د.ل للحصول على توصيل مجاني!"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              استخدم <code className="rounded bg-muted px-1 py-0.5 text-primary font-mono">{'{remaining}'}</code> ليتم استبدالها بالمبلغ المتبقي تلقائياً.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">
              رسالة النجاح عند بلوغ الحد المطلوب
            </label>
            <input
              type="text"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
              className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs focus:ring-2 focus:ring-primary/20"
              placeholder="تهانينا! لقد حصلت على توصيل مجاني لكافة المدن 🚀"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              تظهر للعميل فور تجاوز سلة مشترياته الحد الأدنى
            </span>
          </div>
        </div>

        {/* Live Preview Box */}
        <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Eye className="size-3.5" />
            <span>معاينة حية لشريط العرض في سلة المشتريات:</span>
          </div>
          {isActive ? (
            <div className="rounded-xl bg-emerald-50/80 p-3 border border-emerald-200/70 dark:bg-emerald-950/30 dark:border-emerald-800/50">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                <Truck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  أضف <strong className="font-bold">{formatPrice(remainingSample)}</strong> للحصول على توصيل مجاني! (سلة افتراضية بـ {sampleSubtotal} د.ل من {thresholdNum} د.ل)
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-200/50 dark:bg-emerald-900/50">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                  style={{ width: `${sampleProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted p-3 text-center text-xs text-muted-foreground font-medium">
              العرض معطّل حالياً — لن يظهر شريط الشحن المجاني للعملاء في السلة أو صفحة الدفع.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-border/80">
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in">
                <CheckCircle2 className="size-4" />
                تم حفظ وتحديث إعدادات العرض بنجاح!
              </span>
            )}
          </div>
          <Button
            type="submit"
            loading={updatePromo.isPending}
            className="rounded-xl font-bold h-10 px-6 text-xs shadow-xs"
          >
            حفظ إعدادات العرض والشحن
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function AdminDiscounts() {
  usePageTitle('كوبونات الخصم — لوحة التحكم')
  const navigate = useNavigate()

  const query = useQuery({
    queryKey: ['discounts'],
    queryFn: async () => {
      const res = await api.get<Discount[]>('/discounts/')
      return res.data ?? []
    },
  })

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="كوبونات وعروض الخصم"
        description="إدارة عروض الشحن المجاني التلقائي في السلة، وقسائم الخصم النسبية والمبالغ الثابتة."
        action={
          <Button asChild size="sm" className="rounded-xl font-bold shadow-xs gap-1.5 h-10 px-4">
            <Link to="/admin/discounts/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>إضافة كوبون جديد</span>
            </Link>
          </Button>
        }
      />

      {/* Dynamic Cart Promotion & Free Shipping Management Card */}
      <CartPromotionManagerCard />

      <DataTable
        columns={[
          {
            key: 'code',
            header: 'كود الكوبون',
            cell: (d: Discount) => (
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Percent className="size-4" />
                </div>
                <div>
                  <span className="font-mono font-bold text-foreground text-xs sm:text-sm block">
                    {d.code || 'بدون كود (تلقائي)'}
                  </span>
                  <span className="text-[11px] text-muted-foreground block truncate">{d.name}</span>
                </div>
              </div>
            ),
          },
          {
            key: 'type',
            header: 'قيمة الخصم',
            cell: (d: Discount) => (
              <span className="font-mono font-bold text-price text-xs sm:text-sm">
                {d.type === 'percentage'
                  ? `٪${Number(d.percentage).toFixed(0)}`
                  : `${Number(d.value).toFixed(2)} د.ل`}
              </span>
            ),
          },
          {
            key: 'usage',
            header: 'معدل الاستخدام',
            cell: (d: Discount) => (
              <span className="font-mono text-xs text-foreground">
                {d.usage_limit ? `${d.usage_count} / ${d.usage_limit} مرة` : `${d.usage_count} مرة (غير محدود)`}
              </span>
            ),
          },
          {
            key: 'is_active',
            header: 'الحالة',
            cell: (d: Discount) =>
              d.is_active ? (
                <Badge tone="success" className="text-xs">ساري ومفعّل</Badge>
              ) : (
                <Badge tone="neutral" className="text-xs">معطّل</Badge>
              ),
          },
          {
            key: 'actions',
            header: '',
            align: 'end' as const,
            cell: (d: Discount) => (
              <Link
                to={`/admin/discounts/${d.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all inline-flex items-center gap-1"
              >
                <span>تعديل</span>
                <ArrowUpRight className="size-3" />
              </Link>
            ),
          },
        ]}
        rows={query.data ?? []}
        rowKey={(d: Discount) => d.id}
        isLoading={query.isPending}
        onRowClick={(d) => navigate(`/admin/discounts/${d.id}`)}
        emptyTitle="لا توجد كوبونات خصم"
        emptyDescription="أنشئ أول كود خصم لتقديمه لعملائك وتشجيع المبيعات."
        emptyAction={
          <Button asChild className="rounded-xl font-bold mt-2">
            <Link to="/admin/discounts/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>إنشاء كوبون جديد</span>
            </Link>
          </Button>
        }
      />
    </div>
  )
}

export function DiscountForm() {
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [amount, setAmount] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const create = useMutation({
    mutationFn: async () =>
      api.post('/admin/discounts/', {
        code,
        name,
        type,
        percentage: type === 'percentage' ? amount || null : null,
        value: type === 'fixed' ? amount || null : null,
        is_active: true,
        ...(usageLimit ? { usage_limit: Number(usageLimit) } : {}),
      }),
  })
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    await create.mutateAsync()
    queryClient.invalidateQueries({ queryKey: ['discounts'] })
    navigate('/admin/discounts')
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-6 animate-fade-rise">
      <PageHeader title="إنشاء كوبون خصم جديد" description="حدد كود الخصم، النسبة أو القيمة المالية الثابتة." />
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
        <div>
          <label htmlFor="d-code" className="block text-xs font-bold text-foreground mb-1.5">كود الكوبون</label>
          <input id="d-code" value={code} onChange={(e) => setCode(e.target.value)} required className="w-full h-11 rounded-xl border border-input bg-background px-3 font-mono uppercase text-xs focus:ring-2 focus:ring-primary/20" placeholder="SUMMER25" />
        </div>
        <div>
          <label htmlFor="d-name" className="block text-xs font-bold text-foreground mb-1.5">اسم ووصف العرض</label>
          <input id="d-name" value={name} onChange={(e) => setName(e.target.value)} required className="w-full h-11 rounded-xl border border-input bg-background px-3 text-xs" placeholder="خصم الصيف 2025" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">نوع الخصم</label>
            <select value={type} onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')} className="w-full h-11 rounded-xl border border-input bg-background px-3 text-xs">
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed">مبلغ ثابت (د.ل)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-foreground mb-1.5">قيمة الخصم</label>
            <input type="number" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required className="w-full h-11 rounded-xl border border-input bg-background px-3 font-mono text-xs" placeholder="15" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-foreground mb-1.5">الحد الأقصى لمرات الاستخدام (اختياري)</label>
          <input type="number" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="اتركه فارغاً إذا كان غير محدود" className="w-full h-11 rounded-xl border border-input bg-background px-3 font-mono text-xs" />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-border/80">
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/discounts')}>إلغاء</Button>
          <Button type="submit" loading={create.isPending} className="rounded-xl font-bold px-5">حفظ وتفعيل الكوبون</Button>
        </div>
      </div>
    </form>
  )
}
