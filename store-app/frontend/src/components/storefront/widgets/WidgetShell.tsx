import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import type { WidgetStyle } from '@/types/api'

const PADDING_Y = { none: '', sm: 'py-4', md: 'py-6', lg: 'py-10' } as const
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
        'w-full',
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

/** The heading every titled widget shares, so they cannot drift apart. */
export function WidgetHeading({ title, action }: { title?: string; action?: ReactNode }) {
  if (!title) return null
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <h2 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h2>
      {action}
    </div>
  )
}
