import { cn } from '@/lib/utils'

export interface ResponsiveImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  sizes?: string
  renditions?: {
    thumb?: string
    card?: string
    medium?: string
    full?: string
    hero?: string
  }
}

export function ResponsiveImage({
  src,
  alt,
  width = 600,
  height = 600,
  className,
  priority = false,
  sizes,
  renditions,
}: ResponsiveImageProps) {
  if (!src) return null

  const thumb = renditions?.thumb
  const card = renditions?.card || renditions?.medium
  const full = renditions?.full
  const hero = renditions?.hero

  const srcSet = [
    thumb && `${thumb} 200w`,
    card && `${card} 600w`,
    full && `${full} 1200w`,
    hero && `${hero} 1920w`,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <img
      src={src}
      srcSet={srcSet || undefined}
      sizes={srcSet && sizes ? sizes : undefined}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn('w-full object-cover', className)}
    />
  )
}
