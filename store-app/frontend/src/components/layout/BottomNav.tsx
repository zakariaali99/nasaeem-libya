import { Heart, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { formatNumber } from '@/lib/format'
import { useCart } from '@/lib/queries/cart'
import { useWishlistIds } from '@/lib/queries/wishlist'
import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/', label: 'الرئيسية', Icon: Home, end: true },
  { to: '/products', label: 'المنتجات', Icon: LayoutGrid, end: false },
  { to: '/wishlist', label: 'المفضلة', Icon: Heart, end: false, isWishlist: true },
  { to: '/cart', label: 'السلة', Icon: ShoppingBag, end: false, isCart: true },
  { to: '/me', label: 'حسابي', Icon: User, end: false },
]

/** Mobile-only bottom navigation */
export function BottomNav() {
  const { data: cart } = useCart()
  const { data: wishlistIds } = useWishlistIds()

  const cartCount = cart?.item_count ?? 0
  const wishlistCount = wishlistIds?.length ?? 0

  return (
    <nav
      aria-label="التنقل السريع"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden shadow-lg pb-safe"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ to, label, Icon, end, isCart, isWishlist }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              viewTransition
              className={({ isActive }) =>
                cn(
                  'relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-all duration-150',
                  isActive
                    ? 'text-primary font-bold'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute top-0 inset-x-4 h-0.5 rounded-full bg-primary" />
                  )}
                  <div className="relative">
                    <Icon className={cn('size-5', isActive && 'stroke-[2.5]')} aria-hidden="true" />
                    {isCart && cartCount > 0 && (
                      <span className="animate-badge-pop absolute -top-1 -end-2 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground font-mono">
                        {formatNumber(cartCount)}
                      </span>
                    )}
                    {isWishlist && wishlistCount > 0 && (
                      <span className="animate-badge-pop absolute -top-1 -end-2 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white font-mono">
                        {formatNumber(wishlistCount)}
                      </span>
                    )}
                  </div>
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
