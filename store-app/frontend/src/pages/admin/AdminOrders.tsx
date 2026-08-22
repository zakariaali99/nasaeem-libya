import { Link } from 'react-router-dom'

import { StatusBadge } from '@/components/admin/StatusBadge'
import { DataTable } from '@/components/admin/DataTable'
import { useUrlState } from '@/lib/useUrlState'
import { formatPrice } from '@/lib/format'
import { useMyOrders } from '@/lib/queries/orders'
import type { Order } from '@/types/api'

export default function AdminOrders() {
  const url = useUrlState({ search: '', status: '', page: '1' })
  const params = { get: (k: string) => String(url.get(k) ?? '') }
  const query = useMyOrders({
    search: params.get('search') || undefined,
    status: params.get('status') || undefined,
    page: params.get('page'),
    limit: 20,
  })

  const columns = [
    {
      key: 'order_number',
      header: 'رقم الطلب',
      cell: (order: Order) => (
        <Link to={`/admin/orders/${order.order_number}`} className="font-mono font-semibold text-primary hover:underline">
          {order.order_number}
        </Link>
      ),
      sortable: true,
    },
    { key: 'user', header: 'العميل', cell: (o: Order) => o.user?.name || o.user?.phone_number || '—' },
    { key: 'total', header: 'الإجمالي', cell: (o: Order) => formatPrice(o.total), sortable: true },
    { key: 'status', header: 'الحالة', cell: (o: Order) => <StatusBadge status={o.status} /> },
    { key: 'shipping_status', header: 'الشحن', cell: (o: Order) => <StatusBadge status={o.shipping_status} /> },
    {
      key: 'created_at',
      header: 'التاريخ',
      cell: (o: Order) => new Date(o.created_at).toLocaleDateString('ar-LY'),
      sortable: true,
    },
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">الطلبات</h1>
      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(o: Order) => o.id}
        isLoading={query.isPending}
        total={query.data?.meta.total ?? 0}
        pages={query.data?.meta.pages ?? 1}
        page={Number(params.get('page')) || 1}
        onPageChange={(page) => url.set({ page })}
        search={String(params.get('search') ?? '')}
        onSearchChange={(search) => url.set({ search, page: 1 })}
        toolbar={
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={String(params.get('status') ?? '')}
            onChange={(event) => url.set({ status: event.target.value, page: 1 })}
          >
            <option value="">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="processing">قيد المعالجة</option>
            <option value="completed">مكتمل</option>
            <option value="cancelled">ملغي</option>
          </select>
        }
        emptyTitle="لا توجد طلبات مطابقة"
        emptyDescription="جرّب تغيير البحث أو الحالة."
      />
    </div>
  )
}
