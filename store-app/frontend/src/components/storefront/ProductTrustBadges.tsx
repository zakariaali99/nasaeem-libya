import { Banknote, ShieldCheck, Sparkles, Truck } from 'lucide-react'

import { useSiteText } from '@/lib/siteText'

const ICONS = [ShieldCheck, Truck, Sparkles, Banknote]

/** Up to four reassurance lines under the buy button. The wording is the
 * store's own (إعدادات المتجر ← نصوص المتجر); a line with no title is not
 * drawn, and with none the strip disappears. */
export function ProductTrustBadges() {
  const t = useSiteText()
  const badges = [1, 2, 3, 4]
    .map((n, index) => ({
      Icon: ICONS[index]!,
      title: t(`product.badge.${n}.title`),
      text: t(`product.badge.${n}.text`),
    }))
    .filter((badge) => badge.title)
  if (badges.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
      {badges.map(({ Icon, title, text }) => (
        <div key={title} className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3 shadow-2xs">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </div>
          <div>
            <span className="block text-xs font-black text-foreground">{title}</span>
            {text && <span className="block text-[10px] text-muted-foreground">{text}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
