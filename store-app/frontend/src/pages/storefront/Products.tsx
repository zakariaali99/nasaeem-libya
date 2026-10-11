import { ProductListing } from '@/components/storefront/ProductListing'
import { usePageTitle } from '@/lib/usePageTitle'
import { useSiteText } from '@/lib/siteText'

export default function ProductsPage() {
  usePageTitle('كل المنتجات', 'تصفّح كل عطور وزيوت وأطقم هدايا نسائم ليبيا.')

  const description = useSiteText()('products.description')

  return (
    <ProductListing
      heading="كل المنتجات"
      description={description}
    />
  )
}
