import {
  ArrowUpRight,
  Cake,
  Download,
  Filter,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { CustomerDrawer } from '@/components/admin/CustomerDrawer'
import { DataTable } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import { useCities } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { CustomerTag, User } from '@/types/api'

interface BirthdayItem {
  id: string
  name: string
  phone_number: string
  birthday: string
  days_until: number
  is_today: boolean
}

const ROLE_LABELS: Record<string, string> = {
  customer: 'عميل',
  staff: 'موظف',
  manager: 'مدير',
  admin: 'مشرف',
  owner: 'المالك',
}

const ROLE_TONES: Record<string, 'neutral' | 'primary' | 'success' | 'warning' | 'danger'> = {
  customer: 'neutral',
  staff: 'primary',
  manager: 'warning',
  admin: 'primary',
  owner: 'success',
}

const DEFAULT_TIER_CONFIG: {
  label: string
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
} = {
  label: 'جديد',
  tone: 'success',
  className: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
}

const TIER_CONFIG: Record<
  string,
  { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'; className?: string }
> = {
  vip: {
    label: 'VIP',
    tone: 'warning',
    className: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
  },
  repeat: {
    label: 'متكرر',
    tone: 'primary',
    className: 'bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-500/30',
  },
  new: DEFAULT_TIER_CONFIG,
  inactive: {
    label: 'خامل',
    tone: 'neutral',
    className: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  },
}

export default function AdminUsers() {
  usePageTitle('سجل العملاء وإدارة CRM — لوحة التحكم')
  const { data: currentUser } = useMe()
  const canExportCSV = Boolean(
    currentUser?.role && ['manager', 'admin', 'owner'].includes(currentUser.role)
  )

  const url = useUrlState({
    search: '',
    page: '1',
    role: '',
    tier: '',
    tag_id: '',
    city_id: '',
    sort: '',
  })

  const currentRole = url.get('role')
  const currentTier = url.get('tier')
  const currentTagId = url.get('tag_id')
  const currentCityId = url.get('city_id')
  const currentSort = url.get('sort')

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Fetch users with full CRM annotations
  const query = useQuery({
    queryKey: [
      'admin-users',
      url.get('search'),
      url.get('page'),
      currentRole,
      currentTier,
      currentTagId,
      currentCityId,
      currentSort,
    ],
    queryFn: async () => {
      const response = await api.get<User[]>('/admin/users/', {
        params: {
          search: url.get('search') || undefined,
          role: currentRole || undefined,
          tier: currentTier || undefined,
          tag_id: currentTagId || undefined,
          city_id: currentCityId || undefined,
          sort: currentSort || undefined,
          page: Number(url.get('page')) || 1,
          limit: 20,
        },
      })
      return {
        items: response.data,
        meta: response.meta ?? { page: 1, limit: 20, total: 0, pages: 1 },
      }
    },
  })

  // Upcoming birthdays query
  const birthdaysQuery = useQuery({
    queryKey: ['admin-upcoming-birthdays'],
    queryFn: async () => {
      const res = await api.get<BirthdayItem[]>('/admin/users/upcoming-birthdays/')
      return res.data
    },
    staleTime: 5 * 60_000,
  })

  // Tags query for filter dropdown
  const tagsQuery = useQuery({
    queryKey: ['admin-customer-tags'],
    queryFn: async () => {
      const res = await api.get<CustomerTag[]>('/admin/customer-tags/')
      return res.data
    },
  })

  // Cities query for filter dropdown
  const { data: cityData } = useCities()
  const cities = cityData?.cities ?? []

  const openCustomer = (id: string) => {
    setSelectedCustomerId(id)
    setDrawerOpen(true)
  }

  // Handle CSV export
  const handleExportCSV = async () => {
    try {
      setIsExporting(true)
      const params = new URLSearchParams()
      if (url.get('search')) params.set('search', String(url.get('search')))
      if (currentRole) params.set('role', currentRole)
      if (currentTier) params.set('tier', currentTier)
      if (currentTagId) params.set('tag_id', currentTagId)
      if (currentCityId) params.set('city_id', currentCityId)
      if (currentSort) params.set('sort', currentSort)

      const downloadUrl = `/api/admin/users/export/?${params.toString()}`
      const res = await fetch(downloadUrl, { credentials: 'include' })
      if (!res.ok) throw new Error('فشل تصدير ملف العملاء')

      const blob = await res.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error(err)
    } finally {
      setIsExporting(false)
    }
  }

  const roleChips = [
    {
      id: 'all',
      label: 'الكل',
      active: !currentRole,
      onClick: () => url.set({ role: '', page: 1 }),
    },
    {
      id: 'customer',
      label: 'العملاء',
      active: currentRole === 'customer',
      onClick: () => url.set({ role: 'customer', page: 1 }),
    },
    {
      id: 'staff',
      label: 'طاقم العمل والمسؤولين',
      active: currentRole === 'staff',
      onClick: () => url.set({ role: 'staff', page: 1 }),
    },
  ]

  const tierChips = [
    { id: '', label: 'كافة التصنيفات' },
    { id: 'vip', label: 'VIP 👑' },
    { id: 'repeat', label: 'متكرر 🔁' },
    { id: 'new', label: 'جديد 🌱' },
    { id: 'inactive', label: 'خامل ⏳' },
  ]

  const columns = [
    {
      key: 'name',
      header: 'الاسم والمستخدم',
      sortable: true,
      cell: (u: User) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
            {u.name ? u.name.charAt(0) : <UserIcon className="size-4" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-foreground text-xs sm:text-sm block truncate group-hover:text-primary transition-colors">
                {u.name || 'عميل بدون اسم'}
              </span>
              {u.crm?.is_birthday_today && (
                <span className="text-xs" title="اليوم عيد ميلاد العميل! 🎉">
                  🎉
                </span>
              )}
            </div>
            {u.email && (
              <span className="text-[11px] text-muted-foreground block truncate">{u.email}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone_number',
      header: 'الهاتف',
      cell: (u: User) => (
        <span className="font-mono font-semibold text-xs text-foreground">{u.phone_number}</span>
      ),
    },
    {
      key: 'tier',
      header: 'التصنيف',
      cell: (u: User) => {
        if (u.role !== 'customer') {
          return (
            <Badge tone={ROLE_TONES[u.role] ?? 'neutral'} className="text-xs px-2.5 py-0.5">
              <ShieldCheck className="size-3 me-1" />
              {ROLE_LABELS[u.role] ?? u.role}
            </Badge>
          )
        }
        const tier = u.crm?.tier || 'new'
        const cfg = (tier && TIER_CONFIG[tier]) ? TIER_CONFIG[tier]! : DEFAULT_TIER_CONFIG
        return (
          <Badge tone={cfg.tone} className={`text-xs px-2.5 py-0.5 border ${cfg.className || ''}`}>
            {u.crm?.tier_label || cfg.label}
          </Badge>
        )
      },
    },
    {
      key: 'total_orders',
      header: 'الطلبات',
      align: 'start' as const,
      cell: (u: User) => (
        <span className="font-mono font-bold text-xs text-foreground">
          {u.crm?.total_orders ?? 0}
        </span>
      ),
    },
    {
      key: 'lifetime_spend',
      header: 'الإنفاق',
      cell: (u: User) => (
        <span className="font-mono font-bold text-xs text-emerald-700 dark:text-emerald-400">
          {formatPrice(u.crm?.lifetime_spend || '0.00')}
        </span>
      ),
    },
    {
      key: 'city',
      header: 'المدينة',
      cell: (u: User) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[100px]">
          {u.crm?.city || '—'}
        </span>
      ),
    },
    {
      key: 'tags',
      header: 'الوسوم',
      cell: (u: User) => (
        <div className="flex flex-wrap items-center gap-1 max-w-[150px]">
          {(u.tags || []).length > 0 ? (
            u.tags?.slice(0, 2).map((tag) => (
              <span
                key={tag.id}
                className="inline-block rounded px-1.5 py-0.2 text-[10px] font-bold border truncate"
                style={{
                  backgroundColor: `${tag.color}15`,
                  color: tag.color,
                  borderColor: `${tag.color}35`,
                }}
              >
                {tag.name}
              </span>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground/60">—</span>
          )}
          {(u.tags || []).length > 2 && (
            <span className="text-[10px] text-muted-foreground font-mono">
              +{(u.tags?.length || 0) - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'end' as const,
      cell: (u: User) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              openCustomer(u.id)
            }}
            className="h-7 px-2.5 rounded-lg text-xs font-bold gap-1 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
          >
            <span>CRM</span>
          </Button>
          <Link
            to={`/admin/users/${u.id}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg border border-border bg-card p-1 text-muted-foreground shadow-2xs hover:bg-muted hover:text-foreground transition-all"
            title="الملف الكامل"
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      ),
    },
  ]

  const upcomingBirthdays = birthdaysQuery.data || []

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="سجل العملاء وإدارة العلاقات (CRM)"
        description="تصنيف العملاء (VIP، متكرر، خامل)، سجل التفاعلات، تتبع أعياد الميلاد، والوسوم المخصصة."
        actions={
          canExportCSV ? (
            <Button
              variant="outline"
              size="sm"
              disabled={isExporting}
              onClick={handleExportCSV}
              className="rounded-xl text-xs font-bold gap-1.5 h-10 px-3.5 shadow-2xs"
            >
              <Download className="size-4 text-primary" />
              <span>{isExporting ? 'جارِ التصدير…' : 'تصدير CSV'}</span>
            </Button>
          ) : null
        }
      />

      {/* Upcoming Birthdays Alert Bar */}
      {upcomingBirthdays.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-l from-amber-500/15 via-amber-500/5 to-transparent p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cake className="size-5 text-amber-600 animate-bounce" />
              <h3 className="text-xs sm:text-sm font-extrabold text-amber-950 dark:text-amber-200">
                أعياد ميلاد قادمة هذا الأسبوع ({upcomingBirthdays.length})
              </h3>
            </div>
            <span className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
              فرصة ممتازة للتواصل وتقديم عروض ولاء خاصة
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {upcomingBirthdays.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => openCustomer(b.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition-all shadow-2xs border ${
                  b.is_today
                    ? 'bg-amber-500 text-white border-amber-600 hover:bg-amber-600'
                    : 'bg-card text-foreground border-amber-500/30 hover:border-amber-500 hover:bg-amber-500/10'
                }`}
              >
                <span>{b.is_today ? '🎉 اليوم:' : '📅'}</span>
                <span>{b.name || b.phone_number}</span>
                <span className="text-[10px] font-mono opacity-80">
                  {b.is_today ? 'عيد ميلاده!' : `بعد ${b.days_until} أيام`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CRM Filters Toolbar */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tier Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground me-1 flex items-center gap-1">
              <Filter className="size-3 text-primary" />
              <span>التصنيف:</span>
            </span>
            {tierChips.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => url.set({ tier: t.id, page: 1 })}
                className={`rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                  currentTier === t.id
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Secondary Dropdowns: Tags, City, Sort */}
          <div className="flex flex-wrap items-center gap-2 ms-auto">
            {/* Tag Filter */}
            {tagsQuery.data && tagsQuery.data.length > 0 && (
              <select
                value={currentTagId}
                onChange={(e) => url.set({ tag_id: e.target.value, page: 1 })}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="">كافة الوسوم</option>
                {tagsQuery.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    وسم: {t.name}
                  </option>
                ))}
              </select>
            )}

            {/* City Filter */}
            {cities.length > 0 && (
              <select
                value={currentCityId}
                onChange={(e) => url.set({ city_id: e.target.value, page: 1 })}
                className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground"
              >
                <option value="">كافة المدن</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            {/* Sort Selector */}
            <select
              value={currentSort}
              onChange={(e) => url.set({ sort: e.target.value, page: 1 })}
              className="h-9 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground font-mono"
            >
              <option value="">الترتيب: الأحدث تسجيلاً</option>
              <option value="spend_desc">الأعلى إنفاقاً (د.ل)</option>
              <option value="orders_desc">الأكثر طلباً</option>
              <option value="recent_order">أحدث طلب</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Customers Table */}
      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(u: User) => u.id}
        isLoading={query.isPending}
        total={query.data?.meta?.total ?? 0}
        pages={query.data?.meta?.pages ?? 1}
        page={Number(url.get('page')) || 1}
        onPageChange={(page) => url.set({ page })}
        search={String(url.get('search') ?? '')}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        searchPlaceholder="ابحث بالاسم، رقم الهاتف، أو البريد الإلكتروني…"
        filterChips={roleChips}
        onRowClick={(u) => openCustomer(u.id)}
        emptyTitle="لا يوجد عملاء مطابقون"
        emptyDescription="جرّب تعديل عبارة البحث أو معايير التصفية والتصنيف."
      />

      {/* Customer CRM Slide-Over Drawer */}
      <CustomerDrawer
        customerId={selectedCustomerId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  )
}
