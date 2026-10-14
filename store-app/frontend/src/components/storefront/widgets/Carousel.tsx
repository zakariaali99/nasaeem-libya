import { ChevronRight } from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'

import { renditionUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import type { BannerHeight, CarouselSlide, Widget } from '@/types/api'

/** Render one layout regardless of the screen — the builder's phone and
 * desktop previews. Unset on the storefront, where the screen decides. */
export type BannerVariant = 'mobile' | 'desktop'

export interface CarouselProps {
  widget: Widget
  /** The first widget's image is the LCP element and is never lazy. */
  priority?: boolean
  variant?: BannerVariant
}

/**
 * The frame each banner height gives the pictures. The storefront uses the
 * responsive classes; a preview pins one side. The sizes the designer is told
 * to deliver (`lib/bannerSizes.ts`) are these shapes.
 */
const FRAME: Record<Exclude<BannerHeight, 'auto'>, Record<BannerVariant | 'responsive', string>> = {
  band: {
    responsive: 'aspect-[4/5] sm:aspect-[3/1] sm:max-h-[520px]',
    mobile: 'aspect-[4/5]',
    desktop: 'aspect-[3/1]',
  },
  full: {
    // The screen between the sticky header and, below `lg`, the fixed bottom
    // navigation (4rem each); from `lg` only the header (4.5rem).
    responsive: 'h-[calc(100svh-8rem)] min-h-[26rem] lg:h-[calc(100svh-4.5rem)] lg:min-h-[30rem]',
    mobile: 'aspect-[9/16]',
    desktop: 'aspect-[16/9]',
  },
}

/** The phone picture: the server's 1080px copy when it exists, else the
 * picture itself. `spa._hero_preload_tags` preloads the same url. */
export function phoneSrc(slide: Pick<CarouselSlide, 'imageUrl' | 'mobileImageUrl' | 'mobileSrc'>): string {
  return slide.mobileSrc || renditionUrl(slide.mobileImageUrl || slide.imageUrl, 'full')
}

export function Carousel({ widget, priority = false, variant }: CarouselProps) {
  const slides = widget.data.slides ?? []
  const height: BannerHeight = widget.data.bannerHeight ?? 'band'
  const contain = widget.data.imageFit === 'contain' && height !== 'auto'
  // Edge to edge means square corners; inside the page width it is a card.
  const fullBleed = widget.style?.width === 'full'
  const interval = (widget.data.interval ?? 6) * 1000
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const swipeStart = React.useRef<{ x: number; y: number } | null>(null)

  const count = slides.length
  const go = React.useCallback((delta: number) => setIndex((i) => (i + delta + count) % count), [count])

  React.useEffect(() => {
    if (count <= 1 || interval <= 0 || paused) return
    // Auto-advance is off for anyone who asked for reduced motion, and while
    // the tab is hidden.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const timer = window.setInterval(() => {
      if (!document.hidden) go(1)
    }, interval)
    return () => window.clearInterval(timer)
  }, [count, interval, paused, go])

  if (count === 0) return null

  const onPointerDown = (e: React.PointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start || count <= 1) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
    // In a right-to-left page the next slide sits to the left, so it is
    // pulled in by swiping towards the right.
    const rtl = document.documentElement.dir === 'rtl'
    go(dx > 0 === rtl ? 1 : -1)
    setPaused(true)
  }

  const frame = height === 'auto' ? '' : FRAME[height][variant ?? 'responsive']

  return (
    <div
      className={cn('group relative overflow-hidden select-none', !fullBleed && 'rounded-2xl', contain && 'bg-muted')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      style={{ touchAction: 'pan-y' }}
      aria-roledescription="carousel"
    >
      <div className={cn('relative w-full', frame)}>
        {slides.map((slide, slideIndex) => (
          <Slide
            key={`${slide.imageUrl}-${slideIndex}`}
            slide={slide}
            active={slideIndex === index}
            // `auto`: the first picture stays in the flow and gives the frame
            // its height; the rest are laid over it.
            sizer={height === 'auto' && slideIndex === 0}
            eager={priority && slideIndex === 0}
            contain={contain}
            variant={variant}
            label={count > 1 ? `${slideIndex + 1} من ${count}` : undefined}
          />
        ))}
      </div>

      {count > 1 ? (
        <>
          {/* Arrows on a pointer screen only, shown on hover or keyboard
              focus; phones swipe. The chevron is mirrored with the document:
              "previous" points right in RTL. */}
          <ControlButton className="start-3" label="الشريحة السابقة" onClick={() => go(-1)} towardsStart variant={variant} />
          <ControlButton className="end-3" label="الشريحة التالية" onClick={() => go(1)} variant={variant} />
          <div className="absolute inset-x-0 bottom-1 flex justify-center">
            {slides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => {
                  setIndex(dotIndex)
                  setPaused(true)
                }}
                aria-label={`الشريحة ${dotIndex + 1}`}
                aria-current={dotIndex === index}
                className="flex h-9 min-w-7 items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  className={cn(
                    'h-1.5 rounded-full shadow-sm transition-all duration-300',
                    dotIndex === index ? 'w-6 bg-white' : 'w-1.5 bg-white/60',
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

const ALIGN_X = { start: 'items-start text-start', center: 'items-center text-center', end: 'items-end text-end' } as const
const ALIGN_Y = { top: 'justify-start', middle: 'justify-center', bottom: 'justify-end' } as const

function Slide({
  slide,
  active,
  sizer,
  eager,
  contain,
  variant,
  label,
}: {
  slide: CarouselSlide
  active: boolean
  sizer: boolean
  eager: boolean
  contain: boolean
  variant?: BannerVariant
  label?: string
}) {
  const desktopSrc = slide.imageUrl || slide.mobileImageUrl || ''
  const mobileSrc = phoneSrc(slide)
  // The phone picture has its own focus point; without one, the desktop
  // picture keeps the desktop focus on a phone too.
  const desktopFocus = `${slide.focusX ?? 50}% ${slide.focusY ?? 50}%`
  const mobileFocus = slide.mobileImageUrl
    ? `${slide.mobileFocusX ?? 50}% ${slide.mobileFocusY ?? 50}%`
    : desktopFocus
  const focusClass =
    variant === 'mobile'
      ? '[object-position:var(--focus-m)]'
      : variant === 'desktop'
        ? '[object-position:var(--focus-d)]'
        : '[object-position:var(--focus-m)] sm:[object-position:var(--focus-d)]'

  const image = (
    <picture className="block size-full">
      {variant === undefined ? <source media="(max-width: 640px)" srcSet={mobileSrc} /> : null}
      <img
        src={variant === 'mobile' ? mobileSrc : desktopSrc}
        alt={slide.title || ''}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
        draggable={false}
        style={{ '--focus-m': mobileFocus, '--focus-d': desktopFocus } as React.CSSProperties}
        className={cn(
          'block w-full',
          sizer ? 'h-auto max-h-[85dvh] object-cover' : cn('size-full', contain ? 'object-contain' : 'object-cover'),
          focusClass,
        )}
      />
    </picture>
  )

  const hasText = Boolean(slide.title || slide.subtitle || slide.buttonLabel)
  // Words already drawn into the phone picture: the page's own text is hidden there.
  const textClass =
    slide.textOnMobile === false ? (variant === 'mobile' ? 'hidden' : variant === 'desktop' ? '' : 'max-sm:hidden') : ''

  return (
    <div
      className={cn(
        sizer ? 'relative' : 'absolute inset-0',
        'transition-opacity duration-500 ease-out',
        active ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      aria-hidden={active ? undefined : true}
      aria-roledescription={label ? 'slide' : undefined}
      aria-label={label}
    >
      {slide.linkUrl && !slide.buttonLabel ? (
        <Link to={slide.linkUrl} className="block size-full" tabIndex={active ? 0 : -1} draggable={false}>
          {image}
        </Link>
      ) : (
        image
      )}
      {hasText ? <SlideText slide={slide} active={active} className={textClass} variant={variant} /> : null}
    </div>
  )
}

function SlideText({
  slide,
  active,
  className,
  variant,
}: {
  slide: CarouselSlide
  active: boolean
  className?: string
  variant?: BannerVariant
}) {
  const light = slide.textTone !== 'dark'
  const darkness = Math.min(Math.max(slide.overlay ?? 35, 0), 80) / 100
  const align = slide.textAlign ?? 'start'
  const valign = slide.textVAlign ?? 'bottom'
  // The shade runs from the text's side so the rest of the picture stays
  // untouched. On a phone the text sits over the picture's lower part, so the
  // shade rises from the bottom.
  const color = light ? `rgb(0 0 0 / ${darkness})` : `rgb(255 255 255 / ${darkness})`
  const side = align === 'center' ? (valign === 'top' ? 'to bottom' : 'to top') : align === 'start' ? 'to left' : 'to right'
  const shadeDesktop = `linear-gradient(${side}, ${color}, transparent 75%)`
  const shadeMobile = `linear-gradient(${valign === 'top' ? 'to bottom' : 'to top'}, ${color}, transparent 80%)`
  const big = variant === 'mobile' ? 'text-2xl' : variant === 'desktop' ? 'text-5xl' : 'text-2xl sm:text-4xl lg:text-5xl'
  const small = variant === 'mobile' ? 'text-sm' : variant === 'desktop' ? 'text-lg' : 'text-sm sm:text-lg'

  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 flex flex-col p-6 pb-11',
        variant === undefined && 'sm:p-12',
        variant === 'desktop' && 'p-12',
        ALIGN_X[align],
        ALIGN_Y[valign],
        light ? 'text-white' : 'text-neutral-950',
        className,
      )}
    >
      <span
        className={cn('absolute inset-0', variant === undefined && 'sm:hidden', variant === 'desktop' && 'hidden')}
        style={{ backgroundImage: shadeMobile }}
        aria-hidden="true"
      />
      <span
        className={cn('absolute inset-0', variant === undefined && 'max-sm:hidden', variant === 'mobile' && 'hidden')}
        style={{ backgroundImage: shadeDesktop }}
        aria-hidden="true"
      />
      <div className={cn('relative flex max-w-xl flex-col gap-3', ALIGN_X[align])}>
        {slide.title ? <p className={cn('font-black leading-tight drop-shadow-sm', big)}>{slide.title}</p> : null}
        {slide.subtitle ? <p className={cn('leading-relaxed opacity-90', small)}>{slide.subtitle}</p> : null}
        {slide.buttonLabel && slide.linkUrl ? (
          <Link
            to={slide.linkUrl}
            tabIndex={active ? 0 : -1}
            className={cn(
              'pointer-events-auto mt-1 inline-flex h-11 items-center rounded-full px-6 text-sm font-bold transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              light ? 'bg-white text-neutral-950 hover:bg-white/90' : 'bg-neutral-950 text-white hover:bg-neutral-800',
            )}
          >
            {slide.buttonLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function ControlButton({
  className,
  label,
  onClick,
  towardsStart = false,
  variant,
}: {
  className: string
  label: string
  onClick: () => void
  towardsStart?: boolean
  variant?: BannerVariant
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 inline-flex size-11 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm',
        'opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        variant === 'mobile' ? 'hidden' : variant === 'desktop' ? '' : 'max-sm:hidden',
        className,
      )}
    >
      <ChevronRight className={cn('size-5 rtl:-scale-x-100', towardsStart && 'rotate-180')} aria-hidden="true" />
    </button>
  )
}
