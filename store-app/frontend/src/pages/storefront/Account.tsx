import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import { useLogout, useMe } from '@/lib/queries/auth'
import { usePageTitle } from '@/lib/usePageTitle'

/** Phase 2 stub: proves the session round-trips. Orders, addresses and the rest
 * arrive in Phase 7. */
export default function AccountPage() {
  usePageTitle('حسابي', 'إدارة حسابك في نسائم ليبيا')
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  if (!user) return null

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <h1 className="text-2xl font-bold text-foreground">حسابي</h1>

      <dl className="divide-y divide-border rounded-lg border border-border bg-card">
        {[
          ['الاسم', user.name || '—'],
          ['رقم الهاتف', user.phone_number],
          ['تاريخ التسجيل', formatDate(user.date_joined)],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 p-4">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-base font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>

      <Button
        variant="outline"
        loading={logout.isPending}
        onClick={async () => {
          await logout.mutateAsync()
          navigate('/', { replace: true })
        }}
      >
        تسجيل الخروج
      </Button>
    </main>
  )
}
