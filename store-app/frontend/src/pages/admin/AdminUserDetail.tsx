import { ArrowRight, Calendar, DollarSign, Mail, Package, Phone, User, UserCheck } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'
import { formatDateTime, formatNumber, formatPrice } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useQuery } from '@tanstack/react-query'
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
  usePageTitle('ملف العميل — لوحة التحكم')

  const userQuery = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: async () => (await api.get<AdminUser>(`/admin/users/${userId}/`)).data,
    enabled: Boolean(userId),
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

  if (userQuery.isPending) {
    return (
      <div className="space-y-6 animate-fade-rise">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    )
  }

  const user = userQuery.data
  if (!user) {
    return (
      <div className="rounded-3xl border border-border bg-card p-12 text-center shadow-xs space-y-4">
        <p className="text-base font-bold text-foreground">المستخدم المطلوب غير موجود.</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/admin/users">العودة لقائمة المستخدمين</Link>
        </Button>
      </div>
    )
  }

  const orders = ordersQuery.data?.items ?? []
  const totalOrders = ordersQuery.data?.meta.total ?? 0
  const totalSpend = orders.reduce((sum, o) => sum + Number(o.total || 0), 0)

  return (
    <div className="space-y-6 animate-fade-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="icon" className="size-10 rounded-xl border-border bg-card">
            <Link to="/admin/users" aria-label="العودة للمستخدمين">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {user.name || 'عميل بدون اسم'}
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-0.5">{user.phone_number}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user.is_active ? (
            <Badge tone="success" className="text-xs font-bold">حساب نشط</Badge>
          ) : (
            <Badge tone="neutral" className="text-xs font-bold">حساب معطّل</Badge>
          )}
          <Badge tone="primary" className="text-xs font-bold uppercase">{user.role}</Badge>
        </div>
      </div>

      {/* Customer Quick Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي الطلبات</span>
            <Package className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">{formatNumber(totalOrders)}</p>
          <p className="text-[11px] text-muted-foreground">طلب مسجل</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي المشتريات (آخر 10)</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-price">{formatPrice(totalSpend)}</p>
          <p className="text-[11px] text-muted-foreground">قيمة المشتريات</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>تاريخ التسجيل</span>
            <Calendar className="size-4 text-sky-500" />
          </div>
          <p className="font-mono text-sm sm:text-base font-bold text-foreground">
            {new Date(user.date_joined).toLocaleDateString('ar-LY', { year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
          <p className="text-[11px] text-muted-foreground">عضو منذ التسجيل</p>
        </div>
      </div>

      {/* Main Grid: Details + Orders */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Details Card */}
        <div className="rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-xs space-y-4 lg:self-start">
          <div className="flex items-center gap-3 border-b border-border/80 pb-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black text-lg border border-primary/20">
              {user.name ? user.name.charAt(0) : <User className="size-6" />}
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-foreground truncate">{user.name || 'عميل مسجل'}</h2>
              <span className="text-xs text-muted-foreground block font-mono">{user.phone_number}</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4 text-primary shrink-0" />
              <span>البريد:</span>
              <span className="font-medium text-foreground truncate">{user.email || '—'}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4 text-primary shrink-0" />
              <span>الهاتف:</span>
              <span className="font-mono font-medium text-foreground">{user.phone_number}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <UserCheck className="size-4 text-primary shrink-0" />
              <span>الصلاحية:</span>
              <span className="font-semibold text-foreground">{user.role}</span>
            </div>
          </div>
        </div>

        {/* User Orders History Card */}
        <div className="lg:col-span-2 rounded-3xl border border-border bg-card overflow-hidden shadow-xs">
          <div className="border-b border-border p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Package className="size-5 text-primary" />
              <h3 className="font-bold text-sm sm:text-base text-foreground">سجل طلبات العميل</h3>
            </div>
            <span className="font-mono text-xs font-bold bg-muted px-3 py-1 rounded-full text-foreground">
              {orders.length} من أصل {totalOrders}
            </span>
          </div>

          {ordersQuery.isPending ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Package className="size-10 mx-auto text-muted-foreground/50" />
              <p className="text-xs font-semibold text-muted-foreground">لا توجد طلبات سابقة لهذا العميل.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {orders.map((order) => (
                <div key={order.id} className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/20 transition-colors">
                  <div className="min-w-0">
                    <Link
                      to={`/admin/orders/${order.order_number}`}
                      className="font-mono font-bold text-xs sm:text-sm text-primary hover:underline block"
                    >
                      #{order.order_number}
                    </Link>
                    <span className="text-[11px] text-muted-foreground font-mono mt-0.5 block">
                      {formatDateTime(order.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <StatusBadge status={order.status} />
                    <span className="font-mono font-extrabold text-xs sm:text-sm text-price">
                      {formatPrice(order.total)}
                    </span>
                    <Button asChild size="sm" variant="outline" className="rounded-xl h-8 px-3 text-xs font-bold">
                      <Link to={`/admin/orders/${order.order_number}`}>عرض</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
