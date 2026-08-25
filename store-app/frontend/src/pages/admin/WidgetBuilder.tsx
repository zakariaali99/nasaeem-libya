import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { GripVertical, Trash2 } from 'lucide-react'
import { ImageUploadField } from '@/components/admin/ImageUploadField'
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
  announcement_bar: 'شريط إعلان علوي',
  hero_cta: 'بانر رئيسي تفاعلي',
  discovery_box: 'باقة عينات التجربة والكاش باك 🧪',
  trust_badges: 'شريط مزايا وضمانات المتجر',
  carousel: 'شرائح متحركة (Carousel)',
  category_list: 'قائمة تصنيفات',
  product_list: 'قائمة منتجات',
  text_block: 'كتلة نصية',
  photo_link_grid: 'شبكة صور بروابط',
  collection_showcase: 'عرض مجموعة',
  free_shipping_bar: 'شريط الشحن المجاني',
  gift_wrap_upsell: 'تغليف الهدايا الفاخر',
  spacer: 'مسافة فارغة',
  image: 'صورة منفردة',
  recently_viewed: 'شاهدت مؤخراً',
  buy_again: 'اشترِ مرة أخرى',
  recommended_for_you: 'مقترحات لك',
  trending_near_you: 'الأكثر رواجاً',
}

/** Field keys match `services.normalise_widget_data` exactly — the server
 * canonicalises on write, so the editor speaks the same names it saves. */
