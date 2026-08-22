import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { GripVertical, Trash2 } from 'lucide-react'
import { WidgetRenderer } from '@/components/storefront/widgets'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import type { Widget } from '@/types/api'
import {
  useLayout,
  useSaveLayout,
  type LayoutDraft,
} from '@/lib/queries/customization'

const TYPE_LABELS: Record<string, string> = {
  announcement_bar: 'شريط إعلان',
  hero_cta: 'بانر رئيسي',
  carousel: 'شرائح متحركة',
  category_list: 'قائمة تصنيفات',
  product_list: 'قائمة منتجات',
  text_block: 'نص',
  photo_link_grid: 'شبكة صور بروابط',
  collection_showcase: 'عرض مجموعة',
  spacer: 'مسافة فارغة',
  image: 'صورة',
  recently_viewed: 'شاهدت مؤخراً',
  buy_again: 'اشترِ مرة أخرى',
  recommended_for_you: 'مقترحات لك',
  trending_near_you: 'الأكثر رواجاً',
}

/** Field keys match `services.normalise_widget_data` exactly — the server
 * canonicalises on write, so the editor speaks the same names it saves. */
const FIELD_SPECS: Record<string, { key: string; label: string; kind?: 'number' | 'textarea' | 'url' }[]> = {
  announcement_bar: [{ key: 'message', label: 'النص' }, { key: 'title', label: 'عنوان صغير' }, { key: 'linkLabel', label: 'نص الرابط' }, { key: 'linkUrl', label: 'الرابط', kind: 'url' }],
  hero_cta: [{ key: 'title', label: 'العنوان' }, { key: 'subtitle', label: 'العنوان الفرعي' }, { key: 'backgroundImageUrl', label: 'صورة الخلفية', kind: 'url' }, { key: 'buttonLabel', label: 'نص الزر' }, { key: 'buttonUrl', label: 'رابط الزر', kind: 'url' }],
  carousel: [],
  category_list: [{ key: 'title', label: 'العنوان' }],
  product_list: [{ key: 'title', label: 'العنوان' }],
  collection_showcase: [],
  text_block: [{ key: 'content', label: 'النص', kind: 'textarea' }],
  photo_link_grid: [{ key: 'title', label: 'العنوان' }],
  image: [{ key: 'imageUrl', label: 'رابط الصورة', kind: 'url' }, { key: 'linkUrl', label: 'الرابط', kind: 'url' }, { key: 'altText', label: 'النص البديل' }],
  spacer: [],
  recently_viewed: [{ key: 'title', label: 'العنوان' }],
  buy_again: [{ key: 'title', label: 'العنوان' }],
  recommended_for_you: [{ key: 'title', label: 'العنوان' }],
  trending_near_you: [{ key: 'title', label: 'العنوان' }],
}

const CHOICE_SPECS: Record<string, { key: string; label: string; options: { value: string; label: string }[] }[]> = {
  announcement_bar: [{
    key: 'icon', label: 'الأيقونة',
    options: [
      { value: 'megaphone', label: 'مكبر صوت' }, { value: 'info', label: 'معلومة' },
      { value: 'sparkles', label: 'لمعة' }, { value: 'bell', label: 'جرس' },
      { value: 'gift', label: 'هدية' }, { value: 'star', label: 'نجمة' },
      { value: 'tag', label: 'وسم سعر' },
    ],
  }],
  spacer: [{
    key: 'height', label: 'الارتفاع',
    options: [
      { value: 'sm', label: 'صغير' }, { value: 'md', label: 'متوسط' },
      { value: 'lg', label: 'كبير' }, { value: 'xl', label: 'أكبر' },
      { value: '2xl', label: 'ضخم' },
    ],
  }],
}


const WEEKDAYS = [
  { value: 6, label: 'الأحد' }, { value: 0, label: 'الاثنين' }, { value: 1, label: 'الثلاثاء' },
  { value: 2, label: 'الأربعاء' }, { value: 3, label: 'الخميس' }, { value: 4, label: 'الجمعة' },
  { value: 5, label: 'السبت' },
]

function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface DraftWidget {
  id?: string
  type: string
  data: Record<string, unknown>
  is_active: boolean
}

