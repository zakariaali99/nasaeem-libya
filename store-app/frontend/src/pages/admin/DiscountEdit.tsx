import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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

export default function DiscountEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  usePageTitle('تعديل كود الخصم — لوحة التحكم')

  const queryClient = useQueryClient()
  const { data: discount, isLoading, isError } = useQuery({
    queryKey: ['discount', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Discount>(`/discounts/${id}/`)).data,
  })

  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'percentage' | 'fixed'>('percentage')
  const [amount, setAmount] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (discount) {
      setCode(discount.code || '')
      setName(discount.name || '')
      setType(discount.type || 'percentage')
      setAmount(discount.type === 'percentage' ? String(discount.percentage || '') : String(discount.value || ''))
      setUsageLimit(discount.usage_limit ? String(discount.usage_limit) : '')
      setIsActive(discount.is_active)
    }
  }, [discount])

  const update = useMutation({
    mutationFn: async () =>
      api.patch(`/discounts/${id}/`, {
        code: code.trim() || null,
        name: name.trim(),
        type,
        percentage: type === 'percentage' ? amount || null : null,
        value: type === 'fixed' ? amount || null : null,
        is_active: isActive,
        usage_limit: usageLimit ? Number(usageLimit) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discounts'] })
      queryClient.invalidateQueries({ queryKey: ['discount', id] })
      setSavedSuccess(true)
    },
  })

  if (isLoading) {
    return <Skeleton className="h-96 w-full max-w-xl" />
  }

  if (isError || !discount) {
    return (
      <div className="space-y-4">
        <Alert tone="error">الخصم المطلوب غير موجود.</Alert>
        <Button asChild variant="outline">
          <Link to="/admin/discounts">العودة للخصومات</Link>
        </Button>
      </div>
    )
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavedSuccess(false)
    await update.mutateAsync()
  }

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title={`تعديل الخصم: ${discount.name}`}
        description="تعديل نسبة أو قيمة الخصم، الكود، وحد الاستخدام."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/discounts">العودة للقائمة</Link>
          </Button>
        }
      />

      {savedSuccess && <Alert tone="success">تم حفظ تعديلات الخصم بنجاح.</Alert>}
      {update.isError && <Alert tone="error">حدث خطأ أثناء الحفظ، يرجى مراجعة البيانات.</Alert>}

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Checkbox
            id="isActive"
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(Boolean(checked))}
          />
          <label htmlFor="isActive" className="cursor-pointer text-sm font-medium text-foreground">
            كود الخصم مفعّل ونشط
          </label>
        </div>

        <Field label="كود الخصم" htmlFor="code">
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SUMMER2026"
            dir="ltr"
          />
        </Field>

        <Field label="اسم الخصم (لأغراض الإدارة)" htmlFor="name">
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </Field>

        <Field label="نوع الخصم" htmlFor="type">
          <Select
            id="type"
            value={type}
            onChange={(e) => setType(e.target.value as 'percentage' | 'fixed')}
          >
            <option value="percentage">نسبة مئوية (٪)</option>
            <option value="fixed">مبلغ ثابت (د.ل)</option>
          </Select>
        </Field>

        <Field
          label={type === 'percentage' ? 'النسبة المئوية' : 'المبلغ الثابت'}
          htmlFor="amount"
        >
          <Input
            id="amount"
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={type === 'percentage' ? '15' : '25.00'}
            required
          />
        </Field>

        <Field label="الحد الأقصى لعدد مرات الاستخدام (اختياري)" htmlFor="usageLimit">
          <Input
            id="usageLimit"
            type="number"
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            placeholder="مثال: 100"
          />
        </Field>

        <div className="flex justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => navigate('/admin/discounts')}>
            إلغاء
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          </Button>
        </div>
      </form>
    </div>
  )
}
