import { ProductCard, ProductCardSkeleton } from '@/components/storefront/ProductCard'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/api'

export interface ProductGridProps {
  products: Product[]
  /** `slider` scrolls horizontally on every viewport; `grid` wraps. */
  layout?: 'grid' | 'slider'
  className?: string
}

/** 2 columns on mobile, 4 on desktop — `06-routes-and-pages.md`. */
const GRID = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4'

export function ProductGrid({ products, layout = 'grid', className }: ProductGridProps) {
  if (layout === 'slider') {
    return (
      <ul
        className={cn(
          'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [scrollbar-width:thin]',
          className,
        )}
      >
        {products.map((product, index) => (
          <li key={product.id} className="w-40 shrink-0 snap-start sm:w-52">
            <ProductCard product={product} priority={index === 0} sizes="200px" />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className={cn(GRID, className)}>
      {products.map((product, index) => (
        <li key={product.id} className="h-full">
          <ProductCard product={product} priority={index === 0} />
        </li>
      ))}
    </ul>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  )
}
