import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { Button } from '@/components/ui/button'

import { ProductListing } from '@/components/storefront/ProductListing'
import { useCollections } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

/** New work, not a port — see `reference/INVENTORY.md` §2. */
export default function CollectionListingPage() {
  const { slug = '' } = useParams()
  const { data: collections, isPending } = useCollections()
  const collection = (collections ?? []).find((item) => item.slug === slug)
  const name = collection?.name ?? (isPending ? '' : 'المجموعة غير موجودة')

  usePageTitle(name || 'المجموعة', collection?.description || undefined)

  if (!isPending && !collection) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="sr-only">المجموعة غير موجودة</h1>
        <EmptyState
          title="المجموعة غير موجودة"
          description="ربما تغيّر رابطها أو أُزيلت من المتجر."
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
      description={collection?.description}
      fixedParams={{ collection: slug }}
      showFacets={false}
      emptyTitle={`لا توجد منتجات في ${name} حالياً`}
      emptyDescription="هذه المجموعة فارغة، أو لا يوجد ما يطابق التصفية."
    />
  )
}
