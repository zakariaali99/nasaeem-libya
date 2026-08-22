import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAdminDeliveryMethods, useSyncDeliveryMethod, type AdminDeliveryMethod } from '@/lib/queries/delivery'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminDeliveryMethodsPage() {
  usePageTitle('شركات التوصيل — لوحة التحكم')
  const { data: methods, isLoading } = useAdminDeliveryMethods()
  const sync = useSyncDeliveryMethod()

  return (
    <div className="space-y-6">
      <PageHeader
        title="شركات التوصيل والشحن"
        description="إدارة شركات الشحن المحلية، ربط واجهات الـ API، وتحديث بيانات الفروع والتسعير."
      />

      <DataTable
        columns={[
          {
            key: 'name',
            header: 'شركة التوصيل',
            cell: (m: AdminDeliveryMethod) => (
              <div className="space-y-1">
                <span className="font-semibold text-foreground">{m.name}</span>
                <span className="block text-xs font-mono text-muted-foreground">{m.code}</span>
              </div>
            ),
          },
          {
            key: 'description',
            header: 'الوصف والتغطية',
            cell: (m: AdminDeliveryMethod) => m.description || '—',
          },
          {
            key: 'is_active',
            header: 'الحالة',
            cell: (m: AdminDeliveryMethod) =>
              m.is_active ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="neutral">معطّلة</Badge>,
          },
          {
            key: 'actions',
            header: 'الإجراءات',
            cell: (m: AdminDeliveryMethod) => (
              <div className="flex items-center gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/admin/delivery/${encodeURIComponent(m.code)}`}>إعدادات الربط</Link>
                </Button>
                {m.is_active && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={sync.isPending}
                    onClick={() => sync.mutate(m.code)}
                  >
                    مزامنة المدن
                  </Button>
                )}
              </div>
            ),
          },
        ]}
        rows={methods ?? []}
        rowKey={(m: AdminDeliveryMethod) => m.id}
        isLoading={isLoading}
        emptyTitle="لا توجد شركات توصيل"
        emptyDescription="لم يتم تعريف أي شركة شحن في النظام."
      />
    </div>
  )
}
