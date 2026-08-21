import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * A native <select>, deliberately.
 *
 * On the mobile phones this store is built for, the OS picker beats any custom
 * listbox: it is faster, it is accessible for free, and it ships no JavaScript.
 * A Radix Select is only worth it where an option needs rich content.
 */
export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'h-11 w-full rounded-md border border-input bg-background px-4 text-base text-foreground',
      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      'disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  >
    {children}
  </select>
))
Select.displayName = 'Select'
