import { CreditCard, ShieldCheck, Sparkles, Truck } from 'lucide-react'
import type { Widget } from '@/types/api'

const ICON_MAP: Record<string, typeof ShieldCheck> = {
  'shield-check': ShieldCheck,
  truck: Truck,
  'credit-card': CreditCard,
  sparkles: Sparkles,
}

export function TrustBadgesWidget({ widget }: { widget: Widget }) {
  const { data } = widget
  const items = (data.items as Array<{ icon?: string; title?: string; subtitle?: string }>) || [
    { icon: 'shield-check', title: 'عطور أصلية 100%', subtitle: 'ماركات عالمية وأصلية مضمونة' },
    { icon: 'truck', title: 'توصيل لجميع مدن ليبيا', subtitle: 'شحن سريع وموثوق لباب بيتك' },
    { icon: 'credit-card', title: 'دفع آمن ومريح', subtitle: 'سداد، معاملات، بطاقات، أو كاش' },
  ]

  return (
    <div className="rounded-3xl border border-border/70 bg-card/60 p-6 shadow-xs backdrop-blur-xs">
      {data.title && (
        <h3 className="mb-5 text-center text-sm font-black text-foreground sm:text-base">
          {data.title}
        </h3>
      )}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {items.map((item, idx) => {
          const Icon = (item.icon && ICON_MAP[item.icon]) || Sparkles
          return (
            <div
              key={idx}
              className="flex items-center gap-3.5 rounded-2xl bg-muted/30 p-3.5 transition-all hover:bg-muted/60 text-start"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{item.title}</h4>
                <p className="text-[11px] text-muted-foreground line-clamp-1">{item.subtitle}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
