import { Link } from 'react-router-dom'

import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { useUrlState } from '@/lib/useUrlState'
import { api } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'

interface AdminUser {
  id: string
  phone_number: string
  name: string
  email: string
  role: string
  is_active: boolean
  date_joined: string
}

export default function AdminUsers() {
  const url = useUrlState({ search: '', page: '1' })
  const query = useQuery({
    queryKey: ['admin-users', url.get('search'), url.get('page')],
    queryFn: async () => {
      const response = await api.get<AdminUser[]>('/admin/users/', {
        params: { search: url.get('search') || undefined, page: Number(url.get('page')) || 1, limit: 20 },
      })
      return {
        items: response.data,
        meta: response.meta ?? { page: 1, limit: 20, total: 0, pages: 1 },
      }
    },
  })

  const ROLE_LABELS: Record<string, string> = {
    customer: 'عميل', staff: 'موظف', manager: 'مدير', admin: 'مشرف', owner: 'المالك',
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">العملاء</h1>
      <DataTable
        columns={[
          {
            key: 'name', header: 'الاسم', sortable: true,
            cell: (user: AdminUser) => (
              <Link to={`/admin/users/${user.id}`} className="font-semibold text-primary hover:underline">
                {user.name || '—'}
              </Link>
            ),
          },
          { key: 'phone_number', header: 'رقم الهاتف', cell: (u: AdminUser) => <span className="font-mono">{u.phone_number}</span> },
          { key: 'role', header: 'الدور', cell: (u: AdminUser) => <Badge tone={u.role === 'customer' ? 'neutral' : 'primary'}>{ROLE_LABELS[u.role] ?? u.role}</Badge> },
          { key: 'date_joined', header: 'تاريخ الانضمام', cell: (u: AdminUser) => new Date(u.date_joined).toLocaleDateString('ar-LY') },
        ]}
        rows={query.data?.items ?? []}
        rowKey={(u: AdminUser) => u.id}
        isLoading={query.isPending}
        total={query.data?.meta.total ?? 0}
        pages={query.data?.meta.pages ?? 1}
        page={Number(url.get('page')) || 1}
        onPageChange={(page) => url.set({ page })}
        search={String(url.get('search') ?? '')}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        emptyTitle="لا يوجد عملاء مطابقون"
      />
    </div>
  )
}
