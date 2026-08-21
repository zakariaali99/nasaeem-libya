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
 */
export function EmptyState({ title, description, icon, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-14 text-center',
        className,
      )}
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <PackageOpen className="size-8" aria-hidden="true" />}
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  )
}
