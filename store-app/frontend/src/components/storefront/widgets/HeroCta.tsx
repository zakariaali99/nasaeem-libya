import { ArrowLeft, ShieldCheck, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Widget } from '@/types/api'

const ALIGN = {
  start: 'items-start text-start',
  center: 'items-center text-center',
  end: 'items-end text-end',
} as const

export function HeroCta({ widget, priority = false }: { widget: Widget; priority?: boolean }) {
  const {
    title,
    subtitle,
    buttonLabel,
    buttonUrl,
    alignment,
    backgroundImageUrl,
    desktopImageUrl = backgroundImageUrl,
    mobileImageUrl,
  } = widget.data

  const displayTitle = title || 'عطور شرقية وعالمية فاخرة'
  const displaySubtitle =
    subtitle || 'اكتشف أرقى العطور النيش والعالمية مع ضمان الجودة 100% والتوصيل الفوري لجميع المدن الليبية'
  const displayButtonLabel = buttonLabel || 'استكشف التشكيلة الحصرية'
  const displayButtonUrl = buttonUrl || '/products'

  const hasImage = Boolean(desktopImageUrl || mobileImageUrl)

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white shadow-xl border border-border/40 animate-fade-rise">
      {hasImage ? (
        <>
          <picture className="absolute inset-0 size-full">
            {mobileImageUrl ? (
              <source media="(max-width: 640px)" srcSet={String(mobileImageUrl)} />
            ) : null}
            <img
              src={String(desktopImageUrl || mobileImageUrl)}
              alt={String(displayTitle)}
              width={1200}
              height={500}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : undefined}
              className="size-full object-cover opacity-40"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" aria-hidden="true" />
        </>
      ) : (
        <>
          {/* Luxury ambient light spheres */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -start-20 -top-20 size-96 rounded-full bg-primary/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -end-16 size-96 rounded-full bg-rating/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          />
        </>
      )}

      <div
        className={cn(
          'relative z-10 flex flex-col gap-6 px-6 py-12 sm:px-12 sm:py-16 max-w-4xl mx-auto',
          ALIGN[alignment ?? 'center'],
        )}
      >
        {/* Luxury Overline Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 backdrop-blur-md">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-xs font-bold tracking-wide text-primary-foreground">
            دار العطور الفاخرة والأصلية — ليبيا
          </span>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="space-y-3">
          <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl text-background drop-shadow-sm">
            {displayTitle}
          </h2>
          <p className="max-w-2xl text-sm sm:text-lg leading-relaxed text-background/80 font-normal">
            {displaySubtitle}
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button
            asChild
            size="lg"
            className="rounded-2xl font-extrabold text-sm sm:text-base px-8 h-12 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2 transition-all hover:scale-[1.02]"
          >
            <Link to={displayButtonUrl}>
              <ShoppingBag className="size-5" />
              <span>{displayButtonLabel}</span>
            </Link>
          </Button>

          <Link
            to="/collections"
            className="inline-flex h-12 items-center gap-2 rounded-2xl border border-secondary-foreground/20 bg-secondary-foreground/5 px-6 text-sm font-bold text-secondary-foreground hover:bg-secondary-foreground/10 hover:border-secondary-foreground/40 transition-all backdrop-blur-sm"
          >
            <span>أحدث المجموعات والعروض</span>
            <ArrowLeft className="size-4 rtl:rotate-0" />
          </Link>
        </div>

        {/* Embedded Trust Pillars Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-background/10 text-xs">
          <div className="flex items-center gap-2.5 text-background/70">
            <ShieldCheck className="size-4 text-success shrink-0" />
            <span>عطور أصلية ومضمونة 100%</span>
          </div>
          <div className="flex items-center gap-2.5 text-background/70">
            <Truck className="size-4 text-info shrink-0" />
            <span>توصيل لكافة المدن (1–5 أيام)</span>
          </div>
          <div className="flex items-center gap-2.5 text-background/70">
            <Sparkles className="size-4 text-rating shrink-0" />
            <span>أفضل الأسعار بالجملة والقطاعي</span>
          </div>
        </div>
      </div>
    </div>
  )
}
