import { Blocks, CheckCircle2, Clock, Copy, Layout, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { api } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { LAYOUT_TEMPLATES } from '@/lib/layoutTemplates'
import {
  useCreateLayout,
  useDeleteLayout,
  useDuplicateLayout,
  useLayouts,
  useSaveLayout,
  type Layout as LayoutRecord,
} from '@/lib/queries/customization'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminCustomization() {
  usePageTitle('محرر الواجهة وتخصيص المتجر — لوحة التحكم')
  const navigate = useNavigate()
  const { data: layouts, isPending } = useLayouts()
  const create = useCreateLayout()
  const remove = useDeleteLayout()

  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [template, setTemplate] = useState<'' | 'store' | 'brand'>('')
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string; live: boolean } | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    const layout = await create.mutateAsync(name.trim())
    if (template) {
      // A new layout is never live, so filling it from a template changes nothing on the store.
      await api.patch(`/admin/storefront-layouts/${layout.id}/`, { widgets: LAYOUT_TEMPLATES[template].widgets })
    }
    setName('')
    setTemplate('')
    setCreating(false)
    navigate(`/admin/customization/${layout.id}`)
  }

  const layoutList = layouts ?? []

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="محرر الواجهة وتخصيص المتجر"
        description="كل تخطيط هو صفحة رئيسية كاملة. تخطيط واحد دائم يُعرض على المتجر، ويمكن لتخطيط مجدول أن يحلّ محله في وقت محدد."
        action={
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="rounded-xl font-bold shadow-xs gap-1.5 h-10 px-4"
          >
            <Plus className="size-4" />
            <span>إنشاء تخطيط جديد</span>
          </Button>
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
              onDelete={() => setPendingDelete({ id: layout.id, name: layout.name, live: layout.is_live })}
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

            <fieldset className="space-y-2">
              <legend className="text-sm font-bold">البداية</legend>
              {([['', 'صفحة فارغة', 'تضيف الأدوات بنفسك'] as const, ...(Object.entries(LAYOUT_TEMPLATES).map(([key, t]) => [key, t.label, t.description] as const))]).map(([key, label, description]) => (
                <label
                  key={key || 'blank'}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${template === key ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <input
                    type="radio"
                    name="layout-template"
                    className="mt-1"
                    checked={template === key}
                    onChange={() => setTemplate(key as '' | 'store' | 'brand')}
                  />
                  <span>
                    <span className="block font-bold">{label}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">القالب ترتيب أقسام فقط، بلا صور ولا منتجات. الأقسام الناقصة لا تظهر في المتجر حتى تملأها.</p>
            </fieldset>

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
        description={
          pendingDelete?.live
            ? `تخطيط «${pendingDelete?.name}» هو المعروض الآن على المتجر. حذفه قد يترك الصفحة الرئيسية فارغة. هل تريد الحذف؟`
            : `هل أنت متأكد من رغبتك في حذف تخطيط «${pendingDelete?.name}»؟ لن يؤثر ذلك على المنتجات.`
        }
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

function LayoutCard({ layout, onDelete }: { layout: LayoutRecord; onDelete: () => void }) {
  const save = useSaveLayout(layout.id)
  const duplicate = useDuplicateLayout()
  const [error, setError] = useState<string | null>(null)

  const toggleActive = async () => {
    setError(null)
    if (!layout.is_global_active && !layout.widgets.some((w) => w.is_active)) {
      setError('التخطيط فارغ. أضف أدوات من المحرر قبل عرضه على المتجر.')
      return
    }
    if (layout.is_live && !window.confirm('هذا التخطيط هو المعروض الآن. إيقافه قد يترك الصفحة الرئيسية فارغة. هل تريد الإيقاف؟')) {
      return
    }
    try {
      await save.mutateAsync({ is_global_active: !layout.is_global_active })
    } catch {
      setError('تعذّر تغيير حالة التخطيط')
    }
  }

  return (
    <div
      className={`flex flex-col gap-4 rounded-3xl border bg-card p-5 shadow-2xs ${
        layout.is_live ? 'border-emerald-500/50' : 'border-border'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl border ${
          layout.is_live ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-primary/10 text-primary border-primary/20'
        }`}>
          <Layout className="size-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="break-words font-bold text-sm sm:text-base text-foreground">{layout.name}</h3>
          <div className="flex flex-wrap gap-1.5">
            {layout.is_live ? (
              <Badge tone="success" className="text-xs font-bold gap-1">
                <CheckCircle2 className="size-3" />
                <span>معروض الآن</span>
              </Badge>
            ) : layout.is_global_active ? (
              <Badge tone="warning" className="text-xs">مفعّل — غير معروض الآن</Badge>
            ) : (
              <Badge tone="neutral" className="text-xs">غير معروض</Badge>
            )}
            {layout.has_schedule && (
              <Badge tone="neutral" className="text-xs gap-1">
                <Clock className="size-3" />
                <span>مجدول</span>
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {formatNumber(layout.widgets.length)} أداة · آخر تعديل{' '}
            {new Date(layout.updated_at).toLocaleDateString('ar-LY', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/80 pt-4">
        <Button asChild size="sm" className="h-9 flex-1 gap-1.5 rounded-xl text-xs font-bold">
          <Link to={`/admin/customization/${layout.id}`}>
            <Pencil className="size-3.5" />
            <span>تعديل</span>
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 flex-1 rounded-xl text-xs font-bold"
          onClick={toggleActive}
          loading={save.isPending}
        >
          {layout.is_global_active ? 'إيقاف' : 'عرض على المتجر'}
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-xl"
          title="نسخ التخطيط"
          aria-label="نسخ التخطيط"
          loading={duplicate.isPending}
          onClick={() => duplicate.mutate(layout.id)}
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="حذف التخطيط"
          aria-label="حذف التخطيط"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  )
}
