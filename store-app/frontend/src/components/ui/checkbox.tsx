import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  // The 44px target is the padding box; the visible box stays 20px.
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      'inline-flex size-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
      className,
    )}
    {...props}
  >
    <span className="flex size-5 items-center justify-center rounded border border-input bg-background data-[state=checked]:border-primary">
      <CheckboxPrimitive.Indicator className="text-primary">
        <Check className="size-4" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </span>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = 'Checkbox'
