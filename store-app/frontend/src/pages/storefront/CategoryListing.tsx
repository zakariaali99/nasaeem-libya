import { useParams } from 'react-router-dom'

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
  const { data: categories } = useCategories()
  const category = flatten(categories ?? []).find((item) => item.slug === slug)
  const name = category?.name ?? decodeURIComponent(slug)

  usePageTitle(name, `تصفّح منتجات ${name} من نسائم ليبيا.`)

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
