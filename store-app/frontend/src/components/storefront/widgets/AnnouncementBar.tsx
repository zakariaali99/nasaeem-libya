import { Bell, Gift, Info, Megaphone, Sparkles, Star, Tag, X } from 'lucide-react'
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

  if (dismissed || !message) return null

  const Icon = ICONS[(icon as keyof typeof ICONS) ?? 'megaphone'] ?? Megaphone

  const close = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY(widget.id), '1')
    } catch {
      /* a dismissal that does not persist is better than a crash */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/25 bg-primary/10 px-4 py-3 text-foreground">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-background text-primary">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-bold">{title}</p> : null}
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
      <div className="flex items-center gap-1">
        {linkLabel && linkUrl ? (
          <Link
            to={linkUrl}
            className="inline-flex h-11 items-center px-3 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {linkLabel}
          </Link>
        ) : null}
        {dismissible ? (
          <button
            type="button"
            onClick={close}
            aria-label="إغلاق الإعلان"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
