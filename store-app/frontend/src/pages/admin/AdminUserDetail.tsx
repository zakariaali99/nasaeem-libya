import { Link, useParams } from 'react-router-dom'

import { useQuery } from '@tanstack/react-query'
import { StatusBadge } from '@/components/admin/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import type { Order } from '@/types/api'

interface AdminUser {
  id: string
  phone_number: string
  name: string
  email: string
  role: string
  is_active: boolean
  date_joined: string
}

export default function AdminUserDetail() {
  const { userId = '' } = useParams()
  const userQuery = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: async () => (await api.get<AdminUser>(`/admin/users/${userId}/`)).data,
  })
  const ordersQuery = useQuery({
    queryKey: ['admin-user-orders', userId],
    queryFn: async () => {
      const response = await api.get<Order[]>('/orders/', {
        params: { user: userId, limit: 10 },
      })
      return {
        items: response.data,
        meta: response.meta ?? { page: 1, limit: 10, total: 0, pages: 1 },
      }
    },
    enabled: Boolean(userId),
  })

  if (userQuery.isPending) return <Skeleton className="h-64 w-full" />
  const user = userQuery.data
  if (!user) return <p className="py-16 text-center text-muted-foreground">المستخدم غير موجود</p>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{user.name || 'بدون اسم'}</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{user.phone_number}</p>
      </div>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 text-sm sm:grid-cols-2">
        <p>البريد الإلكتروني: <span className="font-medium">{user.email || '—'}</span></p>
        <p>تاريخ الانضمام: <span className="font-medium">{new Date(user.date_joined).toLocaleDateString('ar-LY')}</span></p>
        <p>الحالة: <span className="font-medium">{user.is_active ? 'نشط' : 'معطل'}</span></p>
        <p>عدد الطلبات: <span className="font-bold">{ordersQuery.data?.meta.total ?? '…'}</span></p>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <h2 className="border-b border-border p-4 font-semibold">آخر الطلبات</h2>
        {(ordersQuery.data?.items ?? []).length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">لا توجد طلبات</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {(ordersQuery.data?.items ?? []).map((order) => (
              <li key={order.id} className="flex items-center justify-between p-3">
                <Link to={`/admin/orders/${order.order_number}`} className="font-mono font-semibold text-primary hover:underline">
                  {order.order_number}
                </Link>
                <StatusBadge status={order.status} />
                <span>{formatPrice(order.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link to="/admin/users" className="block text-sm font-semibold text-primary underline">العودة إلى القائمة</Link>
    </div>
  )
}
