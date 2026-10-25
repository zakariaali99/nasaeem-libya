import { ArrowLeft, CheckCircle2, Gift, Sparkles } from 'lucide-react'
import { Link } from '@/lib/i18nRouter'

import { Button } from '@/components/ui/button'

export interface DiscoveryBoxBannerProps {
  title?: string
  badge?: string
  description?: string
  /** Short bullet lines under the description. */
  features?: string[]
  linkUrl?: string
  buttonText?: string
  className?: string
}

/**
 * A promotional banner. Every word comes from the homepage builder: it used
 * to carry built-in promises (100% cashback, a 14-day coupon, fast delivery)
 * and write its own description, none of which the store had agreed to.
 */
export function DiscoveryBoxBanner({
  title,
  badge,
  description,
  features = [],
  linkUrl,
  buttonText,
  className = '',
}: DiscoveryBoxBannerProps) {
  const lines = features.filter(Boolean)
  if (!title && !description && lines.length === 0) return null

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border border-primary/30 bg-linear-to-r from-primary/10 via-card to-amber-500/10 p-5 sm:p-7 shadow-sm ${className}`}
    >
      <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
        <div className="flex items-start gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Sparkles className="size-6" />
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {title ? <h4 className="text-sm font-black text-foreground sm:text-base">{title}</h4> : null}
              {badge ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  {badge}
                </span>
              ) : null}
            </div>
            {description ? (
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            {lines.length > 0 ? (
              <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-bold text-foreground">
                {lines.map((line, index) => (
                  <span key={index} className="flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-primary" />
                    <span>{line}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {buttonText ? (
          <div className="shrink-0">
            <Button asChild size="sm" className="min-h-11 w-full gap-1.5 rounded-2xl px-5 text-xs font-black shadow-sm sm:w-auto">
              <Link to={linkUrl || '/products'}>
                <Gift className="size-4" />
                <span>{buttonText}</span>
                <ArrowLeft className="size-3.5 ltr:-scale-x-100" />
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
      <div className="pointer-events-none absolute -end-12 -top-12 size-40 rounded-full bg-primary/10 blur-2xl" />
    </div>
  )
}
