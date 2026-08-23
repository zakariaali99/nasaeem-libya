import { Eye, Flame, Truck } from 'lucide-react'
import * as React from 'react'

import type { Product } from '@/types/api'

interface LiveSocialProofProps {
  product: Product
}

export function LiveSocialProof({ product }: LiveSocialProofProps) {
  // Stable random view count based on product id
  const [viewCount, setViewCount] = React.useState(7)

  React.useEffect(() => {
    // Generate initial count based on product id hash
    const seed = product.id ? product.id.charCodeAt(0) % 7 + 4 : 6
    setViewCount(seed)

    const interval = setInterval(() => {
      setViewCount((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1
        const next = prev + delta
        return Math.max(3, Math.min(18, next))
      })
    }, 12000)

    return () => clearInterval(interval)
  }, [product.id])

  const stock = product.available_stock
  const isLowStock = product.in_stock && stock > 0 && stock <= 5
  const isFreeShippingEligible = parseFloat(product.price || '0') >= 150

  return (
    <div className="space-y-2.5">
      {/* 1. Live Viewers Badge */}
      <div className="flex items-center gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
        <div className="flex items-center gap-1.5 text-foreground">
          <Eye className="size-3.5 text-primary" />
          <span>
            يشاهد هذا العطر الآن <strong className="text-primary font-mono font-bold">{viewCount}</strong> أشخاص في طرابلس وبنغازي
          </span>
        </div>
      </div>

      {/* 2. Low Stock Scarcity Trigger */}
      {isLowStock && (
        <div className="flex items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/10 px-3.5 py-2 text-xs text-destructive font-bold">
          <Flame className="size-3.5 text-destructive shrink-0" />
          <span>
            طلب مرتفع جداً: متبقي <strong className="font-mono">{stock}</strong> قطع فقط بالمستودع الرئيسي
          </span>
        </div>
      )}

      {/* 3. Free Delivery Trigger */}
      {isFreeShippingEligible && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-2 text-xs text-emerald-700 dark:text-emerald-400 font-bold">
          <Truck className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>مؤهل للشحن المجاني الفوري لكافة مدن ومناطق ليبيا 🚀</span>
        </div>
      )}
    </div>
  )
}
