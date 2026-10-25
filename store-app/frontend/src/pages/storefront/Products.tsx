import { ProductListing } from '@/components/storefront/ProductListing'
import { usePageTitle } from '@/lib/usePageTitle'
import { useSiteText } from '@/lib/siteText'
import { t } from '@/lib/i18n'

export default function ProductsPage() {
  usePageTitle(t('products.title'), t('products.metaDescription'))

  const description = useSiteText()('products.description')

  return (
    <ProductListing
      heading={t('products.title')}
      description={description}
    />
  )
}
