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

  if (!title && !subtitle && !buttonLabel && !desktopImageUrl && !mobileImageUrl) return null

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
              alt={String(title || 'نسائم ليبيا')}
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
            className="pointer-events-none absolute -bottom-24 -end-16 size-96 rounded-full bg-amber-500/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
          />
        </>
      )}

      <div
        className={cn(
          'relative z-10 flex flex-col gap-6 px-6 py-14 sm:px-12 sm:py-20 max-w-4xl mx-auto',
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
          {title ? (
            <h2 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl text-white drop-shadow-sm">
              {title}
            </h2>
          ) : null}
          {subtitle ? (
            <p className="max-w-2xl text-sm sm:text-lg leading-relaxed text-slate-300 font-normal">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {buttonLabel && buttonUrl ? (
            <Button
              asChild
              size="lg"
              className="rounded-2xl font-extrabold text-sm sm:text-base px-8 h-13 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2 transition-all hover:scale-[1.02]"
            >
              <Link to={buttonUrl}>
                <ShoppingBag className="size-5" />
                <span>{buttonLabel}</span>
              </Link>
            </Button>
          ) : (
            <Button
              asChild
              size="lg"
              className="rounded-2xl font-extrabold text-sm sm:text-base px-8 h-13 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 gap-2 transition-all hover:scale-[1.02]"
            >
              <Link to="/products">
                <ShoppingBag className="size-5" />
                <span>تصفّح تشكيلة العطور</span>
              </Link>
            </Button>
          )}

          <Link
            to="/collections"
            className="inline-flex h-13 items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 text-sm font-bold text-white hover:bg-white/10 hover:border-white/40 transition-all backdrop-blur-sm"
          >
            <span>أحدث المجموعات والعروض</span>
            <ArrowLeft className="size-4 rtl:rotate-0" />
          </Link>
        </div>

        {/* Embedded Trust Pillars Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2.5 text-slate-300">
            <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
            <span>عطور أصلية ومضمونة 100%</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <Truck className="size-4 text-sky-400 shrink-0" />
            <span>توصيل لكافة المدن (1–5 أيام)</span>
          </div>
          <div className="flex items-center gap-2.5 text-slate-300">
            <Sparkles className="size-4 text-amber-400 shrink-0" />
            <span>أفضل الأسعار بالجملة والقطاعي</span>
          </div>
        </div>
      </div>
    </div>
  )
}
