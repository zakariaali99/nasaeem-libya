import { Link } from 'react-router-dom'

import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

/** A paragraph of operator-authored copy. Plain text by design: the widget
 * builder offers no rich-text field, so nothing here is `dangerouslySetInnerHTML`. */
export function TextBlock({ widget }: { widget: Widget }) {
  const content = widget.data.content
  if (!content) return null
  return (
    <div className="mx-auto max-w-3xl text-center text-base leading-loose text-foreground">
      {content.split('\n').map((line, index) => (
        <p key={index}>{line}</p>
      ))}
    </div>
  )
}

export function ImageWidget({ widget, priority = false }: { widget: Widget; priority?: boolean }) {
  const { imageUrl, altText, linkUrl } = widget.data
  if (!imageUrl) return null

  const image = (
    <img
      src={imageUrl}
      alt={altText || ''}
      width={1200}
      height={675}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      className="mx-auto max-h-80 w-full rounded-lg object-contain"
    />
  )

  return linkUrl ? (
    <Link
      to={linkUrl}
      className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {image}
    </Link>
  ) : (
    image
  )
}

const HEIGHTS = { sm: 'h-4', md: 'h-8', lg: 'h-16', xl: 'h-32', '2xl': 'h-64' } as const

export function Spacer({ widget }: { widget: Widget }) {
  return <div className={cn('w-full', HEIGHTS[widget.data.height ?? 'md'])} aria-hidden="true" />
}

export function PhotoLinkGrid({ widget }: { widget: Widget }) {
  const items = widget.data.items ?? []
  if (items.length === 0) return null

  return (
    <div>
      <WidgetHeading title={widget.data.title} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <li key={`${item.imageUrl}-${index}`}>
            <Link
              to={item.linkUrl || '#'}
              className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-3 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <img
                src={item.imageUrl}
                alt={item.label || ''}
                width={300}
                height={225}
                loading="lazy"
                className="aspect-[4/3] w-full object-contain"
              />
              {item.label ? (
                <span className="line-clamp-1 text-sm font-medium">{item.label}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
