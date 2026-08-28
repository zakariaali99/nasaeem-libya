import { ArrowLeft, Bell, Gift, Info, Megaphone, Sparkles, Star, Tag, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import type { Widget } from '@/types/api'

const ICONS = {
  megaphone: Megaphone,
  info: Info,
  sparkles: Sparkles,
  bell: Bell,
  gift: Gift,
  star: Star,
  tag: Tag,
} as const

const DISMISS_KEY = (id: string) => `nasaim:announcement-dismissed:${id}`

export function AnnouncementBar({ widget }: { widget: Widget }) {
  const { title, message, linkLabel, linkUrl, dismissible, icon } = widget.data
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY(widget.id)) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const displayMessage = message || 'عرض حصري: شحن مجاني لكافة المدن الليبية عند الطلب بقيمة 200 د.ل أو أكثر'
  const displayTitle = title || 'تنبيه حصري'

  const Icon = ICONS[(icon as keyof typeof ICONS) ?? 'megaphone'] ?? Sparkles

  const close = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY(widget.id), '1')
    } catch {
      /* a dismissal that does not persist is better than a crash */
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/15 via-primary/5 to-primary/15 p-3.5 sm:px-5 sm:py-3 shadow-xs text-foreground animate-fade-rise">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary border border-primary/30 shadow-2xs">
            <Icon className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {displayTitle && (
              <span className="text-xs sm:text-sm font-extrabold text-foreground tracking-tight">
                {displayTitle}:
              </span>
            )}
            <span className="text-xs sm:text-sm text-foreground/90 font-medium">
              {displayMessage}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ms-auto">
          {linkLabel && linkUrl ? (
            <Link
              to={linkUrl}
              viewTransition
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-2xs hover:bg-primary/90 transition-all hover:gap-2"
            >
              <span>{linkLabel}</span>
              <ArrowLeft className="size-3.5 rtl:rotate-0" />
            </Link>
          ) : null}

          {dismissible ? (
            <button
              type="button"
              onClick={close}
              aria-label="إغلاق الإعلان"
              className="inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
