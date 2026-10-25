import { Link } from '@/lib/i18nRouter'

import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

/** Text Block with refined typography */
export function TextBlock({ widget }: { widget: Widget }) {
  const content = (widget.data.content ?? '').trim()
  if (!content) return null
  return (
    <div className="mx-auto max-w-3xl rounded-3xl border border-border/70 bg-card/60 p-6 sm:p-8 text-center shadow-xs">
      <div className="text-sm sm:text-base leading-loose text-foreground/90 font-medium">
        {content.split('\n').map((line, index) => (
          <p key={index} className="mb-2 last:mb-0">{line}</p>
        ))}
      </div>
    </div>
  )
}

export function ImageWidget({ widget, priority = false }: { widget: Widget; priority?: boolean }) {
  const { imageUrl, altText, linkUrl } = widget.data
  if (!imageUrl) return null

  // The picture as the operator made it: full width, its own proportions, no
  // frame, no padding and no cropping. Edge to edge has square corners.
  const rounded = widget.style?.width === 'full' ? '' : 'rounded-3xl'
  const image = (
    <img
      src={imageUrl}
      alt={altText || ''}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      decoding="async"
      className={cn('block h-auto w-full', rounded)}
    />
  )

  return linkUrl ? (
    <Link
      to={linkUrl}
      className={cn('block overflow-hidden focus-visible:outline-2 focus-visible:outline-ring', rounded)}
    >
      {image}
    </Link>
  ) : (
    image
  )
}

const HEIGHTS = { sm: 'h-4', md: 'h-8', lg: 'h-14', xl: 'h-24', '2xl': 'h-36' } as const

export function Spacer({ widget }: { widget: Widget }) {
  return <div className={cn('w-full', HEIGHTS[widget.data.height ?? 'md'])} aria-hidden="true" />
}

export function PhotoLinkGrid({ widget }: { widget: Widget }) {
  const items = widget.data.items ?? []
  if (items.length === 0) return null
  const slider = widget.data.layout === 'slider'

  return (
    <div className="space-y-4">
      <WidgetHeading title={widget.data.title} actionLabel={widget.data.actionLabel} actionUrl={widget.data.actionUrl} />
      <ul
        className={cn(
          slider
            ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar'
            : 'grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4',
        )}
      >
        {items.map((item, index) => (
          <li key={`${item.imageUrl}-${index}`} className={cn(slider && 'w-36 shrink-0 snap-start sm:w-44')}>
            {widget.data.tileStyle === 'image' ? (
              // The picture fills the tile and the name sits over it: for
              // category and brand pictures, not logos on white.
              <Link
                to={item.linkUrl || '/products'}
                className="group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <img
                  src={item.imageUrl}
                  alt={item.label || ''}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {item.label ? (
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent p-3 pt-10 text-sm font-bold text-white">
                    {item.label}
                  </span>
                ) : null}
              </Link>
            ) : (
            <Link
              to={item.linkUrl || '/products'}
              className="card-hover group flex flex-col items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 text-center hover:border-primary/50 hover:shadow-md transition-all shadow-2xs"
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted/30 p-3 group-hover:scale-105 transition-transform">
                <img
                  src={item.imageUrl}
                  alt={item.label || ''}
                  width={300}
                  height={225}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-contain"
                />
              </div>
              {item.label ? (
                <span className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              ) : null}
            </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
