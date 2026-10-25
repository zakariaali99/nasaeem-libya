import { Link } from '@/lib/i18nRouter'

import { ProductGrid } from '@/components/storefront/ProductGrid'
import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

// An empty widget renders nothing. It used to fall back to hard-coded sample
// products and categories "for the admin preview", but the storefront uses
// these same renderers — so shoppers were shown perfumes the store does not
// sell. The builder draws its own placeholder for an empty widget instead.

export function ProductListWidget({ widget }: { widget: Widget }) {
  const products = widget.data.products ?? []
  if (products.length === 0) return null

  return (
    <div className="space-y-4">
      <WidgetHeading title={widget.data.title} actionLabel={widget.data.actionLabel} actionUrl={widget.data.actionUrl} />
      <ProductGrid products={products} layout={widget.data.layout ?? 'grid'} />
    </div>
  )
}

export function CollectionShowcase({ widget }: { widget: Widget }) {
  const collection = widget.data.collection
  const products = widget.data.products ?? []
  if (!collection || products.length === 0) return null

  return (
    <div className="space-y-4 rounded-3xl border border-border/80 bg-muted/20 p-5 sm:p-8">
      <WidgetHeading
        title={widget.data.title || collection.name}
        actionLabel={widget.data.actionLabel}
        actionUrl={widget.data.actionUrl || `/collections/${encodeURIComponent(collection.slug)}`}
      />
      {widget.data.description || collection.description ? (
        <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-2xl">
          {widget.data.description || collection.description}
        </p>
      ) : null}
      <ProductGrid products={products} layout={widget.data.layout ?? 'grid'} />
    </div>
  )
}

export function CategoryListWidget({ widget }: { widget: Widget }) {
  const categories = widget.data.categories ?? []
  if (categories.length === 0) return null

  const slider = widget.data.layout === 'slider'

  return (
    <div className="space-y-4">
      <WidgetHeading title={widget.data.title} actionLabel={widget.data.actionLabel} actionUrl={widget.data.actionUrl} />
      <ul
        className={cn(
          slider
            ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar'
            : 'grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
        )}
      >
        {categories.map((category) => (
          <li key={category.id} className={cn(slider && 'w-32 shrink-0 snap-start sm:w-36')}>
            <Link
              to={`/categories/${encodeURIComponent(category.slug)}`}
              className="card-hover group flex h-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/80 bg-card p-4 text-center hover:border-primary/50 hover:shadow-md transition-all shadow-2xs"
            >
              {category.image_url ? (
                <div className="flex size-14 sm:size-16 items-center justify-center rounded-xl bg-muted/40 p-2 border border-border/60 group-hover:scale-105 transition-transform">
                  <img
                    src={category.image_url}
                    alt={category.name}
                    width={120}
                    height={120}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-contain"
                  />
                </div>
              ) : (
                <span className="flex size-14 sm:size-16 items-center justify-center rounded-xl bg-primary/10 text-primary text-base font-black border border-primary/20 group-hover:scale-105 transition-transform">
                  {category.name.slice(0, 1)}
                </span>
              )}
              <span className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
