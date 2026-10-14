import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { cn } from '@/lib/utils'
import type { WidgetStyle } from '@/types/api'

// One rhythm for the whole page: the default leaves 32px between sections on a
// phone and 64px on a computer (each section adds half above and half below).
const PADDING_Y = { none: '', sm: 'py-2 sm:py-4', md: 'py-4 sm:py-8', lg: 'py-8 sm:py-14' } as const
const PADDING_X = { none: '', sm: 'px-4', md: 'px-6', lg: 'px-8' } as const
const RADIUS = { none: '', md: 'rounded-md', lg: 'rounded-2xl' } as const

/**
 * Per-widget presentation, applied in one place.
 *
 * The operator's colour choices arrive as data and are applied as inline
 * styles — that is not a hardcoded colour in a component, it is a value from
 * the database. Everything else is a token class.
 *
 * The reference's equivalent shell carried eleven overlapping padding props
 * (padding, paddingX, paddingY, paddingLeft, paddingRight…) whose interaction
 * its own author documented as unresolved in a comment. This one has four
 * knobs and no ambiguity.
 */
export function WidgetShell({
  style,
  type,
  children,
}: {
  style?: WidgetStyle | null
  /** Exposed in the DOM so "all 14 types render" is checkable in a browser
   * rather than inferred from the registry having 14 entries. */
  type?: string
  children: ReactNode
}) {
  const s = style ?? {}
  const contained = s.width !== 'full'

  return (
    <section
      data-widget-type={type}
      className={cn(
        // A widget with nothing to show renders nothing; without this its
        // padding still left an empty band on the page.
        'w-full has-[>div:empty]:hidden',
        PADDING_Y[s.paddingY ?? 'md'],
        PADDING_X[s.paddingX ?? 'none'],
        RADIUS[s.borderRadius ?? 'none'],
      )}
      style={{
        backgroundColor: s.backgroundColor || undefined,
        color: s.textColor || undefined,
      }}
    >
      <div className={cn(contained ? 'mx-auto w-full max-w-6xl px-4' : 'w-full')}>{children}</div>
    </section>
  )
}

/** The heading every titled widget shares, so they cannot drift apart.
 *
 * Both the title and the "see all" link are the operator's words: a widget
 * with neither has no heading row at all. The title carries no colour class,
 * so the widget's own text colour (set in the builder) reaches it. */
export function WidgetHeading({
  title,
  actionLabel,
  actionUrl,
}: {
  title?: string
  actionLabel?: string
  actionUrl?: string
}) {
  if (!title && !actionLabel) return null
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      {title ? <h2 className="text-xl font-bold sm:text-2xl">{title}</h2> : <span />}
      {actionLabel ? (
        <Link
          to={actionUrl || '/products'}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 px-2 text-xs font-bold text-primary transition-all hover:gap-1.5 sm:text-sm"
        >
          <span>{actionLabel}</span>
          <ArrowLeft className="size-4" />
        </Link>
      ) : null}
    </div>
  )
}
