import { Link } from 'react-router-dom'

interface AuthLayoutProps {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="relative min-h-dvh flex flex-col justify-center items-center p-4 sm:p-6 auth-pattern overflow-hidden">
      {/* Ambient background glow spheres */}
      <div className="pointer-events-none absolute -top-40 start-1/2 -translate-x-1/2 size-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 end-10 size-80 rounded-full bg-primary/5 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-col justify-center gap-6 animate-fade-rise">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <Link
            to="/"
            aria-label="نسائم ليبيا — العودة للصفحة الرئيسية"
            className="group flex size-16 items-center justify-center rounded-2xl bg-card border border-border shadow-sm hover:border-primary/50 transition-all"
          >
            <img
              src="/brand/logo.svg"
              alt=""
              width={44}
              height={44}
              className="size-11 transition-transform group-hover:scale-105"
            />
          </Link>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
            {subtitle ? <p className="text-xs sm:text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>

        {/* Card Body */}
        <div className="rounded-3xl border border-border/90 bg-card/95 backdrop-blur-xl p-6 sm:p-8 shadow-xl">
          {children}
        </div>

        {/* Footer */}
        {footer ? <div className="text-center text-xs sm:text-sm text-muted-foreground">{footer}</div> : null}
      </main>
    </div>
  )
}
