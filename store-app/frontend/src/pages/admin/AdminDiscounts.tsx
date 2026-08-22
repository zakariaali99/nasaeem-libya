import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'

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
  const query = useQuery({
    queryKey: ['discounts'],
    queryFn: async () => (await api.get<{ data: Discount[] }>('/discounts/')).data,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الخصومات</h1>
        <Link to="/admin/discounts/new"><Button size="sm">خصم جديد</Button></Link>
      </div>
      <DataTable
        columns={[
          { key: 'code', header: 'الكود', cell: (d: Discount) => d.code ? <span className="font-mono font-semibold">{d.code}</span> : '—' },
          { key: 'name', header: 'الاسم', cell: (d: Discount) => d.name },
          { key: 'type', header: 'النوع', cell: (d: Discount) => (d.type === 'percentage' ? `٪${Number(d.percentage).toFixed(0)}` : `${Number(d.value).toFixed(2)} د.ل`) },
          { key: 'usage', header: 'الاستخدام', cell: (d: Discount) => d.usage_limit ? `${d.usage_count} / ${d.usage_limit}` : `${d.usage_count}` },
          { key: 'is_active', header: 'الحالة', cell: (d: Discount) => d.is_active ? <Badge tone="success">مفعّل</Badge> : <Badge tone="neutral">معطّل</Badge> },
          {
            key: 'actions',
            header: 'الإجراءات',
            cell: (d: Discount) => (
              <Button asChild size="sm" variant="outline">
                <Link to={`/admin/discounts/${d.id}`}>تعديل</Link>
              </Button>
            ),
          },
        ]}
        rows={query.data?.data ?? []}
        rowKey={(d: Discount) => d.id}
        isLoading={query.isPending}
        emptyTitle="لا توجد خصومات"
        emptyDescription="أنشئ أول كود خصم من الزر بالأعلى."
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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    await create.mutateAsync()
    queryClient.invalidateQueries({ queryKey: ['discounts'] })
    window.location.href = '/admin/discounts'
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">خصم جديد</h1>
      <Field label="الكود" id="d-code">
        {(props) => <Input {...props} value={code} onChange={(e) => setCode(e.target.value)} required />}
      </Field>
      <Field label="الاسم" id="d-name">
        {(props) => <Input {...props} value={name} onChange={(e) => setName(e.target.value)} required />}
      </Field>
      <Field label="النوع" id="d-type">
        {(props) => (
          <Select {...props} value={type} onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}>
            <option value="percentage">نسبة مئوية</option>
            <option value="fixed">مبلغ ثابت</option>
          </Select>
        )}
      </Field>
      <Field label={type === 'percentage' ? 'النسبة ٪' : 'المبلغ د.ل'} id="d-amount">
        {(props) => <Input {...props} type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />}
      </Field>
      <Field label="حد الاستخدام (اختياري)" id="d-limit">
        {(props) => <Input {...props} type="number" min="0" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} />}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={create.isPending}>إنشاء</Button>
        <Link to="/admin/discounts"><Button type="button" variant="outline">إلغاء</Button></Link>
      </div>
    </form>
  )
}
