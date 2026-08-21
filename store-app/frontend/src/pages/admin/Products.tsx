import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/AdminLayout'
import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber, formatPrice } from '@/lib/format'
import { useDeleteProduct, useProducts } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { Product } from '@/types/api'

export default function AdminProductsPage() {
  usePageTitle('المنتجات — لوحة التحكم')
  const { get, set } = useUrlState({ sort: 'newest' })
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)

  const page = Number(get('page') || 1)
  const search = get('search')
  const sort = get('sort')

  const query = useProducts({ page, search: search || undefined, sort, limit: 20 })
  const remove = useDeleteProduct()

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'المنتج',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.images[0] ? (
            <img
              src={row.images[0].renditions.thumb ?? row.images[0].url}
              alt=""
              width={40}
              height={40}
              loading="lazy"
              className="size-10 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div className="size-10 shrink-0 rounded-md bg-muted" aria-hidden="true" />
          )}
          <Link
            to={`/admin/products/${encodeURIComponent(row.slug)}`}
            className="min-h-11 content-center font-medium text-foreground underline-offset-4 hover:underline"
          >
            {row.name}
          </Link>
        </div>
      ),
    },
    { key: 'sku', header: 'الرمز', cell: (row) => row.sku || '—' },
    {
      key: 'price',
      header: 'السعر',
      sortable: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-medium text-price">{row.price ? formatPrice(row.price) : '—'}</div>
          {row.discount_percent ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground line-through">
                {formatPrice(row.compare_at_price)}
              </span>
              <Badge tone="discount">{row.discount_percent}%-</Badge>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'المخزون',
      cell: (row) =>
        !row.track_quantity ? (
          <Badge tone="neutral">غير محدود</Badge>
        ) : row.has_variants ? (
          <Badge tone="neutral">حسب الخيار</Badge>
        ) : row.available_stock <= 0 ? (
          <Badge tone="danger">نفد</Badge>
        ) : row.available_stock <= 5 ? (
          <Badge tone="warning">{formatNumber(row.available_stock)}</Badge>
        ) : (
          <Badge tone="success">{formatNumber(row.available_stock)}</Badge>
        ),
    },
    {
      key: 'is_active',
      header: 'الحالة',
      cell: (row) =>
        row.is_active ? <Badge tone="success">منشور</Badge> : <Badge tone="neutral">مخفي</Badge>,
    },
  ]

  return (
    <>
      <PageHeader
        title="المنتجات"
        description="أضف المنتجات وعدّل أسعارها وصورها وخياراتها."
        actions={
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus aria-hidden="true" />
              منتج جديد
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error ? { message: (query.error as Error).message } : null}
        onRetry={() => query.refetch()}
        page={page}
        pages={query.data?.meta?.pages ?? 1}
        total={query.data?.meta?.total}
        onPageChange={(next) => set({ page: next })}
        search={search}
        onSearchChange={(value) => set({ search: value })}
        searchPlaceholder="ابحث بالاسم أو الرمز…"
        sort={sort}
        onSortChange={(value) => set({ sort: value })}
        emptyTitle="لا توجد منتجات بعد"
        emptyDescription="ابدأ بإضافة أول منتج ليظهر في المتجر."
        emptyAction={
          <Button asChild>
            <Link to="/admin/products/new">
              <Plus aria-hidden="true" />
              أضف منتجاً
            </Link>
          </Button>
        }
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button asChild variant="ghost" size="icon" aria-label={`تعديل ${row.name}`}>
              <Link to={`/admin/products/${encodeURIComponent(row.slug)}`}>
                <Pencil aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`حذف ${row.name}`}
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف المنتج"
        description={`سيتم حذف "${pendingDelete?.name}". إذا كان المنتج مرتبطاً بطلبات سابقة فسيتم إخفاؤه بدل حذفه للحفاظ على سجل الطلبات.`}
        confirmLabel="حذف"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await remove.mutateAsync(pendingDelete.slug)
          setPendingDelete(null)
        }}
      />
    </>
  )
}
