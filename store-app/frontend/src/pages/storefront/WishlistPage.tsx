import { Heart, ShoppingBag } from 'lucide-react'
import { Link } from '@/lib/i18nRouter'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ProductCard } from '@/components/storefront/ProductCard'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWishlist } from '@/lib/queries/wishlist'
import { usePageTitle } from '@/lib/usePageTitle'
import { t, tCount } from '@/lib/i18n'

export default function WishlistPage() {
  usePageTitle(t('wishlist.title'))
  const { data: items, isPending } = useWishlist()

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-rise">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
              <Heart className="size-4 fill-rose-500" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('wishlist.title')}</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {t('wishlist.subtitle')}
          </p>
        </div>
        {items && items.length > 0 && (
          <span className="text-xs font-mono font-bold bg-muted px-3 py-1.5 rounded-full text-foreground">
            {tCount('wishlist.count', items.length)}
          </span>
        )}
      </div>

      {/* Content */}
      {isPending ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-8 text-rose-500" aria-hidden="true" />}
          title={t('wishlist.emptyTitle')}
          description={t('wishlist.emptyText')}
          action={
            <Button asChild className="rounded-xl font-bold gap-2">
              <Link to="/">
                <ShoppingBag className="size-4" />
                <span>{t('wishlist.browse')}</span>
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.id} product={item.product} />
          ))}
        </div>
      )}
    </div>
  )
}
