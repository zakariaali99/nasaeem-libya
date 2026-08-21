import { ProductListing } from '@/components/storefront/ProductListing'
import { usePageTitle } from '@/lib/usePageTitle'

export default function ProductsPage() {
  usePageTitle('كل المنتجات', 'تصفّح كل عطور وزيوت وأطقم هدايا نسائم ليبيا.')

  return (
    <ProductListing
      heading="كل المنتجات"
      description="عطور ومستحضرات من 13 علامة عالمية، بتوصيل إلى جميع المدن الليبية."
    />
  )
}
