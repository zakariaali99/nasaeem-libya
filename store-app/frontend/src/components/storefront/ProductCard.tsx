import { Link } from 'react-router-dom'

import { DiscountBadge } from '@/components/storefront/DiscountBadge'
import { Price } from '@/components/storefront/Price'
import { ProductImage } from '@/components/storefront/ProductImage'
import { StockBadge } from '@/components/storefront/StockBadge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Product } from '@/types/api'

export interface ProductCardProps {
  product: Product
  /** The first card on a listing page is usually the LCP element. */
  priority?: boolean
  sizes?: string
}

export function ProductCard({ product, priority = false, sizes }: ProductCardProps) {
  return (
    <article className="card-hover group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xs">
      {/*
        One anchor per card, covering the image and the title together.
        Two separate links to the same product — the shape the reference used —
        is both a screen-reader repetition and a 22 px-tall touch target for the
        title. This is a single target the height of the whole card.
      */}
      <Link
        to={`/products/${encodeURIComponent(product.slug)}`}
        viewTransition
        className="relative block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {/* The zoom lives on a dedicated clipping wrapper so the scaled image
         * never bleeds into the title row below it. */}
        <div className="overflow-hidden">
          <ProductImage
            image={product.images?.[0]}
            alt={product.images?.[0]?.alt_text || product.name}
            priority={priority}
            sizes={sizes}
            className="transition-transform duration-[var(--duration-slow)] ease-out group-hover:scale-[1.04]"
          />
        </div>
        {/* `start-2` and not `left-2`: the badge mirrors with the document. */}
        <span className="absolute start-2 top-2">
          <DiscountBadge price={product.price} compareAtPrice={product.compare_at_price} />
        </span>
        <h3 className="line-clamp-2 px-3 pt-3 text-base font-medium leading-snug transition-colors duration-[var(--duration-fast)] group-hover:text-primary">
          {product.name}
        </h3>
      </Link>

      <div className="mt-auto flex flex-col gap-1.5 p-3">
        <Price price={product.price} compareAtPrice={product.compare_at_price} />
        <StockBadge
          trackQuantity={product.track_quantity}
          availableStock={product.available_stock}
          inStock={product.in_stock}
        />
      </div>
    </article>
  )
}

/** Matches the card's real dimensions so nothing shifts when data lands. */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