export default function WidgetBuilder() {
  const { layoutId = '' } = useParams()
  const { data: layout, isPending } = useLayout(layoutId)
  const save = useSaveLayout(layoutId)

  const [draftWidgets, setDraftWidgets] = useState<DraftWidget[] | null>(null)
  const [selected, setSelected] = useState(0)
  const [savedNotice, setSavedNotice] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<LayoutDraft | null>(null)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  const currentSchedule: LayoutDraft = schedule ?? {
    name: layout?.name ?? '',
    is_global_active: layout?.is_global_active ?? false,
    active_start_date: layout?.active_start_date ?? null,
    active_end_date: layout?.active_end_date ?? null,
    active_days: layout?.active_days ?? [],
    active_start_hour: layout?.active_start_hour ?? null,
    active_end_hour: layout?.active_end_hour ?? null,
  }
  const setScheduleField = (patch: Partial<LayoutDraft>) => {
    setSchedule({ ...currentSchedule, ...patch })
    setSavedNotice(null)
  }

  const widgets: DraftWidget[] =
    draftWidgets ?? (layout?.widgets ?? []).map((w) => ({
      id: w.id,
      type: w.type,
      data: (w.data ?? {}) as Record<string, unknown>,
      is_active: w.is_active,
    }))
  const setWidgets = (next: DraftWidget[]) => {
    setDraftWidgets(next)
    setSavedNotice(null)
  }
  const current = widgets[selected]

  if (isPending) return <Skeleton className="h-96 w-full" />
  if (!layout) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        التخطيط غير موجود.{' '}
        <Link to="/admin/customization" className="text-primary underline">العودة إلى القائمة</Link>
      </p>
    )
  }

  const addWidget = (type: string) => {
    setWidgets([...widgets, { type, data: {}, is_active: true }])
    setSelected(widgets.length)
  }

  const removeWidget = (index: number) => {
    setWidgets(widgets.filter((_, i) => i !== index))
    setSelected((s) => Math.max(0, Math.min(s, widgets.length - 2)))
  }

  /** Reorder — shared by drag-and-drop AND the keyboard buttons. One code path
   * so both input methods cannot disagree about what reordering means. */
  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= widgets.length || from === to) return
    const next = [...widgets]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    setWidgets(next)
    setSelected(to)
  }

  const updateField = (key: string, value: unknown) => {
    setWidgets(widgets.map((w, i) =>
      i === selected ? { ...w, data: { ...w.data, [key]: value } } : w,
    ))
  }

  const toggleActive = (index: number) => {
    setWidgets(widgets.map((w, i) => (i === index ? { ...w, is_active: !w.is_active } : w)))
  }

  const saveAll = async () => {
    const body: Parameters<typeof save.mutateAsync>[0] = {
      ...currentSchedule,
      widgets: widgets.map((w) => ({
        id: w.id, type: w.type, data: w.data, is_active: w.is_active,
      })),
    }
    await save.mutateAsync(body)
    setDraftWidgets(null)
    setSchedule(null)
    setSavedNotice('تم الحفظ — الصفحة الرئيسية تعرض التغييرات الآن')
  }

  const toggleGlobalActive = async () => {
    await save.mutateAsync({ ...currentSchedule, is_global_active: !currentSchedule.is_global_active })
    setSchedule(null)
    setSavedNotice(!currentSchedule.is_global_active ? 'التخطيط الآن معروض على المتجر' : 'تم إيقاف عرض التخطيط')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{layout.name}</h1>
          <p className="text-sm text-muted-foreground">
            {currentSchedule.is_global_active ? 'هذا التخطيط معروض حالياً على الصفحة الرئيسية.' : 'التخطيط محفوظ لكنه غير معروض.'}
          </p>
          {savedNotice && (
            <p role="status" aria-live="polite" className="mt-1 text-sm font-semibold text-success">
              {savedNotice}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant={currentSchedule.is_global_active ? 'outline' : 'default'} onClick={toggleGlobalActive} loading={save.isPending}>
            {currentSchedule.is_global_active ? 'إيقاف العرض' : 'عرض على المتجر'}
          </Button>
          <Button onClick={saveAll} loading={save.isPending}>حفظ التغييرات</Button>
        </div>
      </div>


        <section aria-label="جدولة العرض والاستهداف" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="font-semibold">جدولة العرض</h2>
          <p className="text-xs text-muted-foreground">
            اتركها فارغة ليُعرض التخطيط دائماً. تُستخدم القواعد عند تطابق التاريخ والأيام والساعة.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="يبدأ في" id="sched-start">
              {(props) => (
                <Input {...props} type="datetime-local"
                  value={toLocalInput(currentSchedule.active_start_date)}
                  onChange={(e) => setScheduleField({ active_start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              )}
            </Field>
            <Field label="ينتهي في" id="sched-end">
              {(props) => (
                <Input {...props} type="datetime-local"
                  value={toLocalInput(currentSchedule.active_end_date)}
                  onChange={(e) => setScheduleField({ active_end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
              )}
            </Field>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">أيام الأسبوع</legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={(currentSchedule.active_days ?? []).includes(value)}
                    onChange={(e) => {
                      const days = new Set(currentSchedule.active_days ?? [])
                      if (e.target.checked) days.add(value); else days.delete(value)
                      setScheduleField({ active_days: [...days].sort() })
                    }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="من الساعة" id="sched-hour-start">
              {(props) => (
                <Select {...props}
                  value={String(currentSchedule.active_start_hour ?? '')}
                  onChange={(e) => setScheduleField({ active_start_hour: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">—</option>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h}:00`}</option>)}
                </Select>
              )}
            </Field>
            <Field label="إلى الساعة" id="sched-hour-end">
              {(props) => (
                <Select {...props}
                  value={String(currentSchedule.active_end_hour ?? '')}
                  onChange={(e) => setScheduleField({ active_end_hour: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">—</option>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h}:00`}</option>)}
                </Select>
              )}
            </Field>
          </div>
        </section>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* ---- widget list: drag with a mouse, reorder with the keyboard ---- */}
        <section aria-label="أدوات الصفحة" className="space-y-2">
          <ul className="space-y-1" onDragOver={(e) => e.preventDefault()}>
            {widgets.map((widget, index) => (
              <li
                key={widget.id ?? `new-${index}`}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
                onDrop={(e) => {
                  e.preventDefault()
                  reorder(Number(e.dataTransfer.getData('text/plain')), index)
                }}
                className={`flex items-center gap-1 rounded-md border p-2 text-sm ${
                  index === selected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
              >
                <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-start focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() => setSelected(index)}
                  onKeyDown={(event) => {
                    // Keyboard reordering: Ctrl/⌘+Arrow moves the row.
                    if (event.ctrlKey || event.metaKey) {
                      if (event.key === 'ArrowUp') { event.preventDefault(); reorder(index, index - 1) }
                      if (event.key === 'ArrowDown') { event.preventDefault(); reorder(index, index + 1) }
                    }
                  }}
                >
                  {TYPE_LABELS[widget.type] ?? widget.type}
                  {!widget.is_active && <span className="ms-2 text-xs text-muted-foreground">(معطّلة)</span>}
                </button>
                <span className="flex shrink-0 flex-col">
                  <button
                    type="button" aria-label={`تحريك ${TYPE_LABELS[widget.type] ?? widget.type} لأعلى`}
                    disabled={index === 0}
                    onClick={() => reorder(index, index - 1)}
                    className="h-4 px-1 text-xs leading-none text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >▲</button>
                  <button
                    type="button" aria-label={`تحريك ${TYPE_LABELS[widget.type] ?? widget.type} لأسفل`}
                    disabled={index === widgets.length - 1}
                    onClick={() => reorder(index, index + 1)}
                    className="h-4 px-1 text-xs leading-none text-muted-foreground hover:text-foreground disabled:opacity-30"
                  >▼</button>
                </span>
              </li>
            ))}
          </ul>

          <div className="rounded-md border border-dashed border-border p-3">
            <Field label="إضافة أداة" id="add-widget-type">
              {(props) => (
                <Select {...props} value="" onChange={(e) => { if (e.target.value) addWidget(e.target.value) }}>
                  <option value="">اختر نوع الأداة…</option>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
        </section>

        {/* ---- editor + live preview ---- */}
        <div className="space-y-6">
          {current ? (
            <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label={`تعديل ${TYPE_LABELS[current.type] ?? current.type}`}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{TYPE_LABELS[current.type] ?? current.type}</h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={current.is_active}
                    onChange={() => toggleActive(selected)}
                  />
                  نشطة
                </label>
                <Button variant="outline" size="sm" onClick={() => removeWidget(selected)}>
                  <Trash2 className="size-4" aria-hidden /> حذف الأداة
                </Button>
              </div>

              {(FIELD_SPECS[current.type] ?? []).map((spec) => (
                <Field key={spec.key} label={spec.label} id={`f-${spec.key}`}
                  hint={!['announcement_bar', 'hero_cta', 'carousel', 'category_list', 'product_list', 'collection_showcase', 'photo_link_grid', 'image', 'spacer', 'text_block'].includes(current.type) ? 'يملؤه النظام من سجلّ التصفح والطلبات عند العرض' : undefined}>
                  {(props) => spec.kind === 'textarea' ? (
                    <textarea
                      {...props}
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={String(current.data[spec.key] ?? '')}
                      onChange={(e) => updateField(spec.key, e.target.value)}
                    />
                  ) : (
                    <Input
                      {...props}
                      type={spec.kind === 'number' ? 'number' : 'text'}
                      value={String(current.data[spec.key] ?? '')}
                      onChange={(e) => updateField(
                        spec.key,
                        spec.kind === 'number' ? Number(e.target.value || 0) : e.target.value,
                      )}
                    />
                  )}
                </Field>
              ))}

              {(CHOICE_SPECS[current.type] ?? []).map((spec) => (
                <Field key={spec.key} label={spec.label} id={`c-${spec.key}`}>
                  {(props) => (
                    <Select
                      {...props}
                      value={String(current.data[spec.key] ?? spec.options[0]!.value)}
                      onChange={(e) => updateField(spec.key, e.target.value)}
                    >
                      {spec.options.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  )}
                </Field>
              ))}

              {/* Scheduling & targeting for this widget */}
              <p className="text-xs text-muted-foreground">
                الاستهداف الزمني يُضبط على مستوى التخطيط كله من الحقول أدناه.
              </p>
            </section>
          ) : (
            <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              أضف أول أداة من القائمة الجانبية.
            </p>
          )}

          {/* Live preview — the SAME renderers the storefront uses with device switcher */}
          <section aria-label="معاينة مباشرة" className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="font-bold text-foreground">معاينة مباشرة للتخطيط</h2>
                <p className="text-xs text-muted-foreground">شاهد كيف تبدو الواجهة على مختلف الأجهزة</p>
              </div>

              {/* Device Frame Switcher */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/50 p-1">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    previewDevice === 'desktop'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🖥️ شاشة كاملة
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    previewDevice === 'tablet'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📟 جهاز لوحي
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    previewDevice === 'mobile'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📱 هاتف
                </button>
              </div>
            </div>

            <div className="flex justify-center bg-muted/30 p-4 rounded-xl overflow-x-auto">
              <div
                className={`transition-all duration-300 space-y-4 overflow-hidden rounded-xl border border-border bg-background p-3 shadow-sm ${
                  previewDevice === 'mobile'
                    ? 'w-[375px] shrink-0'
                    : previewDevice === 'tablet'
                    ? 'w-[768px] shrink-0'
                    : 'w-full'
                }`}
              >
                {widgets.filter((w) => w.is_active).length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">لا توجد أدوات نشطة للعرض</p>
                ) : (
                  widgets.filter((w) => w.is_active).map((widget, previewIndex) => (
                    <WidgetRenderer
                      key={widget.id ?? `preview-${previewIndex}`}
                      widget={{
                        id: widget.id ?? `preview-${previewIndex}`,
                        type: widget.type as Widget['type'],
                        data: widget.data as Widget['data'],
                        order: previewIndex,
                        is_active: true,
                        style: null,
                        targeting: null,
                      }}
                    />
                  ))
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              الأدوات التي يملؤها النظام (منتجات، تصنيفات، مقترحات…) تُظهر محتواها بعد الحفظ على الصفحة الرئيسية الفعلية.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
