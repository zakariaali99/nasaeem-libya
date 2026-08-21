import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

const ICONS = { error: AlertCircle, success: CheckCircle2, info: Info } as const

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: keyof typeof ICONS
}

export function Alert({ tone = 'info', className, children, ...props }: AlertProps) {
  const Icon = ICONS[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border p-4 text-sm',
        tone === 'error' && 'border-destructive/40 bg-destructive/10 text-destructive',
        tone === 'success' && 'border-success/40 bg-success/10 text-success',
        tone === 'info' && 'border-border bg-muted text-muted-foreground',
        className,
      )}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
