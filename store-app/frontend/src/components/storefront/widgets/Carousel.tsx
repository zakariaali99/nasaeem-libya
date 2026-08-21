import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

export interface CarouselProps {
  widget: Widget
  /** The first widget's image is the LCP element and is never lazy. */
  priority?: boolean
}

export function Carousel({ widget, priority = false }: CarouselProps) {
  const slides = widget.data.slides ?? []
  const hero = widget.data.carouselStyle !== 'normal'
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length <= 1) return
    // Auto-advance is paused for anyone who asked for reduced motion — a
    // carousel that moves on its own is motion, not decoration.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000)
    return () => window.clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) return null

  const go = (delta: number) => setIndex((i) => (i + delta + slides.length) % slides.length)

  return (
    <div className="relative overflow-hidden rounded-lg bg-muted">
      <div className={cn('relative w-full', hero ? 'aspect-[16/9] sm:aspect-[21/9]' : 'aspect-[16/9]')}>
        {slides.map((slide, slideIndex) => {
          const content = (
            <>
              <img
                src={slide.imageUrl}
                alt={slide.title || ''}
                width={1200}
                height={675}
                loading={priority && slideIndex === 0 ? 'eager' : 'lazy'}
                fetchPriority={priority && slideIndex === 0 ? 'high' : undefined}
                className="size-full object-contain"
              />
              {slide.title || slide.subtitle ? (
                <div className="absolute inset-x-0 bottom-0 bg-foreground/60 p-4 text-background">
                  {slide.title ? <p className="text-lg font-bold">{slide.title}</p> : null}
                  {slide.subtitle ? <p className="text-sm">{slide.subtitle}</p> : null}
                </div>
              ) : null}
            </>
          )

          return (
            <div
              key={`${slide.imageUrl}-${slideIndex}`}
              className={cn(
                'absolute inset-0 transition-opacity duration-300 ease-out',
                slideIndex === index ? 'opacity-100' : 'pointer-events-none opacity-0',
              )}
              aria-hidden={slideIndex === index ? undefined : true}
            >
              {slide.linkUrl ? (
                <Link to={slide.linkUrl} className="block size-full">
                  {content}
                </Link>
              ) : (
                content
              )}
            </div>
          )
        })}
      </div>

      {slides.length > 1 ? (
        <>
          {/* `start-2`/`end-2` place the buttons, and the glyph is mirrored with
              the document: a chevron meaning "previous" points left in LTR and
              right in RTL, so the icon carries `rtl:-scale-x-100` in both. */}
          <ControlButton className="start-2" label="الشريحة السابقة" onClick={() => go(-1)} towardsStart />
          <ControlButton className="end-2" label="الشريحة التالية" onClick={() => go(1)} />
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
            {slides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`الشريحة ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                className="flex size-11 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className={cn(
                    'size-2 rounded-full transition-colors duration-200',
                    dotIndex === index ? 'bg-primary' : 'bg-background/70',
                  )}
                />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function ControlButton({
  className,
  label,
  onClick,
  towardsStart = false,
}: {
  className: string
  label: string
  onClick: () => void
  towardsStart?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 inline-flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      <ChevronRight
        className={cn('size-5 rtl:-scale-x-100', towardsStart && 'rotate-180')}
        aria-hidden="true"
      />
    </button>
  )
}
