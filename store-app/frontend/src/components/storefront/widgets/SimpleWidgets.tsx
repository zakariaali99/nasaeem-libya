import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

/** Text Block with refined typography */
export function TextBlock({ widget }: { widget: Widget }) {
  const content = widget.data.content
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

  const image = (
    <img
      src={imageUrl}
      alt={altText || ''}
      width={1200}
      height={675}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : undefined}
      className="mx-auto max-h-96 w-full rounded-3xl object-contain shadow-sm border border-border"
    />
  )

  return linkUrl ? (
    <Link
      to={linkUrl}
      className="block focus-visible:outline-2 focus-visible:outline-ring rounded-3xl overflow-hidden"
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

  return (
    <div className="space-y-4">
      <WidgetHeading
        title={widget.data.title || 'اكتشف المزيد من العلامات الفاخرة'}
        action={
          <Link
            to="/products"
            className="inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-primary hover:gap-1.5 transition-all"
          >
            <span>عرض الكل</span>
            <ArrowLeft className="size-4 rtl:rotate-0" />
          </Link>
        }
      />
      <ul className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item, index) => (
          <li key={`${item.imageUrl}-${index}`}>
            <Link
              to={item.linkUrl || '#'}
              className="card-hover group flex flex-col items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card p-4 text-center hover:border-primary/50 hover:shadow-md transition-all shadow-2xs"
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted/30 p-3 group-hover:scale-105 transition-transform">
                <img
                  src={item.imageUrl}
                  alt={item.label || ''}
                  width={300}
                  height={225}
                  loading="lazy"
                  className="size-full object-contain"
                />
              </div>
              {item.label ? (
                <span className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                  {item.label}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
