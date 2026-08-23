import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AdminLayout'
import { DataTable } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAdminPaymentMethods, type AdminPaymentMethod } from '@/lib/queries/payments'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminPaymentMethodsPage() {
  usePageTitle('طرق الدفع — لوحة التحكم')
  const { data: methods, isLoading } = useAdminPaymentMethods()
  const [search, setSearch] = useState('')

  const filteredMethods = (methods ?? []).filter(
    (m) =>
      m.display_name.toLowerCase().includes(search.toLowerCase()) ||
      m.method_code.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="بوابات وطرق الدفع"
        description="إدارة بوابات الدفع الإلكتروني (معاملات، بلوتو، سداد، بينانس) وطرق الدفع اليدوية وعند الاستلام."
      />

      <DataTable
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="بحث في بوابات وطرق الدفع..."
        columns={[
          {
            key: 'display_name',
            header: 'طريقة الدفع',
            cell: (m: AdminPaymentMethod) => (
              <div className="space-y-1">
                <span className="font-semibold text-foreground">{m.display_name}</span>
                <span className="block text-xs font-mono text-muted-foreground">{m.method_code}</span>
              </div>
            ),
          },
          {
            key: 'description',
            header: 'الوصف والتعليمات',
            cell: (m: AdminPaymentMethod) => m.description || '—',
          },
          {
            key: 'sort_order',
            header: 'الترتيب',
            cell: (m: AdminPaymentMethod) => m.sort_order,
          },
          {
            key: 'is_enabled',
            header: 'الحالة',
            cell: (m: AdminPaymentMethod) =>
              m.is_enabled ? <Badge tone="success">مفعّلة</Badge> : <Badge tone="neutral">معطّلة</Badge>,
          },
          {
            key: 'actions',
            header: 'الإجراءات',
            cell: (m: AdminPaymentMethod) => (
              <Button asChild size="sm" variant="outline">
                <Link to={`/admin/payment_methods/${encodeURIComponent(m.method_code)}`}>إعدادات البوابة</Link>
              </Button>
            ),
          },
        ]}
        rows={filteredMethods}
        rowKey={(m: AdminPaymentMethod) => m.id}
        isLoading={isLoading}
        emptyTitle="لا توجد طرق دفع"
        emptyDescription="لم يتم العثور على أي طرق دفع معرّفة."
      />
    </div>
  )
}
