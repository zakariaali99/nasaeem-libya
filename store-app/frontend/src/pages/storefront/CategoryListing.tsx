import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { Button } from '@/components/ui/button'

import { ProductListing } from '@/components/storefront/ProductListing'
import { useCategories } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

function flatten(categories: { name: string; slug: string; children?: unknown[] }[]): {
  name: string
  slug: string
}[] {
  return categories.flatMap((category) => [
    { name: category.name, slug: category.slug },
    ...flatten((category.children ?? []) as never[]),
  ])
}

/**
 * New work, not a port: the reference had no category page and filtered
 * through `/products?category=` instead (`reference/INVENTORY.md` §2).
 */
export default function CategoryListingPage() {
  const { slug = '' } = useParams()
  const { data: categories, isPending } = useCategories()
  const category = flatten(categories ?? []).find((item) => item.slug === slug)
  const name = category?.name ?? (isPending ? '' : 'القسم غير موجود')

  usePageTitle(name || 'القسم', category ? `تصفّح منتجات ${name} من نسائم ليبيا.` : undefined)

  // A mistyped or deleted category used to render as a category named after
  // the address itself, with "0 products" under it.
  if (!isPending && !category) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="sr-only">القسم غير موجود</h1>
        <EmptyState
          title="القسم غير موجود"
          description="ربما تغيّر رابطه أو أُزيل من المتجر."
          action={
            <Button asChild>
              <Link to="/products">تصفّح كل المنتجات</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <ProductListing
      heading={name}
      fixedParams={{ category: slug }}
      showFacets={false}
      emptyTitle={`لا توجد منتجات في ${name} حالياً`}
      emptyDescription="هذا التصنيف لم تُضف إليه منتجات بعد، أو لا يوجد ما يطابق التصفية."
    />
  )
}
