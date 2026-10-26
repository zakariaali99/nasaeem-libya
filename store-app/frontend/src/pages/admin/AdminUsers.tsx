import { ArrowUpRight, Cake, Download, ShieldCheck, User } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { CustomerDrawer } from '@/components/admin/CustomerDrawer'
import { SegmentBadge, TagPill } from '@/components/admin/CustomerProfilePanel'
import { DataTable } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { formatDate, formatPrice } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import {
  type CustomerRow,
  type Segment,
  SEGMENT_LABELS,
  customersExportUrl,
  useBirthdays,
  useCustomerTags,
  useCustomers,
} from '@/lib/queries/crm'
import { useCities } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'

const ROLE_LABELS: Record<string, string> = {
  customer: 'عميل',
  support: 'خدمة العملاء',
  staff: 'موظف',
  manager: 'مشرف',
  admin: 'مدير',
  owner: 'المالك',
}

const SEGMENTS = Object.keys(SEGMENT_LABELS) as Segment[]

export default function AdminUsers() {
  usePageTitle('العملاء — لوحة التحكم')
  const { data: me } = useMe()
  const url = useUrlState({ search: '', page: '1', role: 'customer', segment: '', tag: '', city: '', ordering: '' })
  const [viewing, setViewing] = React.useState<string | null>(null)

  const params = {
    search: url.get('search') || undefined,
    role: url.get('role') || undefined,
    segment: url.get('segment') || undefined,
    tag: url.get('tag') || undefined,
    city: url.get('city') || undefined,
    ordering: url.get('ordering') || undefined,
    page: Number(url.get('page')) || 1,
    limit: 20,
  }
  const query = useCustomers(params)
  const { data: tags = [] } = useCustomerTags()
  const { data: citiesData } = useCities()
  const { data: birthdays = [] } = useBirthdays()
  const canExport = ['manager', 'admin', 'owner'].includes(me?.role ?? '')

  const roleChips = [
    { id: 'customer', label: 'العملاء', value: 'customer' },
    { id: 'all', label: 'الكل', value: 'all' },
    { id: 'staff', label: 'طاقم العمل', value: 'staff' },
  ].map((chip) => ({
    id: chip.id,
    label: chip.label,
    active: (url.get('role') || '') === chip.value,
    onClick: () => url.set({ role: chip.value, page: 1 }),
  }))
  const segmentChips = SEGMENTS.map((segment) => ({
    id: segment,
    label: SEGMENT_LABELS[segment],
    active: url.get('segment') === segment,
    onClick: () => url.set({ segment: url.get('segment') === segment ? '' : segment, page: 1 }),
  }))

  const columns = [
    {
      key: 'name',
      header: 'العميل',
      primary: true,
      cell: (user: CustomerRow) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
            {user.name ? user.name.charAt(0) : <User className="size-4" />}
          </div>
          <div className="min-w-0">
            <span className="block truncate text-xs font-bold text-foreground transition-colors group-hover:text-primary sm:text-sm">
              {user.name || 'عميل بدون اسم'}
              {user.birthday_today ? <Cake className="ms-1 inline size-3.5 text-discount" aria-label="عيد ميلاده اليوم" /> : null}
            </span>
            <span className="block font-mono text-[11px] text-muted-foreground">{user.phone_number}</span>
            {user.tags.length ? (
              <span className="mt-1 flex flex-wrap gap-1">
                {user.tags.map((tag) => <TagPill key={tag.id} tag={tag} />)}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'segment',
      header: 'التصنيف',
      cell: (u: CustomerRow) =>
        u.role === 'customer' ? (
          <SegmentBadge segment={u.segment} />
        ) : (
          <Badge tone="primary" className="text-xs"><ShieldCheck className="size-3" /> {ROLE_LABELS[u.role] ?? u.role}</Badge>
        ),
    },
    {
      key: 'orders',
      header: 'الطلبات',
      sortable: true,
      cell: (u: CustomerRow) => <span className="font-mono text-xs font-bold">{u.orders_count}</span>,
    },
    {
      key: 'spend',
      header: 'الإنفاق',
      sortable: true,
      cell: (u: CustomerRow) => <span className="font-mono text-xs font-black text-price">{formatPrice(u.spend)}</span>,
    },
    {
      key: 'last_order',
      header: 'آخر طلب',
      sortable: true,
      cell: (u: CustomerRow) => (
        <span className="font-mono text-xs text-muted-foreground">{u.last_order_at ? formatDate(u.last_order_at) : '—'}</span>
      ),
    },
    {
      key: 'city',
      header: 'المدينة',
      cell: (u: CustomerRow) => <span className="text-xs">{u.city || '—'}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'end' as const,
      cell: (u: CustomerRow) => (
        <Link
          to={`/admin/users/${u.id}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs transition-all hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          <span>الملف</span>
          <ArrowUpRight className="size-3" />
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="العملاء"
        description="التصنيف والإنفاق وآخر طلب لكل عميل، مع الوسوم وسجل التواصل ورسائل واتساب الجاهزة."
        action={
          canExport ? (
            <Button asChild variant="outline" className="gap-1.5 rounded-xl text-xs font-bold">
              <a href={customersExportUrl(params)} download>
                <Download className="size-4" /> تصدير CSV
              </a>
            </Button>
          ) : undefined
        }
      />

      {birthdays.length ? (
        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-discount/30 bg-discount/5 p-3 text-xs">
          <Cake className="size-4 text-discount" />
          <span className="font-bold">أعياد ميلاد هذا الأسبوع:</span>
          {birthdays.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setViewing(b.id)}
              className="rounded-full border border-border bg-card px-2.5 py-1 font-semibold hover:border-primary"
            >
              {b.name || b.phone_number}
              {b.today ? <span className="ms-1 text-discount">اليوم 🎉</span> : <span className="ms-1 font-mono text-muted-foreground">{b.birthday.slice(5)}</span>}
            </button>
          ))}
        </section>
      ) : null}

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(u: CustomerRow) => u.id}
        isLoading={query.isPending}
        total={query.data?.meta?.total ?? 0}
        pages={query.data?.meta?.pages ?? 1}
        page={Number(url.get('page')) || 1}
        onPageChange={(page) => url.set({ page })}
        sort={url.get('ordering') || undefined}
        onSortChange={(ordering) => url.set({ ordering, page: 1 })}
        search={String(url.get('search') ?? '')}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        searchPlaceholder="ابحث بالاسم، رقم الهاتف، أو البريد…"
        filterChips={[...roleChips, ...segmentChips]}
        toolbar={
          <div className="flex flex-wrap gap-2">
            <Select
              aria-label="الوسم"
              className="h-10 w-auto px-3 text-xs"
              value={url.get('tag') || ''}
              onChange={(e) => url.set({ tag: e.target.value, page: 1 })}
            >
              <option value="">كل الوسوم</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <Select
              aria-label="المدينة"
              className="h-10 w-auto px-3 text-xs"
              value={url.get('city') || ''}
              onChange={(e) => url.set({ city: e.target.value, page: 1 })}
            >
              <option value="">كل المدن</option>
              {(citiesData?.cities ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        }
        onRowClick={(u) => setViewing(u.id)}
        emptyTitle="لا يوجد عملاء مطابقون"
        emptyDescription="جرّب تعديل البحث أو التصفية."
      />

      <CustomerDrawer customerId={viewing} onOpenChange={(open) => !open && setViewing(null)} />
    </div>
  )
}
