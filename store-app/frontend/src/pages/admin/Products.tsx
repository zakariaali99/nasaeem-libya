import {
  AlertTriangle,
  Eye,
  EyeOff,
  FilterX,
  Layers,
  Package,
  PackageMinus,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber, formatPrice } from '@/lib/format'
import { useDeleteProduct, useProducts } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { Product } from '@/types/api'

export default function AdminProductsPage() {
  usePageTitle('كتالوج المنتجات والعطور — لوحة التحكم')
  const navigate = useNavigate()
  const { get, set } = useUrlState({ sort: 'newest', stock_filter: '' })
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null)

  const page = Number(get('page') || 1)
  const search = get('search')
  const sort = get('sort')
  const stockFilter = get('stock_filter')

  const query = useProducts({ page, search: search || undefined, sort, limit: 20 })
  const remove = useDeleteProduct()

  const allItems = query.data?.items ?? []
  const totalProducts = query.data?.meta?.total ?? 0

  // Calculate metrics
  const activeCount = allItems.filter((i) => i.is_active).length
  const lowStockCount = allItems.filter((i) => i.available_stock > 0 && i.available_stock <= 5 && i.track_quantity).length
  const outOfStockCount = allItems.filter((i) => i.available_stock <= 0 && i.track_quantity && !i.has_variants).length

  const filterChips = [
    {
      id: 'all',
      label: `كل المنتجات (${totalProducts})`,
      active: !stockFilter,
      onClick: () => set({ stock_filter: '', page: 1 }),
    },
    {
      id: 'in_stock',
      label: 'متوفر بالمخزون',
      active: stockFilter === 'in_stock',
      onClick: () => set({ stock_filter: 'in_stock', page: 1 }),
    },
    {
      id: 'low_stock',
      label: 'مخزون منخفض (≤ 5)',
      active: stockFilter === 'low_stock',
      onClick: () => set({ stock_filter: 'low_stock', page: 1 }),
    },
    {
      id: 'out_of_stock',
      label: 'نفد من المخزون (0)',
      active: stockFilter === 'out_of_stock',
      onClick: () => set({ stock_filter: 'out_of_stock', page: 1 }),
    },
  ]

  // Client-side stock filtering when active
  const filteredItems = allItems.filter((item) => {
    if (!stockFilter) return true
    if (stockFilter === 'out_of_stock') return item.available_stock <= 0 && item.track_quantity && !item.has_variants
    if (stockFilter === 'low_stock') return item.available_stock > 0 && item.available_stock <= 5 && item.track_quantity
    if (stockFilter === 'in_stock') return item.available_stock > 0 || !item.track_quantity || item.has_variants
    return true
  })

  const columns: Column<Product>[] = [
    {
      key: 'name',
      header: 'المنتج والعلامة',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.images[0] ? (
            <img
              src={row.images[0].renditions.thumb ?? row.images[0].url}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              className="size-11 shrink-0 rounded-2xl object-cover border border-border bg-muted/30 shadow-2xs"
            />
          ) : (
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground border border-border">
              <Package className="size-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0">
            <span className="font-bold text-foreground text-xs sm:text-sm block truncate group-hover:text-primary transition-colors">
              {row.name}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-[11px] text-muted-foreground">
                {row.sku ? `SKU: ${row.sku}` : 'بدون رمز'}
              </span>
              {row.categories?.[0] && (
                <span className="text-[10px] bg-muted px-1.5 py-0.2 rounded text-muted-foreground font-semibold">
                  {row.categories[0].name}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'سعر البيع',
      sortable: true,
      cell: (row) => (
        <div className="space-y-0.5">
          <div className="font-mono font-extrabold text-price text-xs sm:text-sm">
            {row.price ? formatPrice(row.price) : '—'}
          </div>
          {row.discount_percent ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-muted-foreground line-through">
                {formatPrice(row.compare_at_price)}
              </span>
              <Badge tone="discount" className="text-[10px] px-1 py-0 font-mono">
                {row.discount_percent}%-
              </Badge>
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'حالة المخزون',
      cell: (row) =>
        !row.track_quantity ? (
          <Badge tone="neutral" className="text-xs">غير محدود</Badge>
        ) : row.has_variants ? (
          <Badge tone="neutral" className="text-xs gap-1 font-mono">
            <Layers className="size-3" />
            <span>حسب الخيار ({row.variants?.length ?? 0})</span>
          </Badge>
        ) : row.available_stock <= 0 ? (
          <Badge tone="danger" className="text-xs font-mono font-bold">نفد (0)</Badge>
        ) : row.available_stock <= 5 ? (
          <Badge tone="warning" className="text-xs font-mono font-bold">{formatNumber(row.available_stock)} متبقي</Badge>
        ) : (
          <Badge tone="success" className="text-xs font-mono font-bold">{formatNumber(row.available_stock)} قطعة</Badge>
        ),
    },
    {
      key: 'is_active',
      header: 'حالة النشر بالمتجر',
      cell: (row) =>
        row.is_active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <Eye className="size-3.5" />
            <span>منشور بالمتجر</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <EyeOff className="size-3.5" />
            <span>مخفي (مسودة)</span>
          </span>
        ),
    },
  ]

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="كتالوج المنتجات والعطور"
        description="إدارة المنتجات، تسعير العطور، متابعة المخزون، وإعداد الخيارات المتعددة"
        action={
          <Button asChild size="sm" className="rounded-xl font-bold shadow-xs gap-1.5 h-10 px-4">
            <Link to="/admin/products/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>إضافة عطر جديد</span>
            </Link>
          </Button>
        }
      />

      {/* KPI Metric Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي المنتجات</span>
            <Package className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">{formatNumber(totalProducts)}</p>
          <p className="text-[11px] text-muted-foreground">صنف مسجل بالكتالوج</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>منشور ومعروض</span>
            <Eye className="size-4 text-emerald-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatNumber(activeCount)}</p>
          <p className="text-[11px] text-muted-foreground">يظهر للعملاء في المتجر</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>مخزون منخفض</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{formatNumber(lowStockCount)}</p>
          <p className="text-[11px] text-muted-foreground">أقل من 5 قطع بالمستودع</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>نفد من المخزون</span>
            <PackageMinus className="size-4 text-destructive" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-destructive">{formatNumber(outOfStockCount)}</p>
          <p className="text-[11px] text-muted-foreground">يحتاج إلى توريد عاجل</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filteredItems}
        rowKey={(row) => row.id}
        isLoading={query.isLoading}
        error={query.error ? { message: (query.error as Error).message } : null}
        onRetry={() => query.refetch()}
        page={page}
        pages={query.data?.meta?.pages ?? 1}
        total={query.data?.meta?.total}
        onPageChange={(next) => set({ page: next })}
        search={search}
        onSearchChange={(value) => set({ search: value, page: 1 })}
        searchPlaceholder="ابحث باسم العطر، الرمز SKU، أو الوصف…"
        filterChips={filterChips}
        sort={sort}
        onSortChange={(value) => set({ sort: value })}
        toolbar={
          stockFilter || search ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => set({ stock_filter: '', search: '', page: 1 })}
              className="h-10 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 border-destructive/30 gap-1.5"
            >
              <FilterX className="size-3.5" />
              <span>مسح الفلاتر</span>
            </Button>
          ) : null
        }
        onRowClick={(row) => navigate(`/admin/products/${encodeURIComponent(row.slug)}`)}
        emptyTitle="لا توجد منتجات مطابقة"
        emptyDescription="جرّب تعديل عبارة البحث أو اختيار حالة تصفية أخرى."
        emptyAction={
          <Button asChild className="rounded-xl font-bold mt-2">
            <Link to="/admin/products/new">
              <Plus className="size-4" aria-hidden="true" />
              <span>إضافة منتج جديد</span>
            </Link>
          </Button>
        }
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button asChild variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={`تعديل ${row.name}`}>
              <Link to={`/admin/products/${encodeURIComponent(row.slug)}`}>
                <Pencil className="size-3.5" aria-hidden="true" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              aria-label={`حذف ${row.name}`}
              onClick={() => setPendingDelete(row)}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="حذف المنتج"
        description={`هل أنت متأكد من حذف "${pendingDelete?.name}"؟ إذا كان المنتج مرتبطاً بسجلات سابقة فسيتم إخفاؤه تلقائياً للحفاظ على السجلات المالية.`}
        confirmLabel="حذف نهائي"
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return
          await remove.mutateAsync(pendingDelete.slug)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
