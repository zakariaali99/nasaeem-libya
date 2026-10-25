import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { useNavigate } from '@/lib/i18nRouter'

import { Button } from '@/components/ui/button'
import { t } from '@/lib/i18n'

/** A crash shows an Arabic message, never a white screen. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const navigate = useNavigate()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <AlertTriangle className="size-12 text-warning" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          {notFound ? t('error.notFoundTitle') : t('error.unexpectedTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? t('error.notFoundText')
            : t('error.unexpectedText')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!notFound ? (
          <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
        ) : null}
        <Button variant="outline" onClick={() => navigate('/')}>
          {t('error.homePage')}
        </Button>
      </div>
    </main>
  )
}
