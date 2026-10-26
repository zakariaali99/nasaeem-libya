import {
  Calendar,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Gift,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Send,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  User as UserIcon,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { formatDateTime, formatPrice, whatsappUrl } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import type { CustomerInteraction, CustomerTag, InteractionType, User } from '@/types/api'

interface CRMDetailResponse {
  user: User
  crm: {
    total_orders: number
    delivered_orders_count?: number
    lifetime_spend: string
    average_order_value?: string
    last_order_date: string | null
    tier: 'vip' | 'repeat' | 'new' | 'inactive'
    tier_label: string
    tier_short_label: string
    city: string
    is_birthday_today: boolean
    birthday: string | null
  }
  recent_orders: Array<{
    id: string
    order_number: string
    stage: string
    stage_label: string
    total: string
    total_amount: string
    city: string
    created_at: string
  }>
  interactions: CustomerInteraction[]
  /** The three templates as worded in «نصوص المتجر», variables unfilled. */
  whatsapp_templates: Array<{ key: 'follow_up' | 'vip_offer' | 'birthday'; label: string; text: string }>
  store_name: string
  active_coupons: Array<{
    id: string
    code: string
    type: string
    value: string
    min_order_amount?: string
  }>
}

interface CustomerDrawerProps {
  customerId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const TIER_BADGES = {
  vip: {
    label: 'عميل VIP',
    bg: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  repeat: {
    label: 'عميل متكرر',
    bg: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
  },
  new: {
    label: 'عميل جديد',
    bg: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
  },
  inactive: {
    label: 'عميل خامل',
    bg: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
}

const INTERACTION_CONFIG: Record<
  InteractionType,
  { label: string; icon: typeof Phone; color: string }
> = {
  call: { label: 'مكالمة هاتفية', icon: Phone, color: 'text-blue-600 bg-blue-500/10' },
  whatsapp: { label: 'واتساب', icon: MessageCircle, color: 'text-emerald-600 bg-emerald-500/10' },
  complaint: { label: 'شكوى', icon: X, color: 'text-rose-600 bg-rose-500/10' },
  follow_up: { label: 'متابعة', icon: Clock, color: 'text-amber-600 bg-amber-500/10' },
  note: { label: 'ملاحظة', icon: UserIcon, color: 'text-purple-600 bg-purple-500/10' },
}

export function CustomerDrawer({ customerId, open, onOpenChange }: CustomerDrawerProps) {
  const queryClient = useQueryClient()
  const { data: currentUser } = useMe()
  // د-3: a log line is deleted by the administrator (or the owner) only.
  const canDeleteInteractions = Boolean(
    currentUser?.role && ['admin', 'owner'].includes(currentUser.role)
  )

  const [copiedPhone, setCopiedPhone] = useState(false)
  const [selectedCoupon, setSelectedCoupon] = useState<string>('')
  const [activeTemplateType, setActiveTemplateType] = useState<
    'follow_up' | 'vip_offer' | 'birthday' | null
  >(null)
  const [customMsg, setCustomMsg] = useState('')

  // New interaction form state
  const [newType, setNewType] = useState<InteractionType>('note')
  const [newNotes, setNewNotes] = useState('')

  // Tag creation state
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#2563eb')

  const { data, isLoading } = useQuery<CRMDetailResponse>({
    queryKey: ['admin-customer-crm', customerId],
    queryFn: async () => {
      const res = await api.get<CRMDetailResponse>(`/admin/users/${customerId}/crm/`)
      return res.data
    },
    enabled: Boolean(customerId && open),
  })

  const { data: allTags = [] } = useQuery<CustomerTag[]>({
    queryKey: ['admin-customer-tags'],
    queryFn: async () => {
      const res = await api.get<CustomerTag[]>('/admin/customer-tags/')
      return res.data
    },
    enabled: open,
  })

  // Tag mutation (add or remove)
  const tagMutation = useMutation({
    mutationFn: async (payload: {
      action: 'add' | 'remove'
      tag_id?: string
      tag_name?: string
      color?: string
    }) => {
      const res = await api.post(`/admin/users/${customerId}/tags/`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-crm', customerId] })
      queryClient.invalidateQueries({ queryKey: ['admin-customer-tags'] })
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setIsAddingTag(false)
      setNewTagName('')
    },
  })

  // Interaction create mutation
  const interactionMutation = useMutation({
    mutationFn: async (payload: { interaction_type: InteractionType; notes: string }) => {
      const res = await api.post(`/admin/users/${customerId}/interactions/`, payload)
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-crm', customerId] })
      setNewNotes('')
    },
  })

  // Interaction delete mutation
  const deleteInteractionMutation = useMutation({
    mutationFn: async (interactionId: string) => {
      await api.delete(`/admin/interactions/${interactionId}/`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-crm', customerId] })
    },
  })

  const user = data?.user
  const crm = data?.crm
  const phone = user?.phone_number || ''
  const tier = crm?.tier || 'new'
  const tierConfig = TIER_BADGES[tier]

  const handleCopyPhone = () => {
    if (!phone) return
    navigator.clipboard.writeText(phone)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  // Fills a template's variables: {الاسم} {المتجر} {الكوبون} {رقم_الطلب}.
  // The wording itself comes from «نصوص المتجر» through the dossier.
  const renderTemplate = (type: 'follow_up' | 'vip_offer' | 'birthday', coupon: string) => {
    const text = data?.whatsapp_templates?.find((t) => t.key === type)?.text ?? ''
    return text
      .replaceAll('{الاسم}', user?.name || 'عميلنا العزيز')
      .replaceAll('{المتجر}', data?.store_name || 'نسائم ليبيا')
      .replaceAll('{الكوبون}', coupon)
      .replaceAll('{رقم_الطلب}', data?.recent_orders?.[0]?.order_number || '')
      .trim()
  }

  const selectTemplate = (type: 'follow_up' | 'vip_offer' | 'birthday') => {
    setActiveTemplateType(type)
    setCustomMsg(renderTemplate(type, selectedCoupon || (data?.active_coupons?.[0]?.code ?? '')))
  }

  const handleSendWhatsApp = async () => {
    if (!phone || !customMsg.trim()) return

    const templateName =
      activeTemplateType === 'follow_up'
        ? 'متابعة بعد الشراء'
        : activeTemplateType === 'vip_offer'
          ? 'عرض VIP'
          : activeTemplateType === 'birthday'
            ? 'تهنئة عيد ميلاد'
            : 'رسالة واتساب مخصصة'

    // Automatically record interaction
    await interactionMutation.mutateAsync({
      interaction_type: 'whatsapp',
      notes: `إرسال رسالة واتساب (${templateName}):\n${customMsg.trim()}`,
    })

    // Open WhatsApp
    const url = whatsappUrl(phone, customMsg.trim())
    window.open(url, '_blank', 'noopener,noreferrer')
    setActiveTemplateType(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="w-[94vw] max-w-xl overflow-y-auto p-4 sm:p-6"
      >
        {isLoading || !data ? (
          <div className="space-y-4 pt-10" aria-busy="true">
            <Skeleton className="h-14 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-56 w-full rounded-2xl" />
          </div>
        ) : (
          <div className="space-y-6 text-foreground">
            {/* Header: Customer Profile */}
            <SheetHeader className="space-y-3 pb-3 border-b border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-base border border-primary/20">
                    {user?.name ? user.name.charAt(0) : <UserIcon className="size-6" />}
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-base sm:text-lg font-bold truncate">
                      {user?.name || 'عميل بدون اسم'}
                    </SheetTitle>
                    <SheetDescription className="font-mono text-xs flex items-center gap-1.5 mt-0.5">
                      <span>{phone}</span>
                      {phone && (
                        <button
                          type="button"
                          onClick={handleCopyPhone}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="نسخ رقم الهاتف"
                        >
                          {copiedPhone ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </button>
                      )}
                    </SheetDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={`text-xs px-2.5 py-1 font-bold border ${tierConfig.bg}`}>
                    {tierConfig.label}
                  </Badge>
                  {customerId && (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="size-8 p-0 rounded-lg text-muted-foreground hover:text-primary"
                      title="فتح الملف الكامل"
                    >
                      <Link to={`/admin/users/${customerId}`}>
                        <ExternalLink className="size-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* Quick actions bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {phone && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1.5"
                  >
                    <a href={`tel:${phone}`}>
                      <Phone className="size-3.5 text-primary" />
                      <span>اتصال</span>
                    </a>
                  </Button>
                )}
                {phone && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-xl text-xs gap-1.5 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20"
                  >
                    <a href={whatsappUrl(phone)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="size-3.5" />
                      <span>واتساب</span>
                    </a>
                  </Button>
                )}
                {crm?.city && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground ms-auto">
                    <MapPin className="size-3.5 text-primary" />
                    <span>{crm.city}</span>
                  </span>
                )}
              </div>
            </SheetHeader>

            {/* Birthday banner if today */}
            {crm?.is_birthday_today && (
              <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-l from-amber-500/20 via-amber-500/10 to-transparent p-3.5 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎉</span>
                  <div>
                    <p className="font-extrabold text-sm">اليوم عيد ميلاد العميل!</p>
                    <p className="text-[11px] font-normal text-amber-800 dark:text-amber-300">
                      فرصة مميزة لإرسال تهنئة وهدية كود خصم لتعزيز الولاء.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => selectTemplate('birthday')}
                  className="rounded-xl text-xs font-bold h-8 bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                >
                  <Gift className="size-3.5 me-1" />
                  <span>تهنئة الآن</span>
                </Button>
              </div>
            )}

            {/* CRM Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Package className="size-3 text-primary" />
                  <span>الطلبات</span>
                </span>
                <p className="font-mono font-black text-lg text-foreground">
                  {crm?.total_orders ?? 0}
                </p>
                <span className="text-[10px] text-muted-foreground block truncate">
                  منها {crm?.delivered_orders_count ?? 0} مستلمة
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="size-3 text-emerald-600" />
                  <span>الإنفاق</span>
                </span>
                <p className="font-mono font-black text-lg text-emerald-700 dark:text-emerald-400 truncate">
                  {formatPrice(crm?.lifetime_spend || '0.00')}
                </p>
                <span className="text-[10px] text-muted-foreground block truncate">
                  متوسط: {formatPrice(crm?.average_order_value || '0.00')}
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="size-3 text-primary" />
                  <span>آخر طلب</span>
                </span>
                <p className="font-mono text-xs font-bold text-foreground truncate mt-1">
                  {crm?.last_order_date
                    ? new Date(crm.last_order_date).toLocaleDateString('ar-LY', {
                        month: 'short',
                        day: 'numeric',
                      })
                    : 'لا يوجد'}
                </p>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {crm?.last_order_date
                    ? new Date(crm.last_order_date).getFullYear()
                    : 'لم يطلب بعد'}
                </span>
              </div>

              <div className="rounded-2xl border border-border bg-card p-3 shadow-2xs space-y-1">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="size-3 text-rose-500" />
                  <span>الميلاد</span>
                </span>
                <p className="font-mono text-xs font-bold text-foreground truncate mt-1">
                  {crm?.birthday || 'غير مسجل'}
                </p>
                <span className="text-[10px] text-muted-foreground block truncate">
                  {crm?.is_birthday_today ? '🎉 اليوم!' : 'سجل الميلاد'}
                </span>
              </div>
            </div>

            {/* Customer Tags Section */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Tag className="size-3.5 text-primary" />
                  <span>وسوم العميل ({user?.tags?.length || 0})</span>
                </h4>
                {!isAddingTag && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingTag(true)}
                    className="h-7 text-xs px-2 rounded-lg text-primary hover:bg-primary/10 gap-1"
                  >
                    <Plus className="size-3" />
                    <span>إضافة وسم</span>
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 min-h-7">
                {(user?.tags || []).length > 0 ? (
                  user?.tags?.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors"
                      style={{
                        backgroundColor: `${t.color}15`,
                        color: t.color,
                        borderColor: `${t.color}35`,
                      }}
                    >
                      <span>{t.name}</span>
                      <button
                        type="button"
                        onClick={() =>
                          tagMutation.mutate({ action: 'remove', tag_id: t.id })
                        }
                        className="rounded-full hover:bg-black/10 dark:hover:bg-white/10 p-0.5 transition-colors"
                        title="إزالة الوسم"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    لا توجد وسوم مخصصة لهذا العميل حتى الآن.
                  </p>
                )}
              </div>

              {/* Inline Add Tag */}
              {isAddingTag && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-primary">
                    <span>إضافة وسم جديد أو اختيار وسم موجود:</span>
                    <button
                      type="button"
                      onClick={() => setIsAddingTag(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {allTags
                        .filter((at) => !user?.tags?.some((ut) => ut.id === at.id))
                        .map((existingTag) => (
                          <button
                            key={existingTag.id}
                            type="button"
                            onClick={() =>
                              tagMutation.mutate({ action: 'add', tag_id: existingTag.id })
                            }
                            className="rounded-md border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:border-primary hover:text-primary transition-colors"
                          >
                            + {existingTag.name}
                          </button>
                        ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <Input
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="اسم الوسم (مثال: محب للعود، عميل متطلب...)"
                      className="h-8 text-xs rounded-lg bg-card"
                    />
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="size-8 rounded-lg border border-border cursor-pointer bg-card p-0.5"
                      title="اختر لون الوسم"
                    />
                    <Button
                      size="sm"
                      disabled={!newTagName.trim() || tagMutation.isPending}
                      onClick={() =>
                        tagMutation.mutate({
                          action: 'add',
                          tag_name: newTagName.trim(),
                          color: newTagColor,
                        })
                      }
                      className="h-8 text-xs rounded-lg px-3"
                    >
                      حفظ
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* WhatsApp Templates & Quick Actions */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <MessageCircle className="size-3.5 text-emerald-600" />
                  <span>إجراءات وقوالب الواتساب السريعة</span>
                </h4>
                {data.active_coupons?.length > 0 && (
                  <select
                    value={selectedCoupon}
                    onChange={(e) => {
                      setSelectedCoupon(e.target.value)
                      // re-apply the template with the new coupon
                      if (activeTemplateType) setCustomMsg(renderTemplate(activeTemplateType, e.target.value))
                    }}
                    className="h-7 rounded-lg border border-border bg-background px-2 text-[11px] font-mono font-bold text-foreground"
                    title="اختر كود الخصم لإدراجه في الرسالة"
                  >
                    <option value="">كوبون الخصم: تلقائي</option>
                    {data.active_coupons.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.code} ({c.value} {c.type === 'percentage' ? '%' : 'د.ل'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectTemplate('follow_up')}
                  className={`h-9 text-xs rounded-xl justify-start px-2.5 font-bold ${
                    activeTemplateType === 'follow_up'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : ''
                  }`}
                >
                  <Package className="size-3.5 me-1 text-primary shrink-0" />
                  <span className="truncate">متابعة بعد الشراء</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectTemplate('vip_offer')}
                  className={`h-9 text-xs rounded-xl justify-start px-2.5 font-bold ${
                    activeTemplateType === 'vip_offer'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : ''
                  }`}
                >
                  <Sparkles className="size-3.5 me-1 text-amber-500 shrink-0" />
                  <span className="truncate">عرض VIP خاص</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectTemplate('birthday')}
                  className={`h-9 text-xs rounded-xl justify-start px-2.5 font-bold ${
                    activeTemplateType === 'birthday'
                      ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                      : ''
                  }`}
                >
                  <Gift className="size-3.5 me-1 text-rose-500 shrink-0" />
                  <span className="truncate">تهنئة ميلاد</span>
                </Button>
              </div>

              {/* Message preview and sender */}
              {activeTemplateType && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <span>معاينة نص الرسالة:</span>
                    <button
                      type="button"
                      onClick={() => setActiveTemplateType(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <Textarea
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    rows={3}
                    className="text-xs rounded-xl bg-card"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-muted-foreground">
                      سيتم تسجيل الرسالة تلقائياً في سجل تواصل العميل.
                    </span>
                    <Button
                      size="sm"
                      onClick={handleSendWhatsApp}
                      disabled={!customMsg.trim() || interactionMutation.isPending}
                      className="h-8 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      <Send className="size-3.5" />
                      <span>إرسال عبر واتساب</span>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-2xs">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Package className="size-3.5 text-primary" />
                <span>آخر الطلبات ({data.recent_orders?.length || 0})</span>
              </h4>

              {data.recent_orders?.length > 0 ? (
                <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                  {data.recent_orders.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-0.5">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="font-mono font-bold text-primary hover:underline block"
                        >
                          #{o.order_number}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString('ar-LY', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {o.city ? ` · ${o.city}` : ''}
                        </span>
                      </div>
                      <div className="text-end space-y-0.5">
                        <span className="font-mono font-bold text-foreground block">
                          {formatPrice(o.total || o.total_amount)}
                        </span>
                        <Badge tone="neutral" className="text-[10px] px-1.5 py-0 font-normal">
                          {o.stage_label || o.stage}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  لا توجد طلبات مسجلة لهذا العميل حتى الآن.
                </p>
              )}
            </div>

            {/* Customer Communication Log (سجل التواصل) */}
            <div className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" />
                  <span>سجل التواصل والملاحظات ({data.interactions?.length || 0})</span>
                </h4>
              </div>

              {/* Add Interaction Form */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.keys(INTERACTION_CONFIG) as InteractionType[]).map((t) => {
                    const cfg = INTERACTION_CONFIG[t]
                    const Icon = cfg.icon
                    const isSelected = newType === t
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewType(t)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-2xs'
                            : 'bg-card text-muted-foreground border border-border hover:text-foreground'
                        }`}
                      >
                        <Icon className="size-3" />
                        <span>{cfg.label}</span>
                      </button>
                    )
                  })}
                </div>

                <Textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="سجل تفاصيل المكالمة، الملاحظة، الشكوى، أو المتابعة…"
                  rows={2}
                  className="text-xs rounded-xl bg-card"
                />

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!newNotes.trim() || interactionMutation.isPending}
                    onClick={() =>
                      interactionMutation.mutate({
                        interaction_type: newType,
                        notes: newNotes.trim(),
                      })
                    }
                    className="h-8 rounded-xl text-xs font-bold px-3"
                  >
                    تسجيل في السجل
                  </Button>
                </div>
              </div>

              {/* Past Interactions List */}
              {data.interactions?.length > 0 ? (
                <div className="space-y-2.5">
                  {data.interactions.map((interaction) => {
                    const cfg =
                      INTERACTION_CONFIG[interaction.interaction_type] ||
                      INTERACTION_CONFIG.note
                    const Icon = cfg.icon
                    return (
                      <div
                        key={interaction.id}
                        className="rounded-xl border border-border bg-card p-3 space-y-1.5 text-xs shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${cfg.color}`}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <span className="font-bold text-foreground">
                              {interaction.interaction_type_display || cfg.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate">
                              بواسطة: {interaction.staff_name || 'النظام'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {formatDateTime(interaction.created_at)}
                            </span>
                            {canDeleteInteractions && (
                              <button
                                type="button"
                                onClick={() =>
                                  deleteInteractionMutation.mutate(interaction.id)
                                }
                                disabled={deleteInteractionMutation.isPending}
                                className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
                                title="حذف السجل (صلاحية مدير فما فوق)"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed pe-2">
                          {interaction.notes}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  لا توجد تفاعلات أو اتصالات مسجلة مع هذا العميل بعد.
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
