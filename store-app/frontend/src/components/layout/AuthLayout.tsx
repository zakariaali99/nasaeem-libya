import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Link to="/" aria-label="نسائم ليبيا — الصفحة الرئيسية">
          <img src="/brand/logo.svg" alt="" width={64} height={64} className="size-16" />
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">{children}</div>

      {footer ? <div className="text-center text-sm text-muted-foreground">{footer}</div> : null}
    </main>
  )
}
