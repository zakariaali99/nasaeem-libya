import { useParams } from 'react-router-dom'
import { Link } from '@/lib/i18nRouter'

import { EmptyState } from '@/components/storefront/EmptyState'
import { Button } from '@/components/ui/button'

import { ProductListing } from '@/components/storefront/ProductListing'
import { useCollections } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { t } from '@/lib/i18n'

/** New work, not a port — see `reference/INVENTORY.md` §2. */
export default function CollectionListingPage() {
  const { slug = '' } = useParams()
  const { data: collections, isPending } = useCollections()
  const collection = (collections ?? []).find((item) => item.slug === slug)
  const name = collection?.name ?? (isPending ? '' : t('collection.notFound'))

  usePageTitle(name || t('collection.fallbackTitle'), collection?.description || undefined)

  if (!isPending && !collection) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="sr-only">{t('collection.notFound')}</h1>
        <EmptyState
          title={t('collection.notFound')}
          description={t('collection.notFoundText')}
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
      description={collection?.description}
      fixedParams={{ collection: slug }}
      showFacets={false}
      emptyTitle={t('category.emptyTitle', { name })}
      emptyDescription={t('collection.emptyText')}
    />
  )
}
