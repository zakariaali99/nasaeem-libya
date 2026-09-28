import { Heart, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DiscountBadge } from '@/components/storefront/DiscountBadge'
import { Price } from '@/components/storefront/Price'
import { ProductImage } from '@/components/storefront/ProductImage'
import { StockBadge } from '@/components/storefront/StockBadge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAddToCart, useCart, useUpdateCartItem } from '@/lib/queries/cart'
import { useToggleWishlist, useWishlistIds } from '@/lib/queries/wishlist'
import { cn } from '@/lib/utils'
import type { Product } from '@/types/api'

export interface ProductCardProps {
  product: Product
  /** The first card on a listing page is usually the LCP element. */
  priority?: boolean
  sizes?: string
}

export function ProductCard({ product, priority = false, sizes }: ProductCardProps) {
  const { data: cart } = useCart()
  const { data: wishlistIds } = useWishlistIds()
  const toggleWishlist = useToggleWishlist()
  const addToCart = useAddToCart()
  const updateItem = useUpdateCartItem()

  // Listing payloads carry `has_variants` but not the `variants` array, so the
  // flag decides: a sized product cannot be added without choosing a size.
  const hasVariants = Boolean(product.has_variants || (product.variants && product.variants.length > 0))
  // A single size needs no choosing. Several are offered as toggle buttons:
  // tap to choose, tap again to un-choose, and any number can be chosen at
  // once — each chosen size becomes its own line in the cart.
  const choices = product.variant_choices ?? []
  const [chosenIds, setChosenIds] = useState<string[]>([])
  const [justAdded, setJustAdded] = useState(false)
  const onlyChoice = choices.length === 1 ? choices[0] : null
  const showPicker = hasVariants && choices.length > 1
  const chosenMany = choices.filter((choice) => chosenIds.includes(choice.id))
  const chosen = onlyChoice ?? (chosenMany.length === 1 ? chosenMany[0] : null)
  // An older payload without `variant_choices` still sends the customer to the product page.
  const canAddFromCard = !hasVariants || choices.length > 0
  const inStock = onlyChoice ? onlyChoice.in_stock : product.in_stock

  const toggleChoice = (id: string) =>
    setChosenIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))

  const inCartFor = (variantId: string | null) =>
    cart?.items.find((i) =>
      i.product_id === product.id && (variantId ? i.variant_id === variantId : !i.variant_id),
    )
  // The +/- counter only applies when the card maps to one cart line.
  const cartItem = showPicker ? undefined : inCartFor(onlyChoice?.id ?? null)
  const quantity = cartItem?.quantity ?? 0

  const isWishlisted = Boolean(wishlistIds?.includes(product.id))

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    toggleWishlist.mutate(product.id)
  }

  const handleQuickAdd = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (showPicker) {
      if (chosenMany.length === 0) return
      try {
        // One line per size, added in turn so the cart never races itself.
        for (const choice of chosenMany) {
          await addToCart.mutateAsync({ product_id: product.id, variant_id: choice.id, quantity: 1 })
        }
        setChosenIds([])
        setJustAdded(true)
        window.setTimeout(() => setJustAdded(false), 2000)
      } catch {
        // useAddToCart rolls the optimistic count back; the choice stays so the customer can retry.
      }
      return
    }
    if (!inStock) return
    addToCart.mutate({
      product_id: product.id,
      variant_id: onlyChoice?.id ?? null,
      quantity: 1,
    })
  }

  return (
    <article className="card-hover group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-all duration-300 hover:shadow-md hover:border-primary/40">
      {/* Product Image & Badges */}
      <Link
        to={`/products/${encodeURIComponent(product.slug)}`}
        viewTransition
        className="relative block focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <div className="relative overflow-hidden rounded-t-2xl bg-white dark:bg-card/40 aspect-square flex items-center justify-center p-3 sm:p-4">
          <ProductImage
            image={product.images?.[0]}
            alt={product.images?.[0]?.alt_text || product.name}
            priority={priority}
            sizes={sizes}
            className="size-full max-h-full object-contain transition-transform duration-500 ease-out group-hover:scale-105"
          />

          {!product.in_stock && (
            <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex items-center justify-center">
              <span className="rounded-full bg-destructive/10 text-destructive border border-destructive/20 px-3 py-1 text-xs font-bold shadow-xs">
                نفدت الكمية
              </span>
            </div>
          )}

          {/* Discount Badge (Top Start) */}
          <span className="absolute start-2.5 top-2.5 z-10">
            <DiscountBadge price={product.price} compareAtPrice={product.compare_at_price} />
          </span>

          {/* Wishlist Button (Top End) */}
          <button
            type="button"
            onClick={handleToggleWishlist}
            aria-label={isWishlisted ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            className={cn(
              'absolute end-2.5 top-2.5 z-10 flex min-h-11 min-w-11 size-11 items-center justify-center rounded-full backdrop-blur-md transition-all shadow-xs focus-visible:outline-2 focus-visible:outline-ring',
              isWishlisted
                ? 'bg-rose-500 text-white shadow-rose-500/20'
                : 'bg-card/85 text-muted-foreground hover:bg-card hover:text-rose-500',
            )}
          >
            <Heart className={cn('size-4 transition-transform active:scale-125', isWishlisted && 'fill-white')} />
          </button>
        </div>

        <div className="p-2.5 sm:p-3.5 pb-1 space-y-1">
          <h3 className="line-clamp-2 text-xs sm:text-sm font-bold leading-snug text-foreground transition-colors duration-200 group-hover:text-primary">
            {product.name}
          </h3>
        </div>
      </Link>

      <div className="mt-auto flex flex-col gap-2 p-2.5 sm:p-3.5 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
          <Price
            price={chosen?.price ?? product.price}
            compareAtPrice={chosen ? chosen.compare_at_price : product.compare_at_price}
          />
          <StockBadge
            trackQuantity={product.track_quantity}
            availableStock={product.available_stock}
            inStock={product.in_stock}
          />
        </div>

        {onlyChoice ? (
          <p className="text-[11px] text-muted-foreground">
            الحجم: <span className="font-bold text-foreground">{onlyChoice.label}</span>
          </p>
        ) : null}

        {/* Quick Action Buttons */}
        {product.in_stock && (
          <div className="space-y-2 pt-1">
            {showPicker ? (
              <div role="group" aria-label="اختر حجماً أو أكثر" className="flex flex-wrap gap-1.5">
                {choices.map((choice) => {
                  const isChosen = chosenIds.includes(choice.id)
                  const inCart = inCartFor(choice.id)?.quantity ?? 0
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      aria-pressed={isChosen}
                      disabled={!choice.in_stock}
                      title={inCart ? `في السلة: ${inCart}` : undefined}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleChoice(choice.id)
                      }}
                      className={cn(
                        'min-h-9 rounded-lg border-2 px-2.5 text-xs font-bold transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        isChosen
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-primary/30 bg-primary/5 text-foreground hover:border-primary',
                        !choice.in_stock && 'cursor-not-allowed line-through opacity-50',
                      )}
                    >
                      {choice.label}
                      {inCart ? (
                        <span className="ms-1 rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">
                          {inCart}
                          <span className="sr-only"> في السلة</span>
                        </span>
                      ) : null}
                      {choice.in_stock ? null : <span className="sr-only"> — غير متوفر</span>}
                    </button>
                  )
                })}
              </div>
            ) : null}

            {!canAddFromCard ? (
              <Button asChild variant="outline" className="w-full min-h-[44px] h-11 text-xs font-bold rounded-xl shadow-2xs">
                <Link to={`/products/${encodeURIComponent(product.slug)}`}>
                  اختيار الحجم والخيارات
                </Link>
              </Button>
            ) : quantity > 0 ? (
              <div className="flex min-h-[44px] items-center justify-between rounded-xl border border-primary/40 bg-primary/5 p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    updateItem.mutate({
                      id: cartItem!.id,
                      quantity: Math.max(0, quantity - 1),
                    })
                  }}
                  className="flex size-9 items-center justify-center rounded-lg bg-card text-foreground hover:bg-muted transition-colors shadow-2xs"
                  aria-label="إنقاص الكمية"
                >
                  <Minus className="size-4" />
                </button>
                <span className="text-xs font-bold text-primary font-mono">{quantity} في السلة</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    updateItem.mutate({
                      id: cartItem!.id,
                      quantity: quantity + 1,
                    })
                  }}
                  className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-2xs"
                  aria-label="زيادة الكمية"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickAdd}
                disabled={addToCart.isPending || (showPicker ? chosenMany.length === 0 : !inStock)}
                className="w-full min-h-[44px] h-11 text-xs font-bold rounded-xl hover:bg-primary hover:text-primary-foreground transition-all flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <ShoppingBag className="size-4" />
                <span>
                  {justAdded
                    ? 'تمت الإضافة ✓'
                    : showPicker && chosenMany.length === 0
                      ? 'اختر الحجم أولاً'
                      : chosenMany.length > 1
                        ? `أضف ${chosenMany.length} أحجام للسلة`
                        : 'أضف للسلة'}
                </span>
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-col gap-2 p-3.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-9 w-full mt-2 rounded-xl" />
      </div>
    </div>
  )
}
