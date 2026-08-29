import { useNavigate } from 'react-router-dom'

import { ProductForm } from '@/components/admin/ProductForm'
import { PageHeader } from '@/components/layout/AdminLayout'
import { useCreateProduct } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminProductNewPage() {
  usePageTitle('منتج جديد — لوحة التحكم')
  const navigate = useNavigate()
  const create = useCreateProduct()

  return (
    <>
      <PageHeader title="منتج جديد" description="املأ التفاصيل ثم احفظ ليظهر المنتج في المتجر." />
      <ProductForm
        key="product-new"
        submitLabel="حفظ المنتج"
        pending={create.isPending}
        serverError={create.error}
        onSubmit={async (values) => {
          const response = await create.mutateAsync(values)
          const slug = (response as { data: { slug: string } }).data.slug
          navigate(`/admin/products/${encodeURIComponent(slug)}`, { replace: true })
        }}
      />
    </>
  )
}
