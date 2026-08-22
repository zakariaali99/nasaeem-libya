import { Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { useCart } from '@/lib/queries/cart'
import { useCategories } from '@/lib/queries/catalog'
import { useMe } from '@/lib/queries/auth'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
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
        'sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md transition-shadow duration-[var(--duration-base)] ease-out',
        elevated ? 'shadow-sm' : 'shadow-none',
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
          aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح قائمة التصنيفات'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X className="size-6" aria-hidden="true" /> : <Menu className="size-6" aria-hidden="true" />}
        </button>

        <Link
          to="/"
          viewTransition
          className="flex h-11 shrink-0 items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <img src="/brand/logo.svg" alt="" width={36} height={36} className="size-9" />
          <span className="font-display text-lg font-bold tracking-wide">نسائم ليبيا</span>
        </Link>

        <div className="hidden min-w-0 flex-1 lg:block">
          <SearchBox />
        </div>

        <nav className="ms-auto flex items-center gap-1" aria-label="حسابي">
          <ThemeToggle />
          <IconLink to="/search" label="البحث" className="lg:hidden">
            <Search className="size-6" aria-hidden="true" />
          </IconLink>
          <IconLink to={user ? '/me' : '/login'} label={user ? 'حسابي' : 'تسجيل الدخول'}>
            <User className="size-6" aria-hidden="true" />
          </IconLink>
          <IconLink
            to="/cart"
            label={cartCount > 0 ? `سلة التسوّق — ${cartCount} عنصر` : 'سلة التسوّق'}
            className="relative"
          >
            <ShoppingBag className="size-6" aria-hidden="true" />
            {cartCount > 0 ? (
              // `end-1` and not `right-1`: the badge mirrors with the document.
              // Keyed by count so every change replays the arrival animation.
              <span
                key={cartCount}
                aria-hidden="true"
                className="animate-badge-pop absolute end-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground tabular-nums"
              >
                {formatNumber(cartCount)}
              </span>
            ) : null}
          </IconLink>
        </nav>
      </div>

      {/* Categories: a horizontal rail on desktop, an animated disclosure on
       * mobile. The grid-rows animation lives in CSS — no measurement, no
       * layout jitter, and it collapses to "always open" from lg up. */}
      <nav className="mx-auto w-full max-w-6xl px-2" aria-label="التصنيفات">
        <div className="disclosure-grid" data-open={menuOpen}>
          <div>
            <ul className="flex gap-1 overflow-x-auto pb-2 max-lg:flex-col">
              <li>
                <CategoryLink to="/products" onClick={() => setMenuOpen(false)}>
                  كل المنتجات
                </CategoryLink>
              </li>
              {(categories ?? []).map((category) => (
                <li key={category.id}>
                  <CategoryLink
                    to={`/categories/${encodeURIComponent(category.slug)}`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {category.name}
                  </CategoryLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
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
