import { ArrowDown, ArrowRight, ArrowUp, GripVertical, Plus, Search, Trash2 } from 'lucide-react'
import * as React from 'react'
import { Link, useBlocker, useParams } from 'react-router-dom'

import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { WidgetRenderer } from '@/components/storefront/widgets'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LineThumb } from '@/components/ui/line-thumb'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useCategories, useCollections, useProducts } from '@/lib/queries/catalog'
import { useLayout, useSaveLayout, type Layout, type LayoutDraft } from '@/lib/queries/customization'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'
import type { Category, Collection, Product, Widget, WidgetStyle } from '@/types/api'

// --------------------------------------------------------------------------
// What the operator can add. `free_shipping_bar` and `gift_wrap_upsell` are
// deliberately absent: neither ever had a renderer of its own, and shipping is
// out of the system. A layout that already holds one keeps it (as a no-op).
// --------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  hero_cta: 'بانر رئيسي',
  carousel: 'سلايدر صور متحرك',
  image: 'صورة منفردة',
  announcement_bar: 'شريط إعلان',
  category_list: 'تصنيفات / علامات تجارية',
  photo_link_grid: 'صور بروابط (شعارات، أقسام)',
  product_list: 'منتجات أختارها',
  collection_showcase: 'منتجات مجموعة',
  trust_badges: 'شريط مزايا المتجر',
  text_block: 'نص',
  discovery_box: 'بانر ترويجي (عرض خاص)',
  spacer: 'مسافة فارغة',
  recently_viewed: 'شوهدت مؤخراً (تلقائي)',
  buy_again: 'اشترِ مرة أخرى (تلقائي)',
  recommended_for_you: 'مقترحات للعميل (تلقائي)',
  trending_near_you: 'الأكثر رواجاً (تلقائي)',
}
const LEGACY_LABELS: Record<string, string> = {
  free_shipping_bar: 'شريط الشحن المجاني (متوقف)',
  gift_wrap_upsell: 'تغليف الهدايا (متوقف)',
}
const labelOf = (type: string) => TYPE_LABELS[type] ?? LEGACY_LABELS[type] ?? type

const PERSONALISED = ['recently_viewed', 'buy_again', 'recommended_for_you', 'trending_near_you']

const WEEKDAYS = [
  { value: 'saturday', label: 'السبت' }, { value: 'sunday', label: 'الأحد' },
  { value: 'monday', label: 'الاثنين' }, { value: 'tuesday', label: 'الثلاثاء' },
  { value: 'wednesday', label: 'الأربعاء' }, { value: 'thursday', label: 'الخميس' },
  { value: 'friday', label: 'الجمعة' },
]

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'شبكة' },
  { value: 'slider', label: 'شريط يُسحب أفقياً (سلايدر)' },
]
const ICON_OPTIONS = [
  { value: 'shield-check', label: 'درع ✔' }, { value: 'truck', label: 'شاحنة' },
  { value: 'credit-card', label: 'بطاقة' }, { value: 'gift', label: 'هدية' },
  { value: 'star', label: 'نجمة' }, { value: 'phone', label: 'هاتف' },
  { value: 'tag', label: 'وسم سعر' }, { value: 'sparkles', label: 'لمعة' },
]

type Data = Record<string, unknown>

interface DraftWidget {
  /** Stable for the life of the editor, so React never re-mounts a row. */
  key: string
  id?: string
  type: string
  data: Data
  is_active: boolean
  /** Colours, spacing, width — see `WidgetShell`. */
  style: WidgetStyle
  /** `guest` / `member` / everyone. */
  audience: 'all' | 'guest' | 'member'
}


let draftCounter = 0
const newKey = () => `draft-${++draftCounter}`

/** Fields the server attaches for display; never sent back. */
const POPULATED_KEYS = ['products', 'categories', 'collection']

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** A widget with nothing to show renders nothing on the storefront; the
 * builder says so instead of leaving a silent gap in the preview. */
function emptyReason(widget: DraftWidget): string | null {
  const d = widget.data
  const list = (key: string) => (Array.isArray(d[key]) ? (d[key] as unknown[]) : [])
  switch (widget.type) {
    case 'hero_cta':
      if (d.heroMode === 'image') return d.desktopImageUrl || d.mobileImageUrl ? null : 'ارفع صورة البانر'
      return d.title || d.subtitle || d.buttonLabel || d.desktopImageUrl || d.mobileImageUrl
        ? null
        : 'اكتب عنواناً أو ارفع صورة'
    case 'carousel':
      return list('slides').length ? null : 'أضف شريحة واحدة على الأقل'
    case 'image':
      return d.imageUrl ? null : 'ارفع الصورة'
    case 'announcement_bar':
      return d.message ? null : 'اكتب نص الإعلان'
    case 'category_list':
      return list('categoryIds').length ? null : 'اختر التصنيفات'
    case 'photo_link_grid':
      return list('items').length ? null : 'أضف صورة واحدة على الأقل'
    case 'product_list':
      return list('productIds').length ? null : 'اختر المنتجات'
    case 'collection_showcase':
      if (!d.collectionId) return 'اختر المجموعة'
      return list('products').length ? null : 'تظهر منتجات المجموعة هنا بعد الحفظ (أو المجموعة فارغة)'
    case 'trust_badges':
      return list('items').some((item) => (item as Data).title) ? null : 'أضف ميزة واحدة على الأقل'
    case 'discovery_box':
      return d.title || d.description || list('features').length ? null : 'اكتب عنوان العرض أو وصفه'
    case 'text_block':
      return String(d.content ?? '').trim() ? null : 'اكتب النص'
    case 'free_shipping_bar':
    case 'gift_wrap_upsell':
      return 'هذه الأداة متوقفة ولا تظهر في المتجر — يمكنك حذفها'
    default:
      return null
  }
}

