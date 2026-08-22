import { cn } from '@/lib/utils'

/** Skeletons match the final layout's dimensions. A spinner tells the user
 * nothing about what is arriving; a skeleton also prevents layout shift.
 * The shimmer sweep reads as "content is moving in", against bare opacity
 * pulsing; both themes get it because the sweep color IS --color-background. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton-shimmer rounded-md bg-muted', className)}
      aria-hidden="true"
      {...props}
    />
  )
}
