import * as React from 'react'

import { Label } from './label'

interface FieldProps {
  id?: string
  htmlFor?: string
  label: string
  error?: string
  hint?: string
  children:
    | React.ReactNode
    | ((props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode)
}

/** Label + control + inline Arabic error, wired together for screen readers. */
export function Field({ id, htmlFor, label, error, hint, children }: FieldProps) {
  const targetId = id || htmlFor || ''
  const errorId = targetId ? `${targetId}-error` : undefined
  const hintId = targetId ? `${targetId}-hint` : undefined
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-2">
      <Label htmlFor={targetId}>{label}</Label>
      {typeof children === 'function'
        ? children({
            id: targetId,
            'aria-invalid': Boolean(error),
            ...(describedBy ? { 'aria-describedby': describedBy } : {}),
          })
        : children}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
