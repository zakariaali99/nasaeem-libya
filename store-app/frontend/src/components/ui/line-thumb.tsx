import { Package } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ProductImage } from '@/types/api'

interface LineThumbProps {
  image: ProductImage | null | undefined
  alt?: string
  /** Rendered size in px; the `thumb` rendition (200px) covers up to ~100px at 2x. */
  size?: number
  className?: string
}

/**
 * The small product picture beside a cart, checkout or order line.
 *
 * Always the `thumb` rendition (a few KB) rather than the full image, lazy and
 * async-decoded so a long order list never blocks the page; a neutral box when
 * the product has no picture.
 */
export function LineThumb({ image, alt = '', size = 56, className }: LineThumbProps) {
  const src = image?.renditions?.thumb || image?.url
  const box = cn(
    'shrink-0 rounded-xl border border-border bg-white dark:bg-card/40',
    className,
  )
  if (!src) {
    return (
      <span
        className={cn(box, 'flex items-center justify-center text-muted-foreground')}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <Package className="size-1/2" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn(box, 'object-contain p-1')}
      style={{ width: size, height: size }}
    />
  )
}
