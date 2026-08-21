import { Boxes, FolderTree, Package, Tags } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '@/components/layout/AdminLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { useCategories, useCollections, useProducts } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

/** Phase 3 stand-in. The actionable dashboard — orders awaiting fulfilment,
 * payments awaiting verification, revenue trend — is Phase 7. */
export default function AdminDashboardPage() {
  usePageTitle('لوحة التحكم')
  const products = useProducts({ limit: 1 })
  const lowStock = useProducts({ limit: 1, in_stock: false })
  const categories = useCategories()
  const collections = useCollections()

  const tiles = [
    {
      label: 'المنتجات',
      value: products.data?.meta?.total,
      to: '/admin/products',
      icon: Package,
      loading: products.isLoading,
    },
    {
      label: 'التصنيفات',
      value: categories.data?.length,
      to: '/admin/categories',
      icon: FolderTree,
      loading: categories.isLoading,
    },
    {
      label: 'المجموعات',
      value: collections.data?.length,
      to: '/admin/collections',
      icon: Tags,
      loading: collections.isLoading,
    },
    {
      label: 'المخزون',
      value: lowStock.data?.meta?.total,
      to: '/admin/inventory',
      icon: Boxes,
      loading: lowStock.isLoading,
    },
  ]

  return (
    <>
      <PageHeader title="لوحة التحكم" description="نظرة سريعة على المتجر." />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, to, icon: Icon, loading }) => (
          <li key={label}>
            {/* Every tile links to the list that resolves it. */}
            <Link
              to={to}
              className="flex min-h-28 flex-col justify-between rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{label}</span>
                <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-3xl font-bold text-foreground">
                  {value === undefined ? '—' : formatNumber(value)}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
