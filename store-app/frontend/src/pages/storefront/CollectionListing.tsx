import { useParams } from 'react-router-dom'

import { ProductListing } from '@/components/storefront/ProductListing'
import { useCollections } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

/** New work, not a port — see `reference/INVENTORY.md` §2. */
export default function CollectionListingPage() {
  const { slug = '' } = useParams()
  const { data: collections } = useCollections()
  const collection = (collections ?? []).find((item) => item.slug === slug)
  const name = collection?.name ?? decodeURIComponent(slug)

  usePageTitle(name, collection?.description || `تصفّح مجموعة ${name} من نسائم ليبيا.`)

  return (
    <ProductListing
      heading={name}
      description={collection?.description}
      fixedParams={{ collection: slug }}
      showFacets={false}
      emptyTitle={`لا توجد منتجات في ${name} حالياً`}
      emptyDescription="هذه المجموعة فارغة، أو لا يوجد ما يطابق التصفية."
    />
  )
}
