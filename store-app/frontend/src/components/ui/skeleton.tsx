import { cn } from '@/lib/utils'

/** Skeletons match the final layout's dimensions. A spinner tells the user
 * nothing about what is arriving; a skeleton also prevents layout shift. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" {...props} />
}
