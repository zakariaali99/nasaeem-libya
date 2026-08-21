import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'

import { Button } from '@/components/ui/button'

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
          {notFound ? 'الصفحة غير موجودة' : 'حدث خطأ غير متوقع'}
        </h1>
        <p className="text-sm text-muted-foreground">
          {notFound
            ? 'الرابط الذي فتحته غير صحيح أو تم حذف الصفحة.'
            : 'تعذّر عرض هذه الصفحة. يمكنك المحاولة مرة أخرى أو العودة إلى الصفحة الرئيسية.'}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!notFound ? (
          <Button onClick={() => window.location.reload()}>إعادة المحاولة</Button>
        ) : null}
        <Button variant="outline" onClick={() => navigate('/')}>
          الصفحة الرئيسية
        </Button>
      </div>
    </main>
  )
}
