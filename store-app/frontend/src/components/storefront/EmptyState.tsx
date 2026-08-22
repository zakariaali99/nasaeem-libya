import { PackageOpen } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
  className?: string
}

/**
 * Every empty state is designed. The reference rendered the bare string
 * "لا توجد عناصر لعرضها حالياً" on an unstyled page when the homepage layout was
 * empty — on the most important screen in the store, with no way forward.
 *
 * The default visual is an authored little scene — a flacon on a plinth with
 * the نَسائم breezes drifting past — drawn entirely from theme tokens so it
 * holds up in both themes. A caller may still override with `icon`.
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-5 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-14 text-center',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : (
        <FlaconScene />
      )}
      <div className="space-y-1">
        <p className="font-display text-lg font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}

/** Bottle + breezes, all `currentColor` — inherits its palette from context. */
function FlaconScene() {
  return (
    <svg
      viewBox="0 0 140 104"
      className="size-32 text-primary"
      role="presentation"
      aria-hidden="true"
    >
      {/* plinth shadow */}
      <ellipse cx="70" cy="92" rx="38" ry="5" className="fill-current opacity-10" />
      {/* bottle body */}
      <rect
        x="52"
        y="42"
        width="36"
        height="48"
        rx="7"
        className="fill-current opacity-15"
      />
      <rect
        x="52"
        y="42"
        width="36"
        height="48"
        rx="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      {/* neck + cap */}
      <rect x="64" y="32" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <rect x="61" y="22" width="18" height="9" rx="2.5" className="fill-current" />
      {/* liquid line */}
      <path d="M56 66 h28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="opacity-50" />
      {/* breezes — the نسائم themselves */}
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        className="text-muted-foreground opacity-60"
        strokeWidth="2.5"
        strokeDasharray="1 7"
      >
        <path d="M20 58 q10 -8 20 0 t20 0" />
        <path d="M82 50 q10 -8 20 0 t14 0" />
        <path d="M28 74 q8 -6 16 0" className="opacity-70" />
      </g>
      {/* sparkles */}
      <g className="fill-current opacity-45">
        <path d="M108 30 l2.2 5 5 2.2 -5 2.2 -2.2 5 -2.2 -5 -5 -2.2 5 -2.2 z" />
        <circle cx="30" cy="34" r="2.4" />
      </g>
    </svg>
  )
}

/** Kept for callers that want the plain icon treatment. */
export function EmptyStateIcon({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
      {children ?? <PackageOpen className="size-8" aria-hidden="true" />}
    </span>
  )
}

export { PackageOpen }
