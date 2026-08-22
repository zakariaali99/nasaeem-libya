import { Menu, Search, ShoppingBag, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { CategoriesDrawer } from '@/components/storefront/CategoriesDrawer'
import { CartDrawer } from '@/components/storefront/CartDrawer'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useCart } from '@/lib/queries/cart'
import { useCategories } from '@/lib/queries/catalog'
import { useMe } from '@/lib/queries/auth'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Header() {
  const [elevated, setElevated] = useState(false)
  const { data: user } = useMe()
  const { data: categories } = useCategories()
  const { data: cart } = useCart()
  const cartCount = cart?.item_count ?? 0

  /* Scroll-aware elevation: the bar lifts off the page once content moves
   * under it. One passive listener; the state flip is a no-op past the mark. */
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md transition-shadow duration-[var(--duration-base)] ease-out',
        elevated ? 'shadow-sm' : 'shadow-none',
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5">
        <CategoriesDrawer>
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="فتح قائمة التصنيفات"
          >
            <Menu className="size-6" aria-hidden="true" />
          </button>
        </CategoriesDrawer>

        <Link
          to="/"
          viewTransition
          className="flex h-11 shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <img src="/brand/logo.svg" alt="" width={24} height={24} className="size-6" />
          </div>
          <span className="font-display text-lg font-bold tracking-wide text-foreground">نسائم ليبيا</span>
        </Link>

        <div className="hidden min-w-0 flex-1 max-w-md mx-auto lg:block">
          <SearchBox />
        </div>

        <nav className="ms-auto flex items-center gap-1.5" aria-label="حسابي وسلتي">
          <ThemeToggle />
          <IconLink to="/search" label="البحث" className="lg:hidden">
            <Search className="size-5" aria-hidden="true" />
          </IconLink>
          <IconLink to={user ? '/me' : '/login'} label={user ? 'حسابي' : 'تسجيل الدخول'}>
            <User className="size-5" aria-hidden="true" />
          </IconLink>
          <CartDrawer>
            <button
              type="button"
              aria-label={cartCount > 0 ? `سلة التسوّق — ${cartCount} عنصر` : 'سلة التسوّق'}
              className="relative inline-flex size-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <ShoppingBag className="size-5" aria-hidden="true" />
              {cartCount > 0 ? (
                <span
                  key={cartCount}
                  aria-hidden="true"
                  className="animate-badge-pop absolute end-1.5 top-1.5 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground tabular-nums"
                >
                  {formatNumber(cartCount)}
                </span>
              ) : null}
            </button>
          </CartDrawer>
        </nav>
      </div>

      {/* Quick category pills rail */}
      <nav className="mx-auto w-full max-w-6xl px-4 pb-2 border-t border-border/40 pt-1.5 hidden md:block" aria-label="التصنيفات السريعة">
        <ul className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <li>
            <CategoryLink to="/products">
              كل المنتجات
            </CategoryLink>
          </li>
          {(categories ?? []).slice(0, 7).map((category) => (
            <li key={category.id}>
              <CategoryLink to={`/categories/${encodeURIComponent(category.slug)}`}>
                {category.name}
              </CategoryLink>
            </li>
          ))}
          <li>
            <CategoriesDrawer>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                + المزيد من الأقسام
              </button>
            </CategoriesDrawer>
          </li>
        </ul>
      </nav>
    </header>
  )
}

function IconLink({
  to,
  label,
  children,
  className,
}: {
  to: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      to={to}
      viewTransition
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-md text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        className,
      )}
    >
      {children}
    </Link>
  )
}

function CategoryLink({
  to,
  children,
  onClick,
}: {
  to: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <Link
      to={to}
      viewTransition
      onClick={onClick}
      className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {children}
    </Link>
  )
}

/** The header search box. Submitting navigates to `/search?q=` — the results
 * page owns the query, so a search is shareable and survives a refresh. */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [term, setTerm] = useState(params.get('q') ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTerm(params.get('q') ?? '')
  }, [params])

  return (
    <form
      role="search"
      className="relative flex w-full items-center"
      onSubmit={(event) => {
        event.preventDefault()
        const value = term.trim()
        if (value) navigate(`/search?q=${encodeURIComponent(value)}`)
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        ابحث عن منتج
      </label>
      <input
        id="site-search"
        ref={inputRef}
        type="search"
        name="q"
        value={term}
        autoFocus={autoFocus}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="ابحث عن عطر أو علامة تجارية…"
        className="h-11 w-full rounded-full border border-input bg-background pe-4 ps-11 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <button
        type="submit"
        aria-label="ابحث"
        className="absolute start-0 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Search className="size-5" aria-hidden="true" />
      </button>
    </form>
  )
}
