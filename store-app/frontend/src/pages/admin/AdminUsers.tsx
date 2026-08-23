import { ArrowUpRight, ShieldCheck, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { DataTable } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'

interface AdminUser {
  id: string
  phone_number: string
  name: string
  email: string
  role: string
  is_active: boolean
  date_joined: string
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

export default function AdminUsers() {
  usePageTitle('سجل العملاء والمستخدمين — لوحة التحكم')
  const navigate = useNavigate()
  const url = useUrlState({ search: '', page: '1', role: '' })
  const currentRole = url.get('role')

  const query = useQuery({
    queryKey: ['admin-users', url.get('search'), url.get('page'), currentRole],
    queryFn: async () => {
      const response = await api.get<AdminUser[]>('/admin/users/', {
        params: {
          search: url.get('search') || undefined,
          role: currentRole || undefined,
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

  const filterChips = [
    {
      id: 'all',
      label: 'كل المستخدمين',
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

  const columns = [
    {
      key: 'name',
      header: 'الاسم والمستخدم',
      sortable: true,
      cell: (user: AdminUser) => (
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
            {user.name ? user.name.charAt(0) : <User className="size-4" />}
          </div>
          <div className="min-w-0">
            <span className="font-bold text-foreground text-xs sm:text-sm block truncate group-hover:text-primary transition-colors">
              {user.name || 'عميل بدون اسم'}
            </span>
            {user.email && (
              <span className="text-[11px] text-muted-foreground block truncate">{user.email}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone_number',
      header: 'رقم الهاتف',
      cell: (u: AdminUser) => <span className="font-mono font-semibold text-xs text-foreground">{u.phone_number}</span>,
    },
    {
      key: 'role',
      header: 'نوع الحساب والصلاحية',
      cell: (u: AdminUser) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={ROLE_TONES[u.role] ?? 'neutral'} className="text-xs px-2.5 py-0.5">
            {u.role !== 'customer' && <ShieldCheck className="size-3 me-1" />}
            {ROLE_LABELS[u.role] ?? u.role}
          </Badge>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (u: AdminUser) =>
        u.is_active ? (
          <Badge tone="success" className="text-xs">نشط</Badge>
        ) : (
          <Badge tone="danger" className="text-xs">معطل</Badge>
        ),
    },
    {
      key: 'date_joined',
      header: 'تاريخ التسجيل',
      cell: (u: AdminUser) => (
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(u.date_joined).toLocaleDateString('ar-LY', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'end' as const,
      cell: (u: AdminUser) => (
        <Link
          to={`/admin/users/${u.id}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground shadow-2xs hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all inline-flex items-center gap-1"
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
        title="سجل العملاء والمستخدمين"
        description="إدارة الحسابات، صلاحيات الموظفين، سجل العناوين والطلبات السابقة"
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(u: AdminUser) => u.id}
        isLoading={query.isPending}
        total={query.data?.meta?.total ?? 0}
        pages={query.data?.meta?.pages ?? 1}
        page={Number(url.get('page')) || 1}
        onPageChange={(page) => url.set({ page })}
        search={String(url.get('search') ?? '')}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        searchPlaceholder="ابحث بالاسم، رقم الهاتف، أو البريد الإلكتروني…"
        filterChips={filterChips}
        onRowClick={(u) => navigate(`/admin/users/${u.id}`)}
        emptyTitle="لا يوجد مستخدمون مطابقون"
        emptyDescription="جرّب تعديل عبارة البحث أو التصفية."
      />
    </div>
  )
}
