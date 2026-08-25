import { ArrowUpRight, Blocks, CheckCircle2, Layout, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { useCreateLayout, useDeleteLayout, useLayouts, useSaveLayout } from '@/lib/queries/customization'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminCustomization() {
  usePageTitle('محرر الواجهة وتخصيص المتجر — لوحة التحكم')
  const navigate = useNavigate()
  const { data: layouts, isPending } = useLayouts()
  const create = useCreateLayout()
  const remove = useDeleteLayout()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const layout = await create.mutateAsync(name.trim())
    setName('')
    setCreating(false)
    navigate(`/admin/customization/${layout.id}`)
  }

  const createPreset = async (presetName: string) => {
    const layout = await create.mutateAsync(presetName)
    navigate(`/admin/customization/${layout.id}`)
  }

  const layoutList = layouts ?? []

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="محرر الواجهة وتخصيص المتجر"
        description="التحكم الكامل في واجهات وصفحات المتجر، البانرات التفاعلية، باقات العينات، والشرائح الترويجية."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => createPreset('قالب عروض العيد والمناسبات')}
              className="rounded-xl font-bold gap-1.5 h-10 px-4 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles className="size-4" />
              <span>قالب عروض جديد</span>
            </Button>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              className="rounded-xl font-bold shadow-xs gap-1.5 h-10 px-4"
            >
              <Plus className="size-4" />
              <span>إنشاء تخطيط جديد</span>
            </Button>
          </div>
        }
      />

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      ) : layoutList.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-xs space-y-3">
          <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Blocks className="size-7" />
          </div>
          <h2 className="text-lg font-bold text-foreground">لا توجد تخطيطات مخصصة بعد</h2>
          <p className="max-w-md mx-auto text-xs text-muted-foreground leading-relaxed">
            أنشئ أول تخطيط لتخصيص البانرات والمنتجات المعروضة على الصفحة الرئيسية لمتجرك.
          </p>
          <Button onClick={() => setCreating(true)} className="rounded-xl font-bold mt-2">
            <Plus className="size-4" />
            <span>إنشاء أول تخطيط</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layoutList.map((layout) => (
            <LayoutCard
              key={layout.id}
              layout={layout}
              onDelete={() => setPendingDelete({ id: layout.id, name: layout.name })}
            />
          ))}
        </div>
      )}

      {/* Create Layout Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogTitle>إنشاء تخطيط جديد للصفحة الرئيسية</DialogTitle>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <Field label="اسم التخطيط" id="layout-name" hint="مثال: واجهة الصيف، عروض العيد، تخطيط العطور الرجالية">
              {(props) => (
                <Input
                  {...props}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسماً مميزاً للتخطيط..."
                  className="h-11 rounded-xl text-sm"
                  required
                  autoFocus
                />
              )}
            </Field>

            <div className="flex justify-end gap-2.5 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)} className="rounded-xl">
                إلغاء
              </Button>
              <Button type="submit" loading={create.isPending} disabled={!name.trim()} className="rounded-xl font-bold">
                إنشاء والبدء في التعديل
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف التخطيط"
        description={`هل أنت متأكد من رغبتك في حذف تخطيط «${pendingDelete?.name}»؟ لن يؤثر ذلك على المنتجات.`}
        confirmLabel="تأكيد الحذف"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await remove.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

function LayoutCard({
  layout,
  onDelete,
}: {
  layout: {
    id: string
    name: string
    is_global_active: boolean
    updated_at: string
    widgets: Array<{ id: string; type: string }>
  }
  onDelete: () => void
}) {
  const save = useSaveLayout(layout.id)

  const toggleActive = async () => {
    await save.mutateAsync({
      is_global_active: !layout.is_global_active,
    })
  }

  return (
    <div className={`group relative flex flex-col justify-between rounded-3xl border bg-card p-5 shadow-2xs transition-all duration-200 hover:shadow-md ${
      layout.is_global_active ? 'border-emerald-500/40 bg-emerald-500/2' : 'border-border hover:border-primary/40'
    }`}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
              layout.is_global_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'
            }`}>
              <Layout className="size-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm sm:text-base text-foreground truncate group-hover:text-primary transition-colors">
                {layout.name}
              </h3>
              <span className="text-[11px] text-muted-foreground block font-mono">
                {formatNumber(layout.widgets.length)} أداة مضمنة
              </span>
            </div>
          </div>

          {layout.is_global_active ? (
            <Badge tone="success" className="text-xs font-bold shrink-0 gap-1">
              <CheckCircle2 className="size-3" />
              <span>معروض على المتجر</span>
            </Badge>
          ) : (
            <Badge tone="neutral" className="text-xs shrink-0">
              مسودة
            </Badge>
          )}
        </div>

        <div className="rounded-xl bg-muted/30 p-2.5 border border-border/50 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>آخر تحديث:</span>
            <span className="font-mono font-medium text-foreground">
              {new Date(layout.updated_at).toLocaleDateString('ar-LY', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-4 mt-2 border-t border-border/80">
        <Button
          asChild
          size="sm"
          className="rounded-xl font-bold text-xs flex-1 gap-1 h-9 shadow-2xs"
        >
          <Link to={`/admin/customization/${layout.id}`}>
            <span>المحرر المرئي والأدوات</span>
            <ArrowUpRight className="size-3.5" />
          </Link>
        </Button>

        <Button
          variant={layout.is_global_active ? 'outline' : 'secondary'}
          size="sm"
          className="h-9 px-3 rounded-xl text-xs font-bold"
          onClick={toggleActive}
          loading={save.isPending}
          title={layout.is_global_active ? 'إيقاف عرض التخطيط' : 'تفعيل هذا التخطيط على المتجر الآن'}
        >
          {layout.is_global_active ? 'إيقاف' : 'تفعيل'}
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-border"
          title="حذف التخطيط"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
