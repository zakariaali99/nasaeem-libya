import { Award, Crown } from 'lucide-react'

import { formatPrice } from '@/lib/format'
import { useLoyaltySummary } from '@/lib/queries/loyalty'
import { cn } from '@/lib/utils'

export function LoyaltyVipBadge() {
  const { data: loyalty } = useLoyaltySummary()

  if (!loyalty) return null

  const isGold = loyalty.vip_tier === 'GOLD'
  const isDiamond = loyalty.vip_tier === 'DIAMOND'

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-4 shadow-2xs transition-all space-y-3',
      isDiamond
        ? 'border-primary/50 bg-linear-to-r from-primary/15 via-card to-rating/15'
        : isGold
        ? 'border-rating/40 bg-linear-to-r from-rating/10 via-card to-primary/10'
        : 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex size-10 items-center justify-center rounded-xl border shadow-2xs',
            isDiamond
              ? 'border-primary/50 bg-primary/20 text-primary'
              : isGold
              ? 'border-rating/40 bg-rating/20 text-rating'
              : 'border-border bg-muted text-muted-foreground',
          )}>
            {isDiamond || isGold ? <Crown className="size-5" /> : <Award className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-foreground">
                {loyalty.vip_tier_label}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              رصيدك: <span className="font-mono font-bold text-foreground">{loyalty.loyalty_points} نقطة</span> ({formatPrice(loyalty.points_value_lyd)})
            </p>
          </div>
        </div>

        <div className="text-end">
          <span className="font-mono text-xs font-black text-primary block">
            {loyalty.loyalty_points}
          </span>
          <span className="text-[10px] text-muted-foreground font-bold">نقطة ملكية</span>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {loyalty.next_tier && (
        <div className="space-y-1 pt-1 border-t border-border/60">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
            <span>الترقية إلى {loyalty.next_tier === 'GOLD' ? 'المستوى الذهبي 🥇' : 'المستوى الماسي 💎'}</span>
            <span>باقي {formatPrice(loyalty.spend_to_next_tier)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${loyalty.progress_percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
