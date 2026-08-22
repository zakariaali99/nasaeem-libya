import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCreateLayout, useDeleteLayout, useLayouts } from '@/lib/queries/customization'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminCustomization() {
  usePageTitle('تخصيص الصفحة الرئيسية')
  const { data: layouts, isPending } = useLayouts()
  const create = useCreateLayout()
  const remove = useDeleteLayout()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const layout = await create.mutateAsync(name.trim())
    setName('')
    setCreating(false)
    window.location.assign(`/admin/customization/${layout.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">تخصيص الصفحة الرئيسية</h1>
        <Button size="sm" onClick={() => setCreating((v) => !v)}>تخطيط جديد</Button>
      </div>

      {creating && (
        <form onSubmit={submit} className="flex max-w-md items-end gap-2 rounded-lg border border-border bg-card p-4">
          <div className="flex-1">
            <Field label="اسم التخطيط" id="layout-name">
              {(props) => (
                <Input {...props} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              )}
            </Field>
          </div>
          <Button type="submit" loading={create.isPending}>إنشاء</Button>
        </form>
      )}

      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : (layouts ?? []).length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          لا توجد تخطيطات بعد. أنشئ تخطيطاً وابنِ الصفحة الرئيسية من الصفر.
        </p>
      ) : (
        <ul className="space-y-3">
          {(layouts ?? []).map((layout) => (
            <li key={layout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm">
              <div>
                <Link
                  to={`/admin/customization/${layout.id}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {layout.name}
                </Link>
                <span className="ms-3 text-xs text-muted-foreground">
                  {layout.widgets.length} أداة · آخر تعديل{' '}
                  {new Date(layout.updated_at).toLocaleString('ar-LY')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {layout.is_global_active ? (
                  <Badge tone="success">معروض حالياً</Badge>
                ) : (
                  <Badge tone="neutral">غير مفعّل</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  loading={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`حذف التخطيط «${layout.name}»؟`)) remove.mutate(layout.id)
                  }}
                >
                  حذف
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
