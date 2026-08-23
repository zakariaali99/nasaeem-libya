import { Check, Flame, Plus, ShoppingBag, Sparkles } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { useAddToCart } from '@/lib/queries/cart'
import type { Product, ProductBundle } from '@/types/api'

interface FrequentlyBoughtTogetherProps {
  product: Product
  bundle: ProductBundle
}

export function FrequentlyBoughtTogether({ product, bundle }: FrequentlyBoughtTogetherProps) {
  const addToCart = useAddToCart()
  const [added, setAdded] = useState(false)

  const handleAddBundle = async () => {
    try {
      // 1. Add main product
      await addToCart.mutateAsync({
        product_id: product.id,
        variant_id: product.variants?.[0]?.id,
        quantity: 1,
      })
      // 2. Add included products
      for (const item of bundle.included_products) {
        await addToCart.mutateAsync({
          product_id: item.id,
          variant_id: item.variants?.[0]?.id,
          quantity: 1,
        })
      }
      setAdded(true)
      setTimeout(() => setAdded(false), 3000)
    } catch {
      setAdded(false)
    }
  }

  const allItems = [product, ...(bundle.included_products || [])]

  return (
    <section className="rounded-3xl border border-primary/20 bg-card p-5 sm:p-6 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
            <Flame className="size-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-foreground">
              {bundle.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              {bundle.description}
            </p>
          </div>
        </div>

        <span className="rounded-full bg-linear-to-r from-amber-500/20 to-primary/20 border border-primary/30 px-3 py-1 text-xs font-black text-primary">
          {bundle.badge_text}
        </span>
      </div>

      {/* Visual Product Grid with + Operators */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {allItems.map((item, index) => {
          const img = item.images?.[0]?.url
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-border bg-muted/20 p-2.5 shadow-2xs">
                {img ? (
                  <img
                    src={img}
                    alt={item.name}
                    className="size-14 rounded-xl object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="size-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-mono text-xs">
                    عطر
                  </div>
                )}
                <div className="space-y-0.5 max-w-[140px]">
                  <h4 className="text-xs font-black text-foreground truncate">{item.name}</h4>
                  <p className="font-mono text-xs font-extrabold text-primary">
                    {formatPrice(item.price || '0')}
                  </p>
                </div>
              </div>

              {index < allItems.length - 1 && (
                <div className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary font-black shrink-0">
                  <Plus className="size-4" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Pricing Bar & 1-Click Bundle Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-bold text-foreground">سعر الحزمة الشاملة:</span>
            <span className="font-mono text-lg font-black text-primary">
              {formatPrice(bundle.bundle_price)}
            </span>
            <span className="font-mono text-xs text-muted-foreground line-through">
              {formatPrice(bundle.original_price)}
            </span>
          </div>
          <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <Sparkles className="size-3" />
            <span>توفير مؤكد بقيمة {formatPrice(bundle.savings_amount)} + شحن مجاني فوري</span>
          </p>
        </div>

        <Button
          onClick={handleAddBundle}
          disabled={addToCart.isPending || added}
          className="min-h-11 rounded-2xl px-6 font-black text-xs gap-2 shadow-xs"
        >
          {added ? (
            <>
              <Check className="size-4" />
              <span>تمت إضافة الحزمة للسلة!</span>
            </>
          ) : (
            <>
              <ShoppingBag className="size-4" />
              <span>{addToCart.isPending ? 'جاري الإضافة...' : 'إضافة الحزمة كاملة للسلة بنقرة واحدة'}</span>
            </>
          )}
        </Button>
      </div>
    </section>
  )
}
