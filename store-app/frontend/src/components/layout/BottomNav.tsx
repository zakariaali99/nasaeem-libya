import { Heart, Home, LayoutGrid, ShoppingBag, User, type LucideIcon } from 'lucide-react'
import { NavLink } from '@/lib/i18nRouter'

import { formatNumber } from '@/lib/format'
import { useCart } from '@/lib/queries/cart'
import { useWishlistIds } from '@/lib/queries/wishlist'
import { cn } from '@/lib/utils'
import { t, type MessageKey } from '@/lib/i18n'

const ITEMS: {
  to: string
  label: MessageKey
  Icon: LucideIcon
  end: boolean
  isCart?: boolean
  isWishlist?: boolean
}[] = [
  { to: '/', label: 'nav.home', Icon: Home, end: true },
  { to: '/products', label: 'nav.products', Icon: LayoutGrid, end: false },
  { to: '/wishlist', label: 'nav.wishlist', Icon: Heart, end: false, isWishlist: true },
  { to: '/cart', label: 'nav.cart', Icon: ShoppingBag, end: false, isCart: true },
  { to: '/me', label: 'nav.account', Icon: User, end: false },
]

/** Mobile-only bottom navigation */
export function BottomNav() {
  const { data: cart } = useCart()
  const { data: wishlistIds } = useWishlistIds()

  const cartCount = cart?.item_count ?? 0
  const wishlistCount = wishlistIds?.length ?? 0

  return (
    <nav
      aria-label={t('nav.quick')}
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
                  <span>{t(label)}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
