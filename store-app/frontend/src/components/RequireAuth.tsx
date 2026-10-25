import { Outlet, useLocation } from 'react-router-dom'
import { Navigate } from '@/lib/i18nRouter'

import { useMe } from '@/lib/queries/auth'
import { isAdminRole } from '@/types/api'
import { t } from '@/lib/i18n'

interface RequireAuthProps {
  /** When true the route also requires an admin role. */
  admin?: boolean
}

export function RequireAuth({ admin = false }: RequireAuthProps) {
  const { data: user, isPending } = useMe()
  const location = useLocation()

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6" role="status" aria-live="polite">
        <span className="sr-only">{t('common.loading')}</span>
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }

  if (admin && !isAdminRole(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
