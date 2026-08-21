import { AlertTriangle, RotateCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export interface ErrorStateProps {
  error?: unknown
  onRetry?: () => void
  className?: string
}

const FALLBACK = 'تعذّر تحميل هذا القسم، يرجى المحاولة مرة أخرى'

/** Arabic message plus a retry — never a blank area and never an English one. */
export function ErrorState({ error, onRetry, className }: ErrorStateProps) {
  const message = error instanceof ApiError ? error.message : FALLBACK

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-12 text-center',
        className,
      )}
    >
      <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      <p className="text-base text-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          إعادة المحاولة
        </Button>
      ) : null}
    </div>
  )
}
