import {
  ArrowUpRight,
  Cake,
  Gift,
  MessageCircle,
  Plus,
  Tag,
  Trash2,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { formatDate, formatDateTime, formatNumber, formatPrice } from '@/lib/format'
import { STAGE_BY_VALUE } from '@/lib/orderStages'
import {
  type CustomerProfile,
  type CustomerTag,
  type InteractionKind,
  INTERACTION_KINDS,
  SEGMENT_LABELS,
  SEGMENT_TONES,
  type TemplateKey,
  useAddInteraction,
  useCreateCustomerTag,
  useCustomerProfile,
  useCustomerTags,
  useDeleteInteraction,
  useUpdateCustomer,
  useWhatsAppTemplate,
} from '@/lib/queries/crm'
import { cn } from '@/lib/utils'

const TAG_COLORS: readonly [string, ...string[]] = ['#b45309', '#15803d', '#1d4ed8', '#be185d', '#7c3aed', '#0f766e', '#6b7280']

/** The coloured pill of one tag. Text colour follows the tag's own colour. */
export function TagPill({ tag, onRemove }: { tag: CustomerTag; onRemove?: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold"
      style={{ color: tag.color, borderColor: `${tag.color}55`, backgroundColor: `${tag.color}14` }}
    >
      {tag.name}
      {onRemove ? (
        <button type="button" onClick={onRemove} aria-label={`إزالة الوسم ${tag.name}`} className="rounded-full hover:bg-black/10">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}

export function SegmentBadge({ segment, className }: { segment: CustomerProfile['segment']; className?: string }) {
  return (
    <Badge tone={SEGMENT_TONES[segment]} className={cn('text-[11px]', className)}>
      {SEGMENT_LABELS[segment]}
    </Badge>
  )
}

/**
 * The customer's file: numbers, segment, tags, birthday, last orders, the
 * contact log and the three ready WhatsApp messages. The drawer and the full
 * page both render this, so the two never disagree.
 */
export function CustomerProfilePanel({ customerId, compact = false }: { customerId: string; compact?: boolean }) {
  const { data: profile, isPending, error } = useCustomerProfile(customerId)

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    )
  }
  if (!profile) {
    return <p className="text-sm text-destructive">{error instanceof ApiError ? error.message : 'تعذّر تحميل ملف العميل'}</p>
  }

  return (
    <div className="space-y-5">
      <Numbers profile={profile} compact={compact} />
      <TagsAndBirthday profile={profile} />
      <WhatsAppButtons profile={profile} />
      <RecentOrders profile={profile} />
      <ContactLog profile={profile} />
    </div>
  )
}

function Numbers({ profile, compact }: { profile: CustomerProfile; compact: boolean }) {
  const cells = [
    { label: 'عدد الطلبات', value: formatNumber(profile.orders_count) },
    { label: 'الإنفاق (المسلَّم)', value: formatPrice(profile.spend) },
    { label: 'متوسط الطلب', value: formatPrice(profile.average_order) },
    { label: 'آخر طلب', value: profile.last_order_at ? formatDate(profile.last_order_at) : '—' },
  ]
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentBadge segment={profile.segment} className="text-xs px-3 py-1" />
        {profile.birthday_today ? (
          <Badge tone="discount" className="gap-1 text-xs"><Cake className="size-3.5" /> عيد ميلاده اليوم</Badge>
        ) : null}
        {profile.favourite_city ? (
          <span className="text-xs text-muted-foreground">المدينة الأكثر تكراراً: <b className="text-foreground">{profile.favourite_city}</b></span>
        ) : null}
      </div>
      <dl className={cn('grid gap-2', compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4')}>
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-2xl border border-border bg-card p-3 shadow-2xs">
            <dt className="text-[11px] text-muted-foreground">{cell.label}</dt>
            <dd className="font-mono text-base font-black text-foreground">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function TagsAndBirthday({ profile }: { profile: CustomerProfile }) {
  const { data: allTags = [] } = useCustomerTags()
  const update = useUpdateCustomer(profile.id)
  const createTag = useCreateCustomerTag()
  const [adding, setAdding] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [newColor, setNewColor] = React.useState(TAG_COLORS[0])
  const [birthday, setBirthday] = React.useState(profile.birthday ?? '')
  React.useEffect(() => setBirthday(profile.birthday ?? ''), [profile.birthday])

  const ids = profile.tags.map((t) => t.id)
  const setTags = (tags: string[]) => update.mutate({ tags })
  const available = allTags.filter((t) => !ids.includes(t.id))

  const addNewTag = async () => {
    const name = newName.trim()
    if (!name) return
    const tag = await createTag.mutateAsync({ name, color: newColor })
    setTags([...ids, tag.id])
    setNewName('')
    setAdding(false)
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Tag className="size-4 text-primary" /> الوسوم
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {profile.tags.map((tag) => (
          <TagPill key={tag.id} tag={tag} onRemove={() => setTags(ids.filter((id) => id !== tag.id))} />
        ))}
        {available.length ? (
          <Select
            aria-label="إضافة وسم موجود"
            className="h-8 w-auto max-w-[12rem] px-2 text-xs"
            value=""
            onChange={(e) => e.target.value && setTags([...ids, e.target.value])}
          >
            <option value="">+ وسم موجود</option>
            {available.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </Select>
        ) : null}
        <Button type="button" size="sm" variant="ghost" className="h-8 gap-1 px-2 text-xs" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-3.5" /> وسم جديد
        </Button>
      </div>
      {adding ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: يحب العود"
            className="h-9 w-40 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addNewTag())}
          />
          <div className="flex items-center gap-1" role="radiogroup" aria-label="لون الوسم">
            {TAG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={newColor === color}
                aria-label={color}
                onClick={() => setNewColor(color)}
                className={cn('size-6 rounded-full border-2', newColor === color ? 'border-foreground' : 'border-transparent')}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <Button type="button" size="sm" className="h-9 text-xs" loading={createTag.isPending} onClick={addNewTag}>حفظ الوسم</Button>
          {createTag.error ? <span className="text-xs text-destructive">{createTag.error.message}</span> : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <label htmlFor={`birthday-${profile.id}`} className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Cake className="size-4 text-primary" /> تاريخ الميلاد
        </label>
        <Input
          id={`birthday-${profile.id}`}
          type="date"
          dir="ltr"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          onBlur={() => birthday !== (profile.birthday ?? '') && update.mutate({ birthday: birthday || null })}
          className="h-9 w-44 text-xs"
        />
        {update.isPending ? <span className="text-xs text-muted-foreground">يحفظ…</span> : null}
      </div>
    </section>
  )
}

function WhatsAppButtons({ profile }: { profile: CustomerProfile }) {
  const send = useWhatsAppTemplate(profile.id)
  const [coupon, setCoupon] = React.useState(profile.coupons[0]?.code ?? '')
  const lastOrder = profile.recent_orders[0]
  const needsCoupon = (key: TemplateKey) => key !== 'followup'

  return (
    <section className="space-y-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-foreground">
        <MessageCircle className="size-4 text-emerald-600" /> رسائل واتساب جاهزة
        <span className="font-mono text-[11px] font-normal text-muted-foreground" dir="ltr">+{profile.whatsapp_number}</span>
      </div>
      {profile.coupons.length ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Gift className="size-4 text-primary" />
          <label htmlFor={`coupon-${profile.id}`} className="font-bold">الكوبون</label>
          <Select id={`coupon-${profile.id}`} className="h-8 w-auto px-2 text-xs" value={coupon} onChange={(e) => setCoupon(e.target.value)}>
            {profile.coupons.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لا يوجد كوبون فعّال الآن؛ رسالتا VIP والتهنئة تُفتحان بلا كود.</p>
      )}
      <div className="grid gap-2 sm:grid-cols-3">
        {profile.templates.map((tpl) => (
          <Button
            key={tpl.key}
            type="button"
            variant="outline"
            size="sm"
            loading={send.isPending && send.variables?.template === tpl.key}
            title={tpl.text}
            className="h-10 justify-start gap-1.5 border-emerald-500/30 text-xs font-bold text-emerald-800 hover:bg-emerald-500/10 dark:text-emerald-300"
            onClick={() =>
              send.mutate({
                template: tpl.key,
                coupon: needsCoupon(tpl.key) && coupon ? coupon : undefined,
                order: tpl.key === 'followup' ? lastOrder?.id : undefined,
              })
            }
          >
            <MessageCircle className="size-4" /> {tpl.label}
          </Button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        يُفتح واتساب والنص جاهز، وأنت من يضغط «إرسال». تُسجَّل كل رسالة في سجل التواصل. النصوص تُعدَّل من «نصوص المتجر».
      </p>
      {send.error ? <p className="text-xs text-destructive">{send.error.message}</p> : null}
    </section>
  )
}

function RecentOrders({ profile }: { profile: CustomerProfile }) {
  if (!profile.recent_orders.length) {
    return <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">لا توجد طلبات بعد.</p>
  }
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-bold text-foreground">آخر الطلبات</h3>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {profile.recent_orders.map((order) => {
          const stage = STAGE_BY_VALUE[order.stage]
          return (
            <li key={order.id} className="flex items-center justify-between gap-2 p-3 text-xs">
              <Link to={`/admin/orders/${order.id}`} className="font-mono font-bold text-primary hover:underline">
                #{order.order_number}
              </Link>
              <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', stage.tone)}>{stage.label}</span>
              <span className="font-mono text-muted-foreground">{formatDate(order.created_at)}</span>
              <span className="font-mono font-black text-price">{formatPrice(order.total)}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function ContactLog({ profile }: { profile: CustomerProfile }) {
  const add = useAddInteraction(profile.id)
  const remove = useDeleteInteraction(profile.id)
  const [kind, setKind] = React.useState<InteractionKind>('call')
  const [text, setText] = React.useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    await add.mutateAsync({ kind, text: text.trim() })
    setText('')
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">سجل التواصل</h3>
      <form onSubmit={submit} className="space-y-2 rounded-2xl border border-border p-3">
        <div className="flex gap-2">
          <Select aria-label="نوع التواصل" className="h-9 w-32 px-2 text-xs" value={kind} onChange={(e) => setKind(e.target.value as InteractionKind)}>
            {INTERACTION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </Select>
          <Textarea
            aria-label="نص التواصل"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ماذا دار؟ (لا يُعدَّل بعد الحفظ)"
            className="min-h-9 flex-1 text-xs"
          />
          <Button type="submit" size="sm" className="h-9 shrink-0 text-xs" loading={add.isPending} disabled={!text.trim()}>تسجيل</Button>
        </div>
        {add.error ? <p className="text-xs text-destructive">{add.error.message}</p> : null}
      </form>
      {profile.interactions.length ? (
        <ol className="space-y-2">
          {profile.interactions.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-2 rounded-xl bg-muted/40 p-3 text-xs">
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={line.kind === 'complaint' ? 'danger' : line.kind === 'whatsapp' ? 'success' : 'neutral'} className="text-[10px]">
                    {line.kind_label}
                  </Badge>
                  <span className="font-mono text-[11px] text-muted-foreground">{formatDateTime(line.created_at)}</span>
                  {line.staff_name ? <span className="text-[11px] text-muted-foreground">· {line.staff_name}</span> : null}
                </div>
                <p className="whitespace-pre-wrap text-foreground">{line.text}</p>
              </div>
              {profile.can_delete_interactions ? (
                <button
                  type="button"
                  aria-label="حذف السطر"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => window.confirm('حذف هذا السطر من سجل التواصل؟') && remove.mutate(line.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-muted-foreground">لا تواصل مسجّل بعد.</p>
      )}
    </section>
  )
}

/** The link to the full page, for the drawer's footer. */
export function FullProfileLink({ customerId }: { customerId: string }) {
  return (
    <Button asChild variant="outline" className="gap-1.5">
      <Link to={`/admin/users/${customerId}`}>
        الملف الكامل <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </Button>
  )
}
