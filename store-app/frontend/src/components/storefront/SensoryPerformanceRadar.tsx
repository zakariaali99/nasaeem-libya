import {
  Activity,
  Clock,
  Crown,
  Globe,
  Wind,
} from 'lucide-react'

import type { PerfumeDetails } from '@/types/api'
import { cn } from '@/lib/utils'
import { t, type MessageKey } from '@/lib/i18n'

interface SensoryPerformanceRadarProps {
  details?: PerfumeDetails
}

const LABELS: Record<string, MessageKey> = {
  winter: 'radar.winter',
  autumn: 'radar.autumn',
  spring: 'radar.spring',
  summer: 'radar.summer',
  formal: 'radar.formal',
  evening: 'radar.evening',
  special_dates: 'radar.special_dates',
  daily: 'radar.daily',
}

/** A season or occasion code in words; an unknown code is shown as it is. */
const label = (code: string) => (LABELS[code] ? t(LABELS[code]) : code)

export function SensoryPerformanceRadar({ details }: SensoryPerformanceRadarProps) {
  if (!details) return null

  const longevityScore = details.longevity_score ?? 4
  const longevityHours = details.longevity_hours || ''
  const sillageScore = details.sillage_score ?? 4
  const seasons = details.seasons || []
  const occasions = details.occasions || []
  const concentration = details.concentration || ''
  const origin = details.origin_country || ''

  return (
    <div className="rounded-3xl border border-border bg-card p-6 shadow-2xs space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <span className="flex size-7 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Activity className="size-4" />
        </span>
        <div>
          <h3 className="text-base font-black text-foreground">{t('radar.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('radar.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Longevity Meter */}
        <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">{t('radar.longevity')}</span>
            </div>
            <span className="font-mono text-xs font-bold text-primary">{longevityHours}</span>
          </div>

          {/* 5-Block Scale */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className={cn(
                  'h-2 flex-1 rounded-full transition-all',
                  lvl <= longevityScore
                    ? 'bg-primary shadow-xs shadow-primary/30'
                    : 'bg-muted-foreground/20',
                )}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('radar.longevityText')}</p>
        </div>

        {/* Sillage Meter */}
        <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wind className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">{t('radar.sillage')}</span>
            </div>
            <span className="text-xs font-bold text-primary">
              {sillageScore >= 4 ? t('radar.sillageHigh') : t('radar.sillageModerate')}
            </span>
          </div>

          {/* 5-Block Scale */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <div
                key={lvl}
                className={cn(
                  'h-2 flex-1 rounded-full transition-all',
                  lvl <= sillageScore
                    ? 'bg-primary shadow-xs shadow-primary/30'
                    : 'bg-muted-foreground/20',
                )}
              />
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{t('radar.sillageText')}</p>
        </div>
      </div>

      {/* Specifications & Seasons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
        {/* Concentration & Origin */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Crown className="size-3.5 text-primary" />
              <span>{t('radar.concentration')}</span>
            </span>
            <span className="font-bold text-foreground">{concentration}</span>
          </div>

          <div className="flex items-center justify-between py-1.5 border-b border-border/40">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Globe className="size-3.5 text-primary" />
              <span>{t('radar.origin')}</span>
            </span>
            <span className="font-bold text-foreground">{origin}</span>
          </div>
        </div>

        {/* Seasons Badges */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-foreground block">{t('radar.seasons')}</span>
          <div className="flex flex-wrap gap-1.5">
            {seasons.map((s) => (
              <span
                key={s}
                className="rounded-lg bg-muted px-2.5 py-1 text-[11px] font-bold text-foreground border border-border/60"
              >
                {label(s)}
              </span>
            ))}
            {occasions.map((o) => (
              <span
                key={o}
                className="rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary border border-primary/25"
              >
                {label(o)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
