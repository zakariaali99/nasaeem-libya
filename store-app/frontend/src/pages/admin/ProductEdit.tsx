import { Boxes, Layers } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { ProductForm } from '@/components/admin/ProductForm'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useProduct, useUpdateProduct } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminProductEditPage() {
  const { productSlugOrId } = useParams()
  const query = useProduct(productSlugOrId)
  const update = useUpdateProduct()
  usePageTitle(query.data ? `${query.data.name} — لوحة التحكم` : 'تعديل منتج — لوحة التحكم')

  if (query.isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (query.error || !query.data) {
    return (
      <Alert tone="error">
        تعذّر تحميل المنتج.{' '}
        <button type="button" className="underline" onClick={() => query.refetch()}>
          إعادة المحاولة
        </button>
      </Alert>
    )
  }

  const product = query.data

  return (
    <>
      <PageHeader
        title={product.name}
        description={`الرابط: /products/${product.slug}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/admin/products/${encodeURIComponent(product.slug)}/variants`}>
                <Layers aria-hidden="true" />
                الخيارات ({product.variants?.length ?? 0})
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/admin/inventory?search=${encodeURIComponent(product.name)}`}>
                <Boxes aria-hidden="true" />
                المخزون
              </Link>
            </Button>
          </>
        }
      />
      <ProductForm
        key={product.id}
        product={product}
        submitLabel="حفظ التغييرات"
        pending={update.isPending}
        serverError={update.error}
        onSubmit={async (values) => {
          await update.mutateAsync({ lookup: product.slug, ...values })
        }}
      />
    </>
  )
}
