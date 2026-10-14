import { Link } from 'react-router-dom'

import { BannerPicture, type BannerVariant } from '@/components/storefront/widgets/Carousel'
import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { CarouselSlide, Widget } from '@/types/api'

/**
 * Offer banners between the product rows, in one of three shapes the
 * operator picks — each picture with a desktop and a phone version:
 *
 * - `strip`: thin offers across the page (6:1 desktop, 3:1 phone).
 * - `grid`: two or three 4:5 pictures side by side; a swipeable row on phones.
 * - `editorial`: one 4:5 picture beside a title, text and a button.
 */
export function PromoBanners({ widget, variant }: { widget: Widget; variant?: BannerVariant }) {
  const items = (widget.data.items ?? []) as unknown as CarouselSlide[]
  const shape = widget.data.shape ?? 'strip'
  const fullBleed = widget.style?.width === 'full'
  if (items.length === 0) return null

  const pick = (mobile: string, desktop: string, responsive: string) =>
    variant === 'mobile' ? mobile : variant === 'desktop' ? desktop : responsive

  if (shape === 'editorial') {
    const item = items[0]!
    return (
      <div
        className={cn(
          'grid items-center gap-6',
          pick('grid-cols-1', 'grid-cols-2 gap-12', 'sm:grid-cols-2 sm:gap-12'),
        )}
      >
        <Tile
          item={item}
          className={cn('aspect-[4/5]', widget.data.imageSide === 'end' && pick('', 'order-last', 'sm:order-last'))}
          rounded={!fullBleed}
          variant={variant}
        />
        <div className="space-y-4 px-4">
          {widget.data.title ? <h2 className="text-2xl font-black leading-tight sm:text-4xl">{widget.data.title}</h2> : null}
          {widget.data.content ? (
            <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{widget.data.content}</p>
          ) : null}
          {widget.data.buttonLabel ? (
            <Link
              to={widget.data.buttonUrl || '/products'}
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {widget.data.buttonLabel}
            </Link>
          ) : null}
        </div>
      </div>
    )
  }

  if (shape === 'grid') {
    return (
      <div className="space-y-4">
        <WidgetHeading title={widget.data.title} />
        <ul
          className={cn(
            pick(
              'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 no-scrollbar',
              cn('grid gap-4', items.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'),
              cn(
                'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 no-scrollbar sm:grid sm:gap-4 sm:overflow-visible',
                items.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
              ),
            ),
          )}
        >
          {items.slice(0, 3).map((item, i) => (
            <li key={`${item.imageUrl}-${i}`} className={pick('w-[80%] shrink-0 snap-start', '', 'w-[80%] shrink-0 snap-start sm:w-auto')}>
              <Tile item={item} className="aspect-[4/5]" rounded={!fullBleed || items.length > 1} variant={variant} />
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <WidgetHeading title={widget.data.title} />
      {items.map((item, i) => (
        <Tile
          key={`${item.imageUrl}-${i}`}
          item={item}
          className={pick('aspect-[3/1]', 'aspect-[6/1]', 'aspect-[3/1] sm:aspect-[6/1]')}
          rounded={!fullBleed}
          variant={variant}
        />
      ))}
    </div>
  )
}

/** One picture, linked when it has a link, with its optional name over it. */
function Tile({
  item,
  className,
  rounded,
  variant,
}: {
  item: CarouselSlide
  className?: string
  rounded: boolean
  variant?: BannerVariant
}) {
  const body = (
    <div className={cn('relative overflow-hidden bg-muted', rounded && 'rounded-2xl', className)}>
      <BannerPicture slide={item} variant={variant} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
      {item.title ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10 text-white">
          <p className="text-lg font-black leading-tight">{item.title}</p>
          {item.subtitle ? <p className="text-sm opacity-90">{item.subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  )
  return item.linkUrl ? (
    <Link to={item.linkUrl} className="group block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" draggable={false}>
      {body}
    </Link>
  ) : (
    body
  )
}
