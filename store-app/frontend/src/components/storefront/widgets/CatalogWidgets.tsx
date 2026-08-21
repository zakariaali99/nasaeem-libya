import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

/**
 * `product_list` and the four personalised widgets all render the same thing:
 * a titled row of products. They differ only in where the server got the list,
 * so they share one renderer rather than five copies that drift apart.
 *
 * A personalised widget is never empty — the server falls back to popular
 * products for a guest — so an empty list here means the operator picked
 * products that are all inactive, which is worth saying out loud.
 */
export function ProductListWidget({ widget }: { widget: Widget }) {
  const products = widget.data.products ?? []

  return (
    <div>
      <WidgetHeading
        title={widget.data.title}
        action={
          <Link
            to="/products"
            className="inline-flex h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            عرض الكل
          </Link>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات في هذا القسم"
          description="قد تكون المنتجات المختارة غير متاحة حالياً."
        />
      ) : (
        <ProductGrid products={products} layout={widget.data.layout ?? 'grid'} />
      )}
    </div>
  )
}

export function CollectionShowcase({ widget }: { widget: Widget }) {
  const collection = widget.data.collection
  const products = widget.data.products ?? []
  if (!collection) return null

  return (
    <div>
      <WidgetHeading
        title={widget.data.title || collection.name}
        action={
          <Link
            to={`/collections/${encodeURIComponent(collection.slug)}`}
            className="inline-flex h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            عرض المجموعة
          </Link>
        }
      />
      {collection.description ? (
        <p className="mb-4 text-sm text-muted-foreground">{collection.description}</p>
      ) : null}
      {products.length === 0 ? (
        <EmptyState title="لا توجد منتجات في هذه المجموعة بعد" />
      ) : (
        <ProductGrid products={products} layout={widget.data.layout ?? 'grid'} />
      )}
    </div>
  )
}

export function CategoryListWidget({ widget }: { widget: Widget }) {
  const categories = widget.data.categories ?? []
  if (categories.length === 0) return null

  const slider = widget.data.layout === 'slider'

  return (
    <div>
      <WidgetHeading title={widget.data.title} />
      <ul
        className={cn(
          slider
            ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2'
            : 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6',
        )}
      >
        {categories.map((category) => (
          <li key={category.id} className={cn(slider && 'w-28 shrink-0 snap-start sm:w-32')}>
            <Link
              to={`/categories/${encodeURIComponent(category.slug)}`}
              className="flex h-full flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt=""
                  width={120}
                  height={120}
                  loading="lazy"
                  className="size-16 object-contain"
                />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
                  {category.name.slice(0, 1)}
                </span>
              )}
              <span className="line-clamp-2 text-sm font-medium">{category.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