const FIELD_SPECS: Record<string, { key: string; label: string; kind?: 'number' | 'textarea' | 'image' | 'boolean' }[]> = {
  announcement_bar: [
    { key: 'message', label: 'نص الإعلان' },
    { key: 'title', label: 'عنوان الإعلان (اختياري)' },
    { key: 'linkLabel', label: 'نص الزر/الرابط' },
    { key: 'linkUrl', label: 'رابط التوجيه' },
  ],
  hero_cta: [
    { key: 'title', label: 'العنوان الرئيسي للبانر' },
    { key: 'subtitle', label: 'العنوان الفرعي' },
    { key: 'desktopImageUrl', label: 'صورة الحاسوب والشاشات الكبيرة (Desktop Image)', kind: 'image' },
    { key: 'mobileImageUrl', label: 'صورة الهاتف والموبايل (Mobile Phone Image)', kind: 'image' },
    { key: 'buttonLabel', label: 'نص زر الإجراء' },
    { key: 'buttonUrl', label: 'رابط زر الإجراء' },
  ],
  discovery_box: [
    { key: 'title', label: 'عنوان باقة العينات' },
    { key: 'badge', label: 'شارة العرض (مثال: ضمان الرضا الكامل 🧪)' },
    { key: 'price', label: 'سعر باقة العينات (مثال: 60 د.ل)' },
    { key: 'sampleCount', label: 'عدد العينات (مثال: 5)', kind: 'number' },
    { key: 'cashbackPercent', label: 'نسبة الكاش باك المسترد % (مثال: 100)', kind: 'number' },
    { key: 'buttonText', label: 'نص زر الطلب' },
    { key: 'linkUrl', label: 'رابط التوجيه عند النقر' },
    { key: 'description', label: 'نص الوصف التوضيحي (اتركه فارغاً للتوليد التلقائي)', kind: 'textarea' },
  ],
  trust_badges: [
    { key: 'title', label: 'عنوان قسم المزايا (اختياري)' },
  ],
  free_shipping_bar: [
    { key: 'threshold', label: 'الحد الأدنى للشحن المجاني (د.ل)', kind: 'number' },
    { key: 'messageBefore', label: 'رسالة الحث (استخدم {amount} لقيمة المتبقي)' },
    { key: 'messageAfter', label: 'رسالة التأهل للشحن المجاني' },
  ],
  gift_wrap_upsell: [
    { key: 'title', label: 'عنوان جناح التغليف الفاخر' },
    { key: 'price', label: 'سعر التغليف' },
    { key: 'description', label: 'وصف صندوق الهدايا وبطاقة الإهداء', kind: 'textarea' },
    { key: 'imageUrl', label: 'صورة صندوق الهدايا', kind: 'image' },
  ],
  carousel: [],
  category_list: [{ key: 'title', label: 'العنوان' }],
  product_list: [{ key: 'title', label: 'العنوان' }],
  collection_showcase: [],
  text_block: [{ key: 'content', label: 'النص', kind: 'textarea' }],
  photo_link_grid: [{ key: 'title', label: 'العنوان' }],
  image: [
    { key: 'imageUrl', label: 'ملف الصورة', kind: 'image' },
    { key: 'linkUrl', label: 'رابط التوجيه عند النقر' },
    { key: 'altText', label: 'النص البديل' },
  ],
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
      { value: 'sparkles', label: 'لمعة ذهبية ✨' },
      { value: 'megaphone', label: 'مكبر صوت 📢' },
      { value: 'gift', label: 'هدية 🎁' },
      { value: 'star', label: 'نجمة ⭐' },
      { value: 'tag', label: 'وسم سعر 🏷️' },
      { value: 'bell', label: 'جرس 🔔' },
      { value: 'info', label: 'معلومة ℹ️' },
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

function toLocalInput(iso: string | null | undefined): string {
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

              {(FIELD_SPECS[current.type] ?? []).map((spec) => {
                if (spec.kind === 'image') {
                  const currentValue = String(
                    current.data[spec.key] ??
                      (spec.key === 'desktopImageUrl' ? current.data.backgroundImageUrl ?? '' : ''),
                  )
                  return (
                    <ImageUploadField
                      key={spec.key}
                      label={spec.label}
                      value={currentValue}
                      aspectRatio={spec.key === 'desktopImageUrl' ? 'banner' : spec.key === 'mobileImageUrl' ? 'video' : 'auto'}
                      onChange={(url) => {
                        updateField(spec.key, url)
                        if (spec.key === 'desktopImageUrl') {
                          updateField('backgroundImageUrl', url)
                        }
                      }}
                    />
                  )
                }

                return (
                  <Field
                    key={spec.key}
                    label={spec.label}
                    id={`f-${spec.key}`}
                    hint={
                      !['announcement_bar', 'hero_cta', 'carousel', 'category_list', 'product_list', 'collection_showcase', 'photo_link_grid', 'image', 'spacer', 'text_block'].includes(current.type)
                        ? 'يملؤه النظام من سجلّ التصفح والطلبات عند العرض'
                        : undefined
                    }
                  >
                    {(props) =>
                      spec.kind === 'textarea' ? (
                        <textarea
                          {...props}
                          rows={3}
                          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs sm:text-sm"
                          value={String(current.data[spec.key] ?? '')}
                          onChange={(e) => updateField(spec.key, e.target.value)}
                        />
                      ) : (
                        <Input
                          {...props}
                          type={spec.kind === 'number' ? 'number' : 'text'}
                          value={String(current.data[spec.key] ?? '')}
                          onChange={(e) =>
                            updateField(
                              spec.key,
                              spec.kind === 'number' ? Number(e.target.value || 0) : e.target.value,
                            )
                          }
                          className="rounded-xl text-xs sm:text-sm"
                        />
                      )
                    }
                  </Field>
                )
              })}

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

              {current.type === 'discovery_box' && (
                <div className="space-y-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                  <h4 className="text-xs font-bold text-foreground">خيارات العرض في صفحات المتجر:</h4>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={current.data.showInCart !== false}
                        onChange={(e) => updateField('showInCart', e.target.checked)}
                      />
                      <span>إظهار بانر باقة العينات داخل صفحة سلة المشتريات (Cart Page)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={current.data.showInProductDetail !== false}
                        onChange={(e) => updateField('showInProductDetail', e.target.checked)}
                      />
                      <span>إظهار بانر باقة العينات داخل صفحة تفاصيل العطر (Product Page)</span>
                    </label>
                  </div>
                </div>
              )}

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
          <section aria-label="معاينة مباشرة" className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h2 className="font-bold text-foreground text-sm sm:text-base">معاينة مباشرة وتفاعلية للتخطيط</h2>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  شاهد التعديلات تنعكس فورياً كما ستظهر لزبائن المتجر على مختلف الشاشات
                </p>
              </div>

              {/* Device Frame Switcher */}
              <div className="flex items-center gap-1.5 rounded-2xl border border-border bg-muted/60 p-1.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    previewDevice === 'desktop'
                      ? 'bg-card text-foreground shadow-xs border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  🖥️ حاسوب (شاشة كاملة)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    previewDevice === 'tablet'
                      ? 'bg-card text-foreground shadow-xs border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📟 جهاز لوحي (768px)
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    previewDevice === 'mobile'
                      ? 'bg-card text-foreground shadow-xs border border-border'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📱 هاتف ذكي (375px)
                </button>
              </div>
            </div>

            {/* Device Mockup Frame Container */}
            <div className="flex justify-center bg-muted/30 p-3 sm:p-6 rounded-2xl overflow-x-auto border border-border/60">
              <div
                className={`transition-all duration-300 overflow-hidden rounded-2xl border-2 border-border/80 bg-background shadow-lg ${
                  previewDevice === 'mobile'
                    ? 'w-[375px] shrink-0'
                    : previewDevice === 'tablet'
                    ? 'w-[768px] shrink-0'
                    : 'w-full max-w-5xl'
                }`}
              >
                {/* Browser Mockup Chrome Bar */}
                <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3.5 py-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-400/80" />
                    <span className="size-2.5 rounded-full bg-amber-400/80" />
                    <span className="size-2.5 rounded-full bg-emerald-400/80" />
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] bg-background/80 px-3 py-0.5 rounded-full border border-border/50 text-foreground">
                    <span className="text-emerald-500">🔒</span>
                    <span>nasaeemlibya.ly</span>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {previewDevice === 'mobile' ? '375 × 812' : previewDevice === 'tablet' ? '768 × 1024' : '100%'}
                  </span>
                </div>

                {/* Rendered Live Widgets Inside Mockup */}
                <div className="p-3 sm:p-5 space-y-6">
                  {widgets.filter((w) => w.is_active).length === 0 ? (
                    <div className="py-16 text-center space-y-2">
                      <p className="text-sm font-bold text-foreground">لا توجد أدوات نشطة للعرض حالياً</p>
                      <p className="text-xs text-muted-foreground">قم بإضافة وتفعيل أدوات من القائمة الجانبية لتظهر في المعاينة.</p>
                    </div>
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
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
