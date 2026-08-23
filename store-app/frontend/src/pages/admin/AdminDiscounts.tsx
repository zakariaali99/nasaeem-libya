import { ArrowUpRight, Percent, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { DataTable } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
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
        description="إنشاء وتعديل قسائم الخصم النسبية والمبالغ الثابتة وتحديد حدود الاستخدام"
        action={
          <Button asChild size="sm" className="rounded-xl font-bold shadow-xs gap-1.5 h-10 px-4">
            <Link to="/admin/discounts/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>إضافة كوبون جديد</span>
            </Link>
          </Button>
        }
      />

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
