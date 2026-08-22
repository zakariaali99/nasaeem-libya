import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { useCart, useRemoveCartItem, useUpdateCartItem } from '@/lib/queries/cart'
import type { CartLine } from '@/types/api'

interface CartDrawerProps {
  children?: React.ReactNode
}

const FREE_SHIPPING_THRESHOLD = 200 // 200 LYD for free delivery

export function CartDrawer({ children }: CartDrawerProps) {
  const [open, setOpen] = useState(false)
  const { data: cart, isLoading } = useCart()
  const updateItem = useUpdateCartItem()
  const removeItem = useRemoveCartItem()

  const items = cart?.items ?? []
  const subtotal = Number(cart?.subtotal ?? 0)
  const remainingForFree = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal)
  const progressPercent = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button
            type="button"
            className="relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-muted text-foreground"
            aria-label="سلة التسوق"
          >
            <ShoppingBag className="size-5 text-primary" />
            <span className="hidden sm:inline">السلة</span>
            {cart && cart.item_count > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                {cart.item_count}
              </span>
            )}
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-xl font-bold text-foreground">
                سلة التسوق ({cart?.item_count ?? 0})
              </SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">مراجعة المنتجات ومتابعة الطلب</p>
            </div>
          </div>

          {/* Free Shipping Progress Meter */}
          <div className="mt-4 rounded-xl bg-emerald-50/70 p-3 border border-emerald-200/60 dark:bg-emerald-950/30 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 dark:text-emerald-300">
              <Truck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>
                {remainingForFree > 0 ? (
                  <>
                    أضف <strong className="font-bold">{formatPrice(remainingForFree)}</strong> للحصول على توصيل مجاني!
                  </>
                ) : (
                  'تهانينا! لقد حصلت على شحن مجاني لكافة المدن 🚀'
                )}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-emerald-200/50 dark:bg-emerald-900/50">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <ShoppingBag className="size-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-foreground">سلتك فارغة حالياً</h3>
                <p className="text-xs text-muted-foreground">
                  استكشف تشكيلاتنا المميزة من العطور والبخور وأضف ما يعجبك.
                </p>
              </div>
              <Button asChild onClick={() => setOpen(false)}>
                <Link to="/products">تصفح المنتجات الآن</Link>
              </Button>
            </div>
          ) : (
            items.map((item: CartLine) => {
              const imgUrl = item.image?.renditions?.thumb || item.image?.url
              return (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-2xs transition-all hover:border-primary/30"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted border border-border/50">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                        لا صورة
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col justify-between min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/products/${encodeURIComponent(item.slug)}`}
                          onClick={() => setOpen(false)}
                          className="text-xs font-bold text-foreground line-clamp-1 hover:text-primary transition-colors"
                        >
                          {item.name}
                        </Link>
                        {item.variant_label && (
                          <span className="block text-[11px] text-muted-foreground mt-0.5">
                            {item.variant_label}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem.mutate(item.id)}
                        className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                        aria-label="حذف من السلة"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-border/40">
                      <span className="text-xs font-bold text-primary font-mono" dir="ltr">
                        {formatPrice(item.total_price)}
                      </span>

                      <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem.mutate({
                              id: item.id,
                              quantity: Math.max(1, item.quantity - 1),
                            })
                          }
                          className="flex size-6 items-center justify-center rounded-md hover:bg-background text-foreground transition-colors"
                          aria-label="تقليل الكمية"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="min-w-5 text-center text-xs font-bold font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateItem.mutate({
                              id: item.id,
                              quantity: item.quantity + 1,
                            })
                          }
                          className="flex size-6 items-center justify-center rounded-md hover:bg-background text-foreground transition-colors"
                          aria-label="زيادة الكمية"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-5 border-t border-border bg-card space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>المجموع الفرعي:</span>
                <span className="font-mono text-foreground font-semibold">{formatPrice(subtotal)}</span>
              </div>
              {Number(cart?.discount_total ?? 0) > 0 && (
                <div className="flex justify-between text-emerald-600 text-xs">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono font-semibold">-{formatPrice(cart!.discount_total)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-foreground pt-1.5 border-t border-border">
                <span>المجموع الإجمالي:</span>
                <span className="font-mono text-primary text-lg">{formatPrice(cart?.total ?? subtotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                asChild
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full text-xs font-semibold"
              >
                <Link to="/cart">عرض السلة الكاملة</Link>
              </Button>
              <Button
                asChild
                onClick={() => setOpen(false)}
                className="w-full text-xs font-bold shadow-sm"
              >
                <Link to="/cart" className="flex items-center justify-center gap-1.5">
                  <span>متابعة الشراء</span>
                  <ArrowLeft className="size-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
