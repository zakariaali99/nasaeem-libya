import { useParams } from 'react-router-dom'
import { Link } from '@/lib/i18nRouter'

import { EmptyState } from '@/components/storefront/EmptyState'
import { Button } from '@/components/ui/button'

import { ProductListing } from '@/components/storefront/ProductListing'
import { useCategories } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { t } from '@/lib/i18n'

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
  const name = category?.name ?? (isPending ? '' : t('category.notFound'))

  usePageTitle(name || t('category.fallbackTitle'), category ? t('category.metaDescription', { name }) : undefined)

  // A mistyped or deleted category used to render as a category named after
  // the address itself, with "0 products" under it.
  if (!isPending && !category) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="sr-only">{t('category.notFound')}</h1>
        <EmptyState
          title={t('category.notFound')}
          description={t('category.notFoundText')}
          action={
            <Button asChild>
              <Link to="/products">{t('listing.browseAll')}</Link>
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
      emptyTitle={t('category.emptyTitle', { name })}
      emptyDescription={t('category.emptyText')}
    />
  )
}
