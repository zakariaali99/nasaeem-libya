import { ImageOff } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ProductImage as ProductImageType } from '@/types/api'

export interface ProductImageProps {
  image?: ProductImageType
  alt: string
  /** The LCP image on a page gets `high`; everything else lazy-loads. */
  priority?: boolean
  sizes?: string
  className?: string
}

/**
 * Every image carries explicit `width`/`height` and sits in a fixed aspect
 * ratio, because CLS is budgeted at ≤ 0.05 and an unsized image blows it on
 * its own. `srcset` is built from the thumb/medium/full renditions so a phone
 * on Libyan mobile data never downloads a 1200 px file to fill a 160 px card.
 */
export function ProductImage({
  image,
  alt,
  priority = false,
  sizes = '(max-width: 640px) 50vw, 25vw',
  className,
}: ProductImageProps) {
  if (!image?.url) {
    return (
      <div
        className={cn(
          'flex aspect-square w-full items-center justify-center bg-muted text-muted-foreground',
          className,
        )}
      >
        <ImageOff className="size-10" aria-hidden="true" />
        <span className="sr-only">لا توجد صورة لهذا المنتج</span>
      </div>
    )
  }

  const { thumb, medium, full } = image.renditions ?? {}
  const srcSet = [
    thumb && `${thumb} 200w`,
    medium && `${medium} 600w`,
    full && `${full} 1200w`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <img
      src={medium || image.url}
      srcSet={srcSet || undefined}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      width={600}
      height={600}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding={priority ? 'sync' : 'async'}
      className={cn('aspect-square w-full object-contain', className)}
    />
  )
}
