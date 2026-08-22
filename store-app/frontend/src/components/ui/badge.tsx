import { type VariantProps, cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground border border-border/50',
        primary: 'bg-primary/10 text-primary border border-primary/20',
        success: 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 ring-1 ring-emerald-700/10 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
        warning: 'bg-amber-50 text-amber-900 border border-amber-200 ring-1 ring-amber-700/10 dark:bg-amber-950/60 dark:text-amber-300',
        danger: 'bg-destructive/10 text-destructive border border-destructive/20',
        discount: 'bg-emerald-600 text-white shadow-xs font-bold',
        gold: 'bg-gradient-to-r from-amber-500/15 to-yellow-500/20 text-amber-900 border border-amber-300/80 font-bold dark:text-amber-200 dark:border-amber-700',
        info: 'bg-sky-50 text-sky-800 border border-sky-200/80 dark:bg-sky-950/60 dark:text-sky-300',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />
}