export default function WidgetBuilder() {
  const { layoutId = '' } = useParams()
  const { data: layout, isPending } = useLayout(layoutId)
  const [notice, setNotice] = React.useState<string | null>(null)
  const lastIndex = React.useRef(0)

  if (isPending) return <Skeleton className="h-96 w-full" />
  if (!layout) {
    return (
      <p className="py-16 text-center text-muted-foreground">
        التخطيط غير موجود.{' '}
        <Link to="/admin/customization" className="text-primary underline">العودة إلى القائمة</Link>
      </p>
    )
  }
  // Keyed by the saved version: after a save the editor restarts from what the
  // server stored, so the screen can never drift from the database. What must
  // survive that restart (the save message, which widget was open) lives here.
  return (
    <Editor
      key={`${layout.id}-${layout.updated_at}`}
      layout={layout}
      notice={notice}
      setNotice={setNotice}
      lastIndex={lastIndex}
    />
  )
}

interface EditorProps {
  layout: Layout
  notice: string | null
  setNotice: (notice: string | null) => void
  lastIndex: React.MutableRefObject<number>
}

function Editor({ layout, notice, setNotice, lastIndex }: EditorProps) {
  usePageTitle(`${layout.name} — محرر الواجهة`)
  const save = useSaveLayout(layout.id)

  const [widgets, setWidgetsState] = React.useState<DraftWidget[]>(() =>
    layout.widgets.map((w) => ({
      key: newKey(),
      id: w.id,
      type: w.type,
      data: { ...(w.data as Data) },
      is_active: w.is_active,
      style: { ...(w.style ?? {}) },
      audience: w.targeting?.isGuest === true ? 'guest' : w.targeting?.isGuest === false ? 'member' : 'all',
    })),
  )
  const [meta, setMetaState] = React.useState({
    name: layout.name,
    active_start_date: layout.active_start_date,
    active_end_date: layout.active_end_date,
    active_days: (layout.active_days ?? []).filter((d): d is string => typeof d === 'string'),
    active_start_hour: layout.active_start_hour,
    active_end_hour: layout.active_end_hour,
  })
  const [selectedKey, setSelectedKey] = React.useState<string | null>(
    (widgets[lastIndex.current] ?? widgets[0])?.key ?? null,
  )
  const [dirty, setDirty] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [previewDevice, setPreviewDevice] = React.useState<'desktop' | 'mobile'>('desktop')

  const touch = () => {
    setDirty(true)
    setNotice(null)
    setError(null)
  }
  const setWidgets = (next: DraftWidget[]) => {
    setWidgetsState(next)
    touch()
  }
  const setMeta = (patch: Partial<typeof meta>) => {
    setMetaState((current) => ({ ...current, ...patch }))
    touch()
  }

  // Unsaved work is never lost silently: closing the tab and leaving the page
  // inside the app both ask first.
  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const blocker = useBlocker(dirty && !save.isPending)
  React.useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm('لديك تغييرات غير محفوظة في هذا التخطيط. هل تريد الخروج بدون حفظ؟')) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  const selectedIndex = widgets.findIndex((w) => w.key === selectedKey)
  lastIndex.current = Math.max(selectedIndex, 0)
  const current = selectedIndex >= 0 ? widgets[selectedIndex] : undefined

  const addWidget = (type: string) => {
    const data: Data =
      type === 'hero_cta' ? { heroMode: 'image', overlay: 45, alignment: 'center' }
      : type === 'announcement_bar' ? { dismissible: true, icon: 'megaphone' }
      : type === 'trust_badges' ? { items: [{ icon: 'shield-check', title: '', subtitle: '' }] }
      // Starting words the operator can see and change — never hidden defaults.
      : PERSONALISED.includes(type) ? { limit: 8, layout: 'slider', title: TYPE_LABELS[type]!.replace(' (تلقائي)', '') }
      : type === 'product_list' ? { title: 'منتجات مختارة', actionLabel: 'عرض الكل', actionUrl: '/products' }
      : type === 'category_list' ? { title: 'تسوّق حسب العلامة', actionLabel: 'كل المنتجات', actionUrl: '/products' }
      : {}
    const widget: DraftWidget = { key: newKey(), type, data, is_active: true, style: {}, audience: 'all' }
    setWidgets([...widgets, widget])
    setSelectedKey(widget.key)
  }
  const removeWidget = (key: string) => {
    const index = widgets.findIndex((w) => w.key === key)
    const next = widgets.filter((w) => w.key !== key)
    setWidgets(next)
    setSelectedKey(next[Math.min(index, next.length - 1)]?.key ?? null)
  }
  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= widgets.length || from === to) return
    const next = [...widgets]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    setWidgets(next)
  }
  const patchCurrent = (patch: Data) => {
    if (!current) return
    setWidgets(widgets.map((w) => (w.key === current.key ? { ...w, data: { ...w.data, ...patch } } : w)))
  }
  const patchWidget = (patch: Partial<DraftWidget>) => {
    if (!current) return
    setWidgets(widgets.map((w) => (w.key === current.key ? { ...w, ...patch } : w)))
  }
  const toggleActive = (key: string) =>
    setWidgets(widgets.map((w) => (w.key === key ? { ...w, is_active: !w.is_active } : w)))

  /** One save path for everything on the page; `activate` flips the switch in
   * the same request so "show on the store" can never leave edits unsaved. */
  const submit = async (activate?: boolean) => {
    setError(null)
    if (!meta.name.trim()) {
      setError('اسم التخطيط مطلوب')
      return
    }
    const turningOn = activate === true
    if (turningOn && !widgets.some((w) => w.is_active && !emptyReason(w))) {
      setError('لا يمكن عرض تخطيط فارغ على المتجر. أضف أداة واحدة مكتملة على الأقل.')
      return
    }
    if (activate === false && layout.is_live &&
        !window.confirm('هذا التخطيط هو المعروض الآن. إيقافه قد يترك الصفحة الرئيسية للمتجر فارغة. هل تريد الإيقاف؟')) {
      return
    }
    const body: LayoutDraft = {
      ...meta,
      name: meta.name.trim(),
      widgets: widgets.map((w) => ({
        id: w.id,
        type: w.type,
        is_active: w.is_active,
        style: w.style,
        targeting: w.audience === 'all' ? null : { isGuest: w.audience === 'guest' },
        data: Object.fromEntries(Object.entries(w.data).filter(([key]) => !POPULATED_KEYS.includes(key))),
      })),
    }
    if (activate !== undefined) body.is_global_active = activate
    try {
      const response = await save.mutateAsync(body)
      setDirty(false)
      setNotice(response.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر الحفظ، حاول مرة أخرى')
    }
  }

  const status = layout.is_live
    ? { tone: 'success' as const, text: 'معروض الآن على الصفحة الرئيسية' }
    : layout.is_global_active
      ? { tone: 'warning' as const, text: 'مفعّل، لكنه غير معروض الآن (خارج وقت الجدولة أو يحلّ محله تخطيط مجدول)' }
      : { tone: 'neutral' as const, text: 'غير معروض على المتجر' }

  return (
    <div className="space-y-5">
      {/* ---------------- header ---------------- */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <Link to="/admin/customization" className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-3.5" /> كل التخطيطات
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1 basis-64 space-y-2">
            <Field label="اسم التخطيط" id="layout-name">
              {(props) => (
                <Input {...props} value={meta.name} onChange={(e) => setMeta({ name: e.target.value })} className="text-base font-bold" />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone} className="text-xs">{status.text}</Badge>
              {dirty && <Badge tone="warning" className="text-xs">تغييرات غير محفوظة</Badge>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => submit(!layout.is_global_active)} loading={save.isPending}>
              {layout.is_global_active ? 'إيقاف العرض' : 'حفظ وعرض على المتجر'}
            </Button>
            <Button onClick={() => submit()} loading={save.isPending} disabled={!dirty}>
              حفظ التغييرات
            </Button>
          </div>
        </div>
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
      </div>

      <div className="grid max-w-full gap-5 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* ---------------- widget list ---------------- */}
        <section aria-label="أدوات الصفحة" className="space-y-3">
          <h2 className="text-sm font-bold">أدوات الصفحة بالترتيب</h2>
          <ul className="space-y-1.5" onDragOver={(e) => e.preventDefault()}>
            {widgets.map((widget, index) => {
              const reason = emptyReason(widget)
              return (
                <li
                  key={widget.key}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(index))}
                  onDrop={(e) => {
                    e.preventDefault()
                    reorder(Number(e.dataTransfer.getData('text/plain')), index)
                  }}
                  className={cn(
                    'flex items-center gap-1 rounded-xl border p-1.5 text-sm',
                    widget.key === selectedKey ? 'border-primary bg-primary/5' : 'border-border bg-card',
                  )}
                >
                  <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 py-1.5 text-start focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => setSelectedKey(widget.key)}
                  >
                    <span className={cn('block truncate font-bold', !widget.is_active && 'text-muted-foreground line-through')}>
                      {labelOf(widget.type)}
                    </span>
                    {!widget.is_active ? (
                      <span className="block text-[11px] text-muted-foreground">مخفية</span>
                    ) : reason ? (
                      <span className="block truncate text-[11px] text-warning">ناقصة: {reason}</span>
                    ) : null}
                  </button>
                  <button
                    type="button" aria-label={`تحريك ${labelOf(widget.type)} لأعلى`} disabled={index === 0}
                    onClick={() => reorder(index, index - 1)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                  ><ArrowUp className="size-4" /></button>
                  <button
                    type="button" aria-label={`تحريك ${labelOf(widget.type)} لأسفل`} disabled={index === widgets.length - 1}
                    onClick={() => reorder(index, index + 1)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                  ><ArrowDown className="size-4" /></button>
                </li>
              )
            })}
            {widgets.length === 0 && (
              <li className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                لا توجد أدوات بعد. ابدأ بإضافة «بانر رئيسي» من القائمة أدناه.
              </li>
            )}
          </ul>

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

          <ScheduleEditor meta={meta} setMeta={setMeta} />
        </section>

        {/* ---------------- editor + preview ---------------- */}
        <div className="min-w-0 max-w-full space-y-5">
          {current ? (
            <section className="space-y-4 rounded-2xl border border-border bg-card p-4" aria-label={`تعديل ${labelOf(current.type)}`}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <h2 className="font-bold">{labelOf(current.type)}</h2>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={current.is_active} onChange={() => toggleActive(current.key)} />
                    ظاهرة في المتجر
                  </label>
                  <Button variant="outline" size="sm" onClick={() => removeWidget(current.key)}>
                    <Trash2 className="size-4" aria-hidden /> حذف الأداة
                  </Button>
                </div>
              </div>
              <WidgetFields type={current.type} data={current.data} patch={patchCurrent} />
              <AppearanceEditor widget={current} patch={patchWidget} />
            </section>
          ) : (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              اختر أداة من القائمة لتعديلها، أو أضف أداة جديدة.
            </p>
          )}

          <section aria-label="معاينة مباشرة" className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">معاينة الصفحة الرئيسية</h2>
                <p className="text-xs text-muted-foreground">نفس ما سيراه العميل. الأدوات الناقصة أو المخفية لا تظهر في المتجر.</p>
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/60 p-1">
                {(['desktop', 'mobile'] as const).map((device) => (
                  <button
                    key={device}
                    type="button"
                    onClick={() => setPreviewDevice(device)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-bold',
                      previewDevice === device ? 'border border-border bg-card shadow-xs' : 'text-muted-foreground',
                    )}
                  >
                    {device === 'desktop' ? 'حاسوب' : 'هاتف'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex max-w-full justify-center overflow-x-auto rounded-xl border border-border/60 bg-muted/30 p-2 sm:p-4">
              <div className={cn('max-w-full space-y-6 overflow-hidden rounded-xl bg-background p-3 sm:p-5', previewDevice === 'mobile' ? 'w-[375px] shrink-0' : 'w-full')}>
                {widgets.filter((w) => w.is_active).length === 0 && (
                  <p className="py-12 text-center text-sm text-muted-foreground">لا توجد أدوات ظاهرة.</p>
                )}
                {widgets.filter((w) => w.is_active).map((widget, index) => {
                  const reason = emptyReason(widget)
                  return (
                    <div
                      key={widget.key}
                      className={cn('rounded-xl', widget.key === selectedKey && 'outline-2 outline-offset-4 outline-primary/50')}
                      onClickCapture={(event) => {
                        // The preview is for looking, not navigating: a click
                        // selects the widget instead of following its link.
                        event.preventDefault()
                        event.stopPropagation()
                        setSelectedKey(widget.key)
                      }}
                    >
                      {reason ? (
                        <div className="rounded-xl border-2 border-dashed border-border p-5 text-center text-xs text-muted-foreground">
                          <span className="font-bold text-foreground">{labelOf(widget.type)}</span> — {reason}
                        </div>
                      ) : (
                        <WidgetRenderer
                          widget={{
                            id: widget.id ?? widget.key,
                            type: widget.type as Widget['type'],
                            data: widget.data as Widget['data'],
                            order: index,
                            is_active: true,
                            style: widget.style,
                            targeting: null,
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      </div>

      <LinkSuggestions />
    </div>
  )
}

// --------------------------------------------------------------------------
// Per-type fields
// --------------------------------------------------------------------------

interface FieldsProps {
  type: string
  data: Data
  patch: (patch: Data) => void
}

function WidgetFields({ type, data, patch }: FieldsProps) {
  const text = (key: string, label: string, hint?: string) => (
    <TextInput key={key} id={`f-${key}`} label={label} hint={hint} value={String(data[key] ?? '')} onChange={(v) => patch({ [key]: v })} />
  )
  const link = (key: string, label: string) => (
    <TextInput key={key} id={`f-${key}`} label={label} dir="ltr" list="link-suggestions"
      hint="اختر من القائمة أو اكتب رابطاً مثل ‎/products" value={String(data[key] ?? '')} onChange={(v) => patch({ [key]: v })} />
  )
  const choice = (key: string, label: string, options: { value: string; label: string }[]) => (
    <Field key={key} label={label} id={`f-${key}`}>
      {(props) => (
        <Select {...props} value={String(data[key] ?? options[0]!.value)} onChange={(e) => patch({ [key]: e.target.value })}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      )}
    </Field>
  )
  const layoutChoice = choice('layout', 'طريقة العرض', LAYOUT_OPTIONS)
  /** The heading row: title on one side, an optional "see all" link on the other. */
  const heading = (titleLabel = 'العنوان (اختياري)') => (
    <div key="heading" className="grid gap-3 sm:grid-cols-3">
      {text('title', titleLabel)}
      {text('actionLabel', 'نص الرابط بجانب العنوان (اختياري)', 'مثال: عرض الكل')}
      {link('actionUrl', 'وجهة الرابط')}
    </div>
  )

  switch (type) {
    case 'hero_cta': {
      const imageOnly = data.heroMode === 'image'
      return (
        <>
          {choice('heroMode', 'نوع البانر', [
            { value: 'image', label: 'صورتي فقط — تظهر كما صمّمتها، بلا تعتيم ولا نص' },
            { value: 'text', label: 'نص فوق صورة خلفية' },
          ])}
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageUploadField label="صورة الحاسوب" purpose="banner" aspectRatio="auto"
              hint="المقاس المقترح 1920×700 تقريباً" value={String(data.desktopImageUrl ?? '')}
              onChange={(url) => patch({ desktopImageUrl: url, backgroundImageUrl: url })} />
            <ImageUploadField label="صورة الهاتف (اختياري)" purpose="banner" aspectRatio="auto"
              hint="صورة طولية للهواتف؛ إن تُركت فارغة تُستخدم صورة الحاسوب" value={String(data.mobileImageUrl ?? '')}
              onChange={(url) => patch({ mobileImageUrl: url })} />
          </div>
          {imageOnly ? (
            link('linkUrl', 'الرابط عند النقر على الصورة (اختياري)')
          ) : (
            <>
              {text('title', 'العنوان')}
              {text('subtitle', 'العنوان الفرعي (اختياري)')}
              {text('badgeText', 'شارة صغيرة فوق العنوان (اختياري)')}
              <div className="grid gap-3 sm:grid-cols-2">
                {text('buttonLabel', 'نص الزر الأول (اختياري)')}
                {link('buttonUrl', 'رابط الزر الأول')}
                {text('secondaryLabel', 'نص الزر الثاني (اختياري)')}
                {link('secondaryUrl', 'رابط الزر الثاني')}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {choice('alignment', 'محاذاة النص', [
                  { value: 'center', label: 'وسط' }, { value: 'start', label: 'يمين' }, { value: 'end', label: 'يسار' },
                ])}
                <Field label={`تعتيم الصورة: ${Number(data.overlay ?? 45)}%`} id="f-overlay" hint="0 = الصورة كما هي، وكلما زاد الرقم صار النص أوضح">
                  {(props) => (
                    <input {...props} type="range" min={0} max={90} step={5} className="w-full"
                      value={Number(data.overlay ?? 45)} onChange={(e) => patch({ overlay: Number(e.target.value) })} />
                  )}
                </Field>
              </div>
            </>
          )}
        </>
      )
    }

    case 'carousel':
      return (
        <>
          {choice('carouselStyle', 'شكل السلايدر', [
            { value: 'hero', label: 'بانر عريض (21:9 على الحاسوب، 16:9 على الهاتف)' },
            { value: 'normal', label: 'عادي 16:9' },
            { value: 'auto', label: 'بأبعاد الصورة الأولى — تظهر كاملة بلا قص' },
          ])}
          {data.carouselStyle === 'auto' ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              الإطار يأخذ شكل الصورة الأولى، فاجعل كل الشرائح بالمقاس نفسه. الصورة المربعة تملأ شاشة الهاتف، لكنها على الحاسوب تصير عالية جداً فيُقصّ منها ما زاد عن ارتفاع الشاشة.
            </p>
          ) : (
            <>
              {choice('imageFit', 'الصورة داخل الإطار', [
                { value: 'cover', label: 'تملأ الإطار كاملاً (يُقصّ الزائد من الأطراف)' },
                { value: 'contain', label: 'تظهر كاملة (يبقى فراغ على الجانبين إن اختلف شكلها عن الإطار)' },
              ])}
              <p className="text-xs leading-relaxed text-muted-foreground">
                لتملأ الصورة الإطار بلا قص: {data.carouselStyle === 'normal' ? '1920×1080' : '1920×820 للحاسوب، و1080×608 للهاتف'}.
              </p>
            </>
          )}
          <Repeater
            title="الشرائح"
            addLabel="إضافة شريحة"
            items={(data.slides as Data[]) ?? []}
            blank={{ imageUrl: '', mobileImageUrl: '', title: '', subtitle: '', linkUrl: '' }}
            onChange={(slides) => patch({ slides })}
            render={(slide, update) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ImageUploadField label="صورة الشريحة" purpose="banner" aspectRatio="auto" value={String(slide.imageUrl ?? '')} onChange={(url) => update({ imageUrl: url })} />
                  <ImageUploadField label="صورة الهاتف (اختياري)" purpose="banner" aspectRatio="auto"
                    hint="إن تُركت فارغة تُستخدم صورة الشريحة" value={String(slide.mobileImageUrl ?? '')} onChange={(url) => update({ mobileImageUrl: url })} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="عنوان على الصورة (اختياري)" value={String(slide.title ?? '')} onChange={(v) => update({ title: v })} />
                  <TextInput label="نص فرعي (اختياري)" value={String(slide.subtitle ?? '')} onChange={(v) => update({ subtitle: v })} />
                </div>
                <TextInput label="الرابط عند النقر (اختياري)" dir="ltr" list="link-suggestions" value={String(slide.linkUrl ?? '')} onChange={(v) => update({ linkUrl: v })} />
              </>
            )}
          />
        </>
      )

    case 'image':
      return (
        <>
          <ImageUploadField label="الصورة" purpose="banner" hint="تظهر بعرض الصفحة كاملاً وبأبعادها الأصلية"
            value={String(data.imageUrl ?? '')} onChange={(url) => patch({ imageUrl: url })} />
          {link('linkUrl', 'الرابط عند النقر (اختياري)')}
          {text('altText', 'وصف الصورة لمحركات البحث (اختياري)')}
        </>
      )

    case 'announcement_bar':
      return (
        <>
          {text('message', 'نص الإعلان')}
          {text('title', 'كلمة بارزة قبل النص (اختياري)')}
          <div className="grid gap-3 sm:grid-cols-2">
            {text('linkLabel', 'نص الزر (اختياري)')}
            {link('linkUrl', 'رابط الزر')}
          </div>
          {choice('icon', 'الأيقونة', [
            { value: 'megaphone', label: 'مكبر صوت' }, { value: 'sparkles', label: 'لمعة' },
            { value: 'gift', label: 'هدية' }, { value: 'star', label: 'نجمة' }, { value: 'tag', label: 'وسم سعر' },
            { value: 'bell', label: 'جرس' }, { value: 'info', label: 'معلومة' },
          ])}
          <Check label="يمكن للعميل إغلاق الإعلان" checked={data.dismissible !== false} onChange={(v) => patch({ dismissible: v })} />
        </>
      )

    case 'category_list':
      return (
        <>
          {heading()}
          {layoutChoice}
          <CategoryPicker
            selected={(data.categories as Category[]) ?? []}
            onChange={(categories) => patch({ categories, categoryIds: categories.map((c) => c.id) })}
          />
        </>
      )

    case 'photo_link_grid':
      return (
        <>
          {heading()}
          {layoutChoice}
          <Repeater
            title="الصور"
            addLabel="إضافة صورة"
            items={(data.items as Data[]) ?? []}
            blank={{ imageUrl: '', label: '', linkUrl: '' }}
            onChange={(items) => patch({ items })}
            render={(item, update) => (
              <>
                <ImageUploadField label="الصورة أو الشعار" value={String(item.imageUrl ?? '')} onChange={(url) => update({ imageUrl: url })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput label="الاسم تحت الصورة (اختياري)" value={String(item.label ?? '')} onChange={(v) => update({ label: v })} />
                  <TextInput label="الرابط عند النقر" dir="ltr" list="link-suggestions" value={String(item.linkUrl ?? '')} onChange={(v) => update({ linkUrl: v })} />
                </div>
              </>
            )}
          />
        </>
      )

    case 'product_list':
      return (
        <>
          {heading()}
          {layoutChoice}
          <ProductPicker
            selected={(data.products as Product[]) ?? []}
            onChange={(products) => patch({ products, productIds: products.map((p) => p.id) })}
          />
        </>
      )

    case 'collection_showcase':
      return (
        <>
          <CollectionPicker
            value={String(data.collectionId ?? '')}
            onChange={(collection) => patch({ collectionId: collection?.id ?? '', collection: collection ?? null, products: [] })}
          />
          {heading('العنوان (فارغ = اسم المجموعة)')}
          {text('description', 'الوصف تحت العنوان (فارغ = وصف المجموعة)')}
          {layoutChoice}
        </>
      )

    case 'trust_badges':
      return (
        <>
          {text('title', 'عنوان القسم (اختياري)')}
          <Repeater
            title="المزايا"
            addLabel="إضافة ميزة"
            items={(data.items as Data[]) ?? []}
            blank={{ icon: 'sparkles', title: '', subtitle: '' }}
            onChange={(items) => patch({ items })}
            render={(item, update) => (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="الأيقونة">
                  <Select value={String(item.icon ?? 'sparkles')} onChange={(e) => update({ icon: e.target.value })}>
                    {ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <TextInput label="العنوان" value={String(item.title ?? '')} onChange={(v) => update({ title: v })} />
                <TextInput label="سطر توضيحي (اختياري)" value={String(item.subtitle ?? '')} onChange={(v) => update({ subtitle: v })} />
              </div>
            )}
          />
        </>
      )

    case 'text_block':
      return (
        <Field label="النص" id="f-content" hint="كل سطر جديد يظهر كفقرة">
          {(props) => (
            <textarea {...props} rows={4} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              value={String(data.content ?? '')} onChange={(e) => patch({ content: e.target.value })} />
          )}
        </Field>
      )

    case 'spacer':
      return choice('height', 'الارتفاع', [
        { value: 'sm', label: 'صغير' }, { value: 'md', label: 'متوسط' }, { value: 'lg', label: 'كبير' },
        { value: 'xl', label: 'أكبر' }, { value: '2xl', label: 'ضخم' },
      ])

    case 'discovery_box':
      return (
        <>
          <Alert tone="info">كل ما يظهر في هذا البانر هو ما تكتبه هنا. الحقل الفارغ لا يظهر.</Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            {text('title', 'العنوان')}
            {text('badge', 'شارة صغيرة بجانب العنوان (اختياري)')}
          </div>
          <Field label="الوصف (اختياري)" id="f-description">
            {(props) => (
              <textarea {...props} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={String(data.description ?? '')} onChange={(e) => patch({ description: e.target.value })} />
            )}
          </Field>
          <Field label="نقاط مختصرة (اختياري)" id="f-features" hint="كل سطر يظهر كنقطة بعلامة ✓ — حتى 6 نقاط">
            {(props) => (
              <textarea {...props} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                value={((data.features as string[]) ?? []).join('\n')}
                onChange={(e) => patch({ features: e.target.value.split('\n') })} />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            {text('buttonText', 'نص الزر (اختياري)')}
            {link('linkUrl', 'رابط الزر')}
          </div>
          <Check label="إظهاره أيضاً في صفحة السلة" checked={data.showInCart !== false} onChange={(v) => patch({ showInCart: v })} />
          <Check label="إظهاره أيضاً في صفحة المنتج" checked={data.showInProductDetail !== false} onChange={(v) => patch({ showInProductDetail: v })} />
        </>
      )

    case 'free_shipping_bar':
    case 'gift_wrap_upsell':
      return <Alert tone="info">هذه الأداة متوقفة ولا تظهر في المتجر. يمكنك حذفها من الزر أعلاه.</Alert>

    default:
      if (PERSONALISED.includes(type)) {
        return (
          <>
            <Alert tone="info">يملأ النظام هذه القائمة تلقائياً لكل عميل، وللزائر الجديد تُعرض أحدث المنتجات المتوفرة.</Alert>
            {heading('العنوان')}
            <div className="grid gap-3 sm:grid-cols-2">
              <NumberInput label="عدد المنتجات (1–24)" value={data.limit} onChange={(v) => patch({ limit: v })} />
              {layoutChoice}
            </div>
          </>
        )
      }
      return null
  }
}

// --------------------------------------------------------------------------
// Appearance and audience — the same for every widget type
// --------------------------------------------------------------------------

/** Picture widgets, where "edge to edge with no gaps" is one click. */
const EDGE_TO_EDGE: string[] = ['carousel', 'image', 'hero_cta']

function AppearanceEditor({ widget, patch }: { widget: DraftWidget; patch: (patch: Partial<DraftWidget>) => void }) {
  const style = widget.style
  const setStyle = (change: Partial<WidgetStyle>) => {
    const next = { ...style, ...change }
    for (const key of Object.keys(next) as (keyof WidgetStyle)[]) if (!next[key]) delete next[key]
    patch({ style: next })
  }
  const customised = Object.keys(style).length > 0 || widget.audience !== 'all'
  const edgeToEdge = style.width === 'full' && style.paddingY === 'none' && !style.paddingX && !style.borderRadius
  const colour = (key: 'backgroundColor' | 'textColor', label: string) => (
    <div className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={style[key] || (key === 'backgroundColor' ? '#ffffff' : '#111111')}
          onChange={(e) => setStyle({ [key]: e.target.value })}
          className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-background p-1"
        />
        {style[key] ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setStyle({ [key]: undefined })}>
            إزالة اللون
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">لون المتجر الافتراضي</span>
        )}
      </div>
    </div>
  )
  const option = (key: 'paddingY' | 'paddingX' | 'width' | 'borderRadius', label: string, options: [string, string][], fallback: string) => (
    <Field label={label} id={`s-${key}`}>
      {(props) => (
        <Select {...props} value={style[key] ?? fallback}
          onChange={(e) => setStyle({ [key]: e.target.value === fallback ? undefined : e.target.value } as Partial<WidgetStyle>)}>
          {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </Select>
      )}
    </Field>
  )
  return (
    <details className="rounded-xl border border-border bg-muted/20 p-3" open={customised}>
      <summary className="cursor-pointer text-sm font-bold">
        المظهر ومن يرى هذه الأداة {customised && <span className="text-xs font-normal text-primary">(معدّل)</span>}
      </summary>
      {EDGE_TO_EDGE.includes(widget.type) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant={edgeToEdge ? 'default' : 'outline'} disabled={edgeToEdge}
            onClick={() => setStyle({ width: 'full', paddingY: 'none', paddingX: undefined, borderRadius: undefined })}>
            {edgeToEdge ? 'بعرض الشاشة بلا فراغات ✓' : 'اجعلها بعرض الشاشة بلا فراغات'}
          </Button>
          <span className="text-xs text-muted-foreground">تلتصق الصورة بحواف الشاشة وبما فوقها وتحتها.</span>
        </div>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {colour('backgroundColor', 'لون الخلفية')}
        {colour('textColor', 'لون النص')}
        {option('paddingY', 'المسافة أعلى وأسفل', [['none', 'بدون'], ['sm', 'صغيرة'], ['md', 'متوسطة'], ['lg', 'كبيرة']], 'md')}
        {option('paddingX', 'المسافة الجانبية', [['none', 'بدون'], ['sm', 'صغيرة'], ['md', 'متوسطة'], ['lg', 'كبيرة']], 'none')}
        {option('width', 'العرض', [['container', 'بعرض المحتوى'], ['full', 'بعرض الشاشة كاملاً']], 'container')}
        {option('borderRadius', 'زوايا الخلفية', [['none', 'حادة'], ['md', 'مستديرة قليلاً'], ['lg', 'مستديرة']], 'none')}
        <Field label="من يرى هذه الأداة" id="s-audience">
          {(props) => (
            <Select {...props} value={widget.audience} onChange={(e) => patch({ audience: e.target.value as DraftWidget['audience'] })}>
              <option value="all">الجميع</option>
              <option value="guest">الزوار فقط (غير المسجلين)</option>
              <option value="member">العملاء المسجلون فقط</option>
            </Select>
          )}
        </Field>
      </div>
    </details>
  )
}

// --------------------------------------------------------------------------
// Small inputs
// --------------------------------------------------------------------------

function TextInput({ id, label, hint, value, onChange, dir, list }: {
  id?: string; label: string; hint?: string; value: string; onChange: (value: string) => void; dir?: 'ltr'; list?: string
}) {
  return (
    <Field label={label} id={id} hint={hint}>
      <Input id={id} value={value} dir={dir} list={list} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

/** A number box that can be cleared while typing; empty means "use the default". */
function NumberInput({ label, value, onChange }: { label: string; value: unknown; onChange: (value: number | '') => void }) {
  return (
    <Field label={label}>
      <Input type="number" inputMode="numeric" dir="ltr" value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} />
    </Field>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

/** A list of sub-items (slides, pictures, badges) with add, remove and reorder. */
function Repeater({ title, addLabel, items, blank, onChange, render }: {
  title: string
  addLabel: string
  items: Data[]
  blank: Data
  onChange: (items: Data[]) => void
  render: (item: Data, update: (patch: Data) => void) => React.ReactNode
}) {
  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    onChange(next)
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{title} ({items.length})</h3>
        <Button type="button" size="sm" variant="secondary" onClick={() => onChange([...items, { ...blank }])}>
          <Plus className="size-4" /> {addLabel}
        </Button>
      </div>
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          لا يوجد شيء بعد — اضغط «{addLabel}».
        </p>
      )}
      {items.map((item, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">#{index + 1}</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => move(index, index - 1)}
                className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" aria-label="تحريك لأسفل" disabled={index === items.length - 1} onClick={() => move(index, index + 1)}
                className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
              <button type="button" aria-label="حذف" onClick={() => onChange(items.filter((_, i) => i !== index))}
                className="inline-flex size-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
            </div>
          </div>
          {render(item, (patch) => onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it))))}
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------------------------------
// Pickers
// --------------------------------------------------------------------------

function ProductPicker({ selected, onChange }: { selected: Product[]; onChange: (products: Product[]) => void }) {
  const [query, setQuery] = React.useState('')
  const [term, setTerm] = React.useState('')
  React.useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])
  const { data, isFetching } = useProducts({ search: term, limit: 8, is_active: true }, { enabled: term.length >= 2 })
  const chosen = new Set(selected.map((p) => p.id))
  const results = term.length >= 2 ? (data?.items ?? []) : []
  const move = (from: number, to: number) => {
    if (to < 0 || to >= selected.length) return
    const next = [...selected]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold">المنتجات المختارة ({selected.length})</h3>
      {selected.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          لم تختر منتجات بعد — ابحث بالأسفل وأضف.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {selected.map((product, index) => (
            <li key={product.id} className="flex items-center gap-2 p-2">
              <LineThumb image={product.images?.[0]} alt={product.name} size={36} />
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{product.name}</span>
              <button type="button" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => move(index, index - 1)}
                className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" aria-label="تحريك لأسفل" disabled={index === selected.length - 1} onClick={() => move(index, index + 1)}
                className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
              <button type="button" aria-label={`إزالة ${product.name}`} onClick={() => onChange(selected.filter((p) => p.id !== product.id))}
                className="inline-flex size-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن منتج لإضافته…" className="ps-9" aria-label="البحث عن منتج" />
      </div>
      {term.length >= 2 && (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {results.map((product) => (
            <li key={product.id} className="flex items-center gap-2 p-2">
              <LineThumb image={product.images?.[0]} alt={product.name} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{product.name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">{formatPrice(product.price)}</p>
              </div>
              <Button type="button" size="sm" variant="secondary" disabled={chosen.has(product.id)} onClick={() => onChange([...selected, product])}>
                {chosen.has(product.id) ? 'مضاف' : 'إضافة'}
              </Button>
            </li>
          ))}
          {!isFetching && results.length === 0 && (
            <li className="p-3 text-center text-xs text-muted-foreground">لا توجد نتائج</li>
          )}
        </ul>
      )}
    </div>
  )
}

function flattenCategories(categories: Category[] | undefined): Category[] {
  const out: Category[] = []
  const walk = (list: Category[]) => {
    for (const category of list) {
      out.push(category)
      if (category.children?.length) walk(category.children)
    }
  }
  walk(categories ?? [])
  return out
}

function CategoryPicker({ selected, onChange }: { selected: Category[]; onChange: (categories: Category[]) => void }) {
  const { data } = useCategories()
  const all = flattenCategories(data).filter((c) => c.is_active)
  const chosen = new Set(selected.map((c) => c.id))
  const toggle = (category: Category) =>
    onChange(chosen.has(category.id) ? selected.filter((c) => c.id !== category.id) : [...selected, category])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">التصنيفات المعروضة ({selected.length})</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(all)}>اختيار الكل</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onChange([])}>مسح</Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">تظهر بترتيب اختيارك. صورة كل تصنيف تُضبط من صفحة «الأقسام والتصنيفات».</p>
      {all.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">لا توجد تصنيفات في المتجر بعد.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {all.map((category) => {
            const order = selected.findIndex((c) => c.id === category.id)
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={order >= 0}
                onClick={() => toggle(category)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm font-bold transition-colors',
                  order >= 0 ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-card hover:border-primary/40',
                )}
              >
                {order >= 0 && <span className="me-1.5 font-mono text-xs">{order + 1}</span>}
                {category.name}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CollectionPicker({ value, onChange }: { value: string; onChange: (collection: Collection | null) => void }) {
  const { data } = useCollections()
  const collections = data ?? []
  return (
    <Field label="المجموعة" id="f-collection"
      hint={collections.length === 0 ? 'لا توجد مجموعات بعد — أنشئ مجموعة من صفحة «المجموعات المميزة» أولاً' : 'تُعرض أول 12 منتجاً من المجموعة'}>
      {(props) => (
        <Select {...props} value={value} onChange={(e) => onChange(collections.find((c) => c.id === e.target.value) ?? null)}>
          <option value="">— اختر مجموعة —</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      )}
    </Field>
  )
}

/** One `<datalist>` behind every link field: the operator picks a real page
 * instead of guessing a URL. */
function LinkSuggestions() {
  const { data: categories } = useCategories()
  const { data: collections } = useCollections()
  return (
    <datalist id="link-suggestions">
      <option value="/products">كل المنتجات</option>
      <option value="/products?sort=newest">أحدث المنتجات</option>
      {flattenCategories(categories).map((c) => (
        <option key={c.id} value={`/categories/${c.slug}`}>{`تصنيف: ${c.name}`}</option>
      ))}
      {(collections ?? []).map((c) => (
        <option key={c.id} value={`/collections/${c.slug}`}>{`مجموعة: ${c.name}`}</option>
      ))}
    </datalist>
  )
}

// --------------------------------------------------------------------------
// Schedule
// --------------------------------------------------------------------------

interface ScheduleMeta {
  active_start_date: string | null
  active_end_date: string | null
  active_days: string[]
  active_start_hour: number | null
  active_end_hour: number | null
}

function ScheduleEditor({ meta, setMeta }: { meta: ScheduleMeta; setMeta: (patch: Partial<ScheduleMeta>) => void }) {
  const scheduled = Boolean(
    meta.active_start_date || meta.active_end_date || meta.active_days.length ||
    (meta.active_start_hour !== null && meta.active_end_hour !== null),
  )
  return (
    <details className="rounded-xl border border-border bg-card p-3" open={scheduled}>
      <summary className="cursor-pointer text-sm font-bold">
        جدولة العرض {scheduled ? <span className="text-xs font-normal text-warning">(مفعّلة)</span> : <span className="text-xs font-normal text-muted-foreground">(اختياري)</span>}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs leading-relaxed text-muted-foreground">
          اتركها فارغة للتخطيط الدائم. التخطيط المجدول يحلّ محل التخطيط الدائم في وقته فقط (مثل تخطيط العيد)، ثم يعود الدائم تلقائياً.
        </p>
        <Field label="يبدأ في" id="sched-start">
          {(props) => (
            <Input {...props} type="datetime-local" value={toLocalInput(meta.active_start_date)}
              onChange={(e) => setMeta({ active_start_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          )}
        </Field>
        <Field label="ينتهي في" id="sched-end">
          {(props) => (
            <Input {...props} type="datetime-local" value={toLocalInput(meta.active_end_date)}
              onChange={(e) => setMeta({ active_end_date: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          )}
        </Field>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">أيام محددة فقط</legend>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={meta.active_days.includes(value)}
                  onChange={(e) =>
                    setMeta({ active_days: e.target.checked ? [...meta.active_days, value] : meta.active_days.filter((d) => d !== value) })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-2">
          {(['active_start_hour', 'active_end_hour'] as const).map((key) => (
            <Field key={key} label={key === 'active_start_hour' ? 'من الساعة' : 'إلى الساعة'} id={key}>
              {(props) => (
                <Select {...props} value={String(meta[key] ?? '')}
                  onChange={(e) => setMeta({ [key]: e.target.value === '' ? null : Number(e.target.value) })}>
                  <option value="">—</option>
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h}:00`}</option>)}
                </Select>
              )}
            </Field>
          ))}
        </div>
        {scheduled && (
          <Button type="button" size="sm" variant="outline"
            onClick={() => setMeta({ active_start_date: null, active_end_date: null, active_days: [], active_start_hour: null, active_end_hour: null })}>
            إلغاء الجدولة
          </Button>
        )}
      </div>
    </details>
  )
}
