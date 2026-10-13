import { ArrowLeft, ShoppingBag, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { renditionUrl } from '@/lib/images'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

const ALIGN = {
  start: 'items-start text-start',
  center: 'items-center text-center',
  end: 'items-end text-end',
} as const

/**
 * The main banner, in one of two modes the operator picks:
 *
 * - `image`: the picture exactly as it was designed — full width, its own
 *   proportions, no darkening and no text on top. Optionally a link.
 * - `text`: a title block over an optional background picture, darkened by
 *   the `overlay` percentage the operator chose.
 *
 * Every piece of text is the operator's. An empty field shows nothing: this
 * component used to fill blanks with built-in slogans, a fixed second button
 * and three fixed "trust" lines nobody had approved.
 */
export function HeroCta({ widget, priority = false }: { widget: Widget; priority?: boolean }) {
  const {
    heroMode,
    title,
    subtitle,
    badgeText,
    buttonLabel,
    buttonUrl,
    secondaryLabel,
    secondaryUrl,
    alignment,
    overlay,
    linkUrl,
    backgroundImageUrl,
    desktopImageUrl = backgroundImageUrl,
    mobileImageUrl,
  } = widget.data

  const desktop = desktopImageUrl || mobileImageUrl
  // Edge to edge has square corners; inside the page width it is a card.
  const rounded = widget.style?.width === 'full' ? '' : 'rounded-3xl'
  const hasImage = Boolean(desktop)

  // One URL per breakpoint, matching the preload tags the server emits
  // (spa._hero_preload_tags), so a phone never downloads the desktop file.
  const picture = (className: string, style?: React.CSSProperties) => (
    <picture>
      <source media="(max-width: 640px)" srcSet={renditionUrl(String(mobileImageUrl || desktop), 'full')} />
      <img
        src={String(desktop)}
        alt={title || ''}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : undefined}
        decoding="async"
        className={className}
        style={style}
      />
    </picture>
  )

  if (heroMode === 'image') {
    if (!hasImage) return null
    const image = picture(cn('block h-auto w-full', rounded))
    return linkUrl ? (
      <Link to={linkUrl} className={cn('block focus-visible:outline-2 focus-visible:outline-ring', rounded)}>
        {image}
      </Link>
    ) : (
      image
    )
  }

  const hasText = Boolean(title || subtitle || badgeText || buttonLabel || secondaryLabel)
  if (!hasText && !hasImage) return null

  // `overlay` is how dark the picture gets, 0 (untouched) to 90.
  const darkness = Math.min(Math.max(Number(overlay ?? 45), 0), 90) / 100

  return (
    <div className={cn('relative overflow-hidden bg-slate-950 text-white animate-fade-rise', rounded && `${rounded} shadow-xl`)}>
      {hasImage ? (
        <>
          <div className="absolute inset-0">{picture('size-full object-cover')}</div>
          <div className="absolute inset-0 bg-slate-950" style={{ opacity: darkness }} aria-hidden="true" />
        </>
      ) : null}

      <div
        className={cn(
          'relative z-10 mx-auto flex min-h-64 max-w-4xl flex-col justify-center gap-6 px-6 py-12 sm:min-h-80 sm:px-12 sm:py-16',
          ALIGN[alignment ?? 'center'],
        )}
      >
        {badgeText ? (
          <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 backdrop-blur-md">
            <Sparkles className="size-3.5" />
            <span className="text-xs font-bold tracking-wide">{badgeText}</span>
          </div>
        ) : null}

        {title || subtitle ? (
          <div className="space-y-3">
            {title ? (
              <h2 className="text-3xl font-black leading-tight tracking-tight drop-shadow-sm sm:text-5xl lg:text-6xl">
                {title}
              </h2>
            ) : null}
            {subtitle ? (
              <p className="max-w-2xl text-sm leading-relaxed text-white/85 sm:text-lg">{subtitle}</p>
            ) : null}
          </div>
        ) : null}

        {buttonLabel || secondaryLabel ? (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {buttonLabel ? (
              <Button
                asChild
                size="lg"
                className="h-12 gap-2 rounded-2xl px-8 text-sm font-extrabold shadow-lg sm:text-base"
              >
                <Link to={buttonUrl || '/products'}>
                  <ShoppingBag className="size-5" />
                  <span>{buttonLabel}</span>
                </Link>
              </Button>
            ) : null}
            {secondaryLabel ? (
              <Link
                to={secondaryUrl || '/products'}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-6 text-sm font-bold backdrop-blur-sm transition-all hover:bg-white/20"
              >
                <span>{secondaryLabel}</span>
                <ArrowLeft className="size-4" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
