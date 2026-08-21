import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

const ALIGN = {
  start: 'items-start text-start',
  center: 'items-center text-center',
  end: 'items-end text-end',
} as const

export function HeroCta({ widget, priority = false }: { widget: Widget; priority?: boolean }) {
  const { title, subtitle, buttonLabel, buttonUrl, alignment, backgroundImageUrl } = widget.data
  if (!title && !subtitle && !buttonLabel) return null

  const hasImage = Boolean(backgroundImageUrl)

  return (
    <div className="relative overflow-hidden rounded-2xl bg-secondary text-secondary-foreground">
      {hasImage ? (
        <>
          {/* A real <img> rather than a CSS background: a background image is
              invisible to the preload scanner, and this is often the LCP. */}
          <img
            src={backgroundImageUrl}
            alt=""
            width={1200}
            height={500}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : undefined}
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-foreground/50" aria-hidden="true" />
        </>
      ) : null}

      <div
        className={cn(
          'relative flex flex-col gap-4 px-6 py-14 sm:px-10 sm:py-20',
          ALIGN[alignment ?? 'center'],
          hasImage && 'text-background',
        )}
      >
        {title ? <h2 className="text-3xl font-bold leading-tight sm:text-4xl">{title}</h2> : null}
        {subtitle ? <p className="max-w-2xl text-lg leading-relaxed">{subtitle}</p> : null}
        {buttonLabel ? (
          buttonUrl ? (
            <Button asChild size="lg">
              <Link to={buttonUrl}>{buttonLabel}</Link>
            </Button>
          ) : (
            <Button size="lg" disabled>
              {buttonLabel}
            </Button>
          )
        ) : null}
      </div>
    </div>
  )
}
