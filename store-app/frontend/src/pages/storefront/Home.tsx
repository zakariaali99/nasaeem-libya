import { Store } from 'lucide-react'
import { Link } from '@/lib/i18nRouter'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { WidgetRenderer } from '@/components/storefront/widgets'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useStorefrontLayout } from '@/lib/queries/storefront'
import { useSiteText } from '@/lib/siteText'
import { usePageTitle } from '@/lib/usePageTitle'
import { t } from '@/lib/i18n'

/**
 * The homepage is entirely CMS-driven: one request returns the resolved layout
 * with every widget already populated.
 */
export default function HomePage() {
  usePageTitle('', t('home.metaDescription'))
  const siteText = useSiteText()
  const { data, isPending, isError, error, refetch } = useStorefrontLayout()

  if (isPending) return <HomeSkeleton />
  if (isError) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    )
  }

  const widgets = data?.widgets ?? []

  if (widgets.length === 0) {
    // No layout means no homepage. The reference printed the bare sentence
    // "لا توجد عناصر لعرضها حالياً" on an unstyled page here — on the store's
    // most important screen, with nowhere to go next.
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-16">
        <h1 className="sr-only">{t('common.storeName')}</h1>
        <EmptyState
          icon={<Store className="size-8" aria-hidden="true" />}
          title={siteText('home.empty.title') || t('common.storeName')}
          description={siteText('home.empty.text')}
          action={
            <Button asChild size="lg">
              <Link to="/products">{t('listing.browseAll')}</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <>
      {/* One h1 per page. The widgets carry h2 headings beneath it. */}
      <h1 className="sr-only">{t('home.heading')}</h1>
      {/* `stagger`: each widget rises in as the page composes. The shells own
       * their width, so the wrapper stays style-free. */}
      <div className="stagger">
        {widgets.map((widget, index) => (
          // The first widget holds the LCP image, so it is never lazy-loaded.
          <WidgetRenderer key={widget.id} widget={widget} priority={index === 0} />
        ))}
      </div>
    </>
  )
}

/** Matches the real layout's rhythm so the page does not jump when data lands. */
function HomeSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6" aria-busy="true">
      <span className="sr-only">{t('home.loading')}</span>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="aspect-[16/9] w-full sm:aspect-[21/9]" />
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="aspect-square" />
        ))}
      </div>
    </div>
  )
}
