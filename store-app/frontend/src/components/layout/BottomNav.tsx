import { Home, LayoutGrid, Search, ShoppingBag, User } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const ITEMS = [
  { to: '/', label: 'الرئيسية', Icon: Home, end: true },
  { to: '/products', label: 'المنتجات', Icon: LayoutGrid, end: false },
  { to: '/search', label: 'البحث', Icon: Search, end: false },
  { to: '/cart', label: 'السلة', Icon: ShoppingBag, end: false },
  { to: '/me', label: 'حسابي', Icon: User, end: false },
]

/** Mobile-only bottom navigation. The storefront reserves matching padding at
 * the page bottom so it never covers the last row of content. */
export function BottomNav() {
  return (
    <nav
      aria-label="التنقل السريع"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg">
        {ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )
              }
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
