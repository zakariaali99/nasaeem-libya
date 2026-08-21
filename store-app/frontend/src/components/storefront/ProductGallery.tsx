import { ImageOff, ZoomIn } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { ProductImage as ProductImageType } from '@/types/api'

export interface ProductGalleryProps {
  images: ProductImageType[]
  productName: string
}

/**
 * One horizontally snapping track, driven three ways: a **swipe** on mobile, a
 * thumbnail click on desktop, and the arrow keys. They share one `selected`
 * index, so the dots, the thumbnails and the zoom always agree with what is on
 * screen — there is no second source of truth to drift.
 *
 * The track is a fixed square. The image is the LCP element on this page, and
 * an unsized one blows the 0.05 CLS budget on its own, so the frame reserves
 * its space before anything loads.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [selected, setSelected] = useState(0)
  const trackRef = useRef<HTMLUListElement>(null)
  /* A programmatic scroll must not fight the scroll listener that reads it. */
  const scrollingTo = useRef<number | null>(null)

  const scrollTo = useCallback((index: number) => {
    const track = trackRef.current
    const slide = track?.children[index] as HTMLElement | undefined
    if (!track || !slide) return
    scrollingTo.current = index
    setSelected(index)
    /*
     * Measured from the rendered boxes, not from `offsetLeft`. Under RTL a
     * later slide has a SMALLER offsetLeft and the container's scrollLeft runs
     * negative, so `slide.offsetLeft - track.offsetLeft` clamped to 0 and the
     * track never moved — the thumbnail highlighted while the image stayed put.
     * A signed delta added to the current position is correct in both
     * directions.
     */
    const delta = slide.getBoundingClientRect().left - track.getBoundingClientRect().left
    // A smooth scroll is an animation, and `07-design-system.md` requires
    // prefers-reduced-motion to be respected by every one of them.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    track.scrollTo({ left: track.scrollLeft + delta, behavior: reduced ? 'auto' : 'smooth' })
  }, [])

  /* Reading the index from scroll position is what makes the swipe real: the
     finger moves the track, and everything else follows the track. */
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1
        // Math.abs: in RTL the track's scrollLeft runs negative.
        const index = Math.round(Math.abs(track.scrollLeft) / width)
        if (scrollingTo.current !== null && scrollingTo.current !== index) return
        scrollingTo.current = null
        setSelected((current) => (current === index ? current : index))
      })
    }
    track.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      track.removeEventListener('scroll', onScroll)
    }
  }, [images.length])

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <ImageOff className="size-12" aria-hidden="true" />
        <span className="sr-only">لا توجد صور لهذا المنتج</span>
      </div>
    )
  }

  const current = images[selected] ?? images[0]
  const alt = current?.alt_text || productName

  return (
    <div className="space-y-3">
      <Dialog>
        <div className="relative">
          <ul
            ref={trackRef}
            className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            /* A listbox of images: arrow keys move it, and the label names it. */
            role="listbox"
            aria-label={`صور ${productName}`}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                // In RTL, ArrowLeft advances. Read the resolved direction rather
                // than assuming one — the same code must work under dir="ltr".
                const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
                const forward = rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight'
                scrollTo(Math.min(Math.max(selected + (forward ? 1 : -1), 0), images.length - 1))
              }
            }}
          >
            {images.map((image, index) => {
              const srcSet = [
                image.renditions?.medium && `${image.renditions.medium} 600w`,
                image.renditions?.full && `${image.renditions.full} 1200w`,
              ]
                .filter(Boolean)
                .join(', ')

              return (
                <li
                  key={image.id}
                  className="w-full shrink-0 snap-center"
                  role="option"
                  aria-selected={index === selected}
                  aria-label={`${image.alt_text || productName} — ${index + 1} من ${images.length}`}
                >
                  <img
                    src={image.renditions?.medium || image.url}
                    srcSet={srcSet || undefined}
                    sizes="(max-width: 1024px) 100vw, 600px"
                    alt={index === 0 ? alt : ''}
                    width={600}
                    height={600}
                    /* Only the first image is the LCP candidate; the rest are
                       off-screen until swiped to. */
                    loading={index === 0 ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 ? 'high' : undefined}
                    decoding={index === 0 ? 'sync' : 'async'}
                    className="aspect-square w-full bg-muted object-cover"
                  />
                </li>
              )
            })}
          </ul>

          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="تكبير الصورة"
              className="absolute end-3 bottom-3 inline-flex size-11 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ZoomIn className="size-5" aria-hidden="true" />
            </button>
          </DialogTrigger>

          {images.length > 1 ? (
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1 lg:hidden">
              {images.map((image, index) => (
                <span
                  key={image.id}
                  aria-hidden="true"
                  className={cn(
                    'size-2 rounded-full transition-colors duration-200',
                    index === selected ? 'bg-primary' : 'bg-background/70',
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>

        <DialogContent className="max-w-3xl">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <img
            src={current?.renditions?.full || current?.url}
            alt={alt}
            className="max-h-[70dvh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>

      {images.length > 1 ? (
        <ul className="hidden gap-2 overflow-x-auto pb-1 lg:flex">
          {images.map((image, index) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => scrollTo(index)}
                aria-label={`عرض الصورة ${index + 1}`}
                aria-current={index === selected}
                className={cn(
                  'block size-16 shrink-0 overflow-hidden rounded-md border-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  index === selected ? 'border-primary' : 'border-border',
                )}
              >
                <img
                  src={image.renditions?.thumb || image.url}
                  alt=""
                  width={64}
                  height={64}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
