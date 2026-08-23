import {
  Compass,
  Heart,
  LayoutDashboard,
  Menu,
  Search,
  ShoppingBag,
  User,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { CartDrawer } from '@/components/storefront/CartDrawer'
import { CategoriesDrawer } from '@/components/storefront/CategoriesDrawer'
import { FragranceFinderQuizModal } from '@/components/storefront/FragranceFinderQuizModal'
import { InstantSearchModal } from '@/components/storefront/InstantSearchModal'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { formatNumber } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import { useCart } from '@/lib/queries/cart'
import { useWishlistIds } from '@/lib/queries/wishlist'
import { cn } from '@/lib/utils'
import { isAdminRole } from '@/types/api'

export function Header() {
  const [elevated, setElevated] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [quizOpen, setQuizOpen] = useState(false)
  const { data: user } = useMe()
  const { data: cart } = useCart()
  const { data: wishlistIds } = useWishlistIds()

  const cartCount = cart?.item_count ?? 0
  const wishlistCount = wishlistIds?.length ?? 0

  /* Scroll-aware elevation */
  useEffect(() => {
    const onScroll = () => setElevated(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-40 border-b border-border/80 bg-card/95 backdrop-blur-md transition-shadow duration-[var(--duration-base)] ease-out',
          elevated ? 'shadow-md shadow-primary/5' : 'shadow-none',
        )}
      >
        {/* Main Top Header Bar */}
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-2.5 sm:py-3">
          {/* Mobile Search Overlay */}
          {mobileSearchOpen ? (
            <div className="flex w-full items-center gap-2 lg:hidden animate-fade-rise">
              <div className="flex-1">
                <SearchBox autoFocus onSubmitted={() => setMobileSearchOpen(false)} />
              </div>
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="px-3 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <>
              <CategoriesDrawer>
                <button
                  type="button"
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring transition-colors"
                  aria-label="فتح قائمة التصنيفات"
                >
                  <Menu className="size-5" aria-hidden="true" />
                </button>
              </CategoriesDrawer>

              {/* Brand Logo & Name */}
              <Link
                to="/"
                viewTransition
                className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl focus-visible:outline-2 focus-visible:outline-ring group"
              >
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-2xs group-hover:border-primary/50 transition-all">
                  <img src="/brand/logo.svg" alt="" width={24} height={24} className="size-6 transition-transform group-hover:scale-105" />
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-lg sm:text-xl font-extrabold tracking-wide text-foreground leading-none">
                    نسائم ليبيا
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold tracking-wider">
                    عطور فاخرة وأصلية
                  </span>
                </div>
              </Link>

              {/* Desktop Center Search Bar */}
              <div className="hidden min-w-0 flex-1 max-w-md mx-auto lg:block">
                <div
                  onClick={() => setSearchModalOpen(true)}
                  className="cursor-pointer"
                >
                  <SearchBox />
                </div>
              </div>

              {/* Right Action Icons */}
              <nav className="ms-auto flex items-center gap-1 sm:gap-1.5" aria-label="حسابي وسلتي">
                {/* AI Fragrance Finder Trigger Button */}
                <button
                  type="button"
                  onClick={() => setQuizOpen(true)}
                  className="inline-flex items-center gap-1 sm:gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-2.5 sm:px-3 py-1.5 text-xs font-black text-primary hover:bg-primary/20 transition-all shadow-2xs min-h-11"
                  title="مرشد العطور الذكي"
                >
                  <Compass className="size-3.5" />
                  <span className="hidden xs:inline">مرشد العطور</span>
                  <span>🪄</span>
                </button>

                {/* Admin quick switch if logged in as staff */}
                {isAdminRole(user?.role) && (
                  <Link
                    to="/admin"
                    className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all shadow-2xs min-h-11"
                    title="الانتقال للوحة التحكم"
                  >
                    <LayoutDashboard className="size-3.5" />
                    <span>لوحة الإدارة</span>
                  </Link>
                )}

                <div className="hidden sm:flex">
                  <ThemeToggle />
                </div>

                {/* Mobile Search Button */}
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(true)}
                  className="inline-flex size-11 items-center justify-center rounded-xl text-foreground hover:bg-muted/70 lg:hidden transition-colors"
                  aria-label="البحث"
                >
                  <Search className="size-5" aria-hidden="true" />
                </button>

              {/* Wishlist Link */}
              <Link
                to="/wishlist"
                viewTransition
                aria-label={wishlistCount > 0 ? `المفضلة — ${wishlistCount} عنصر` : 'قائمة المفضلة'}
                title="قائمة المفضلة"
                className="relative hidden sm:inline-flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Heart className="size-5 text-muted-foreground hover:text-rose-500 transition-colors" aria-hidden="true" />
                {wishlistCount > 0 && (
                  <span
                    key={wishlistCount}
                    aria-hidden="true"
                    className="animate-badge-pop absolute end-1 top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white font-mono"
                  >
                    {formatNumber(wishlistCount)}
                  </span>
                )}
              </Link>

              {/* Account Link */}
              <div className="hidden sm:inline-flex">
                <IconLink to={user ? '/me' : '/login'} label={user ? 'حسابي' : 'تسجيل الدخول'}>
                  <User className="size-5" aria-hidden="true" />
                </IconLink>
              </div>

              {/* Cart Drawer Trigger */}
              <CartDrawer>
                <button
                  type="button"
                  aria-label={cartCount > 0 ? `سلة التسوّق — ${cartCount} عنصر` : 'سلة التسوّق'}
                  className="relative inline-flex size-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <ShoppingBag className="size-5 text-foreground" aria-hidden="true" />
                  {cartCount > 0 ? (
                    <span
                      key={cartCount}
                      aria-hidden="true"
                      className="animate-badge-pop absolute end-1 top-1 inline-flex min-w-4 h-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground font-mono shadow-xs"
                    >
                      {formatNumber(cartCount)}
                    </span>
                  ) : null}
                </button>
              </CartDrawer>
            </nav>
          </>
        )}
      </div>
    </header>

    <InstantSearchModal open={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    <FragranceFinderQuizModal open={quizOpen} onClose={() => setQuizOpen(false)} />
  </>
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
        'relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted/70 focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      {children}
    </Link>
  )
}

export function SearchBox({
  autoFocus = false,
  onSubmitted,
}: {
  autoFocus?: boolean
  onSubmitted?: () => void
}) {
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
        if (value) {
          navigate(`/search?q=${encodeURIComponent(value)}`)
          onSubmitted?.()
        }
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        ابحث عن عطر أو ماركة
      </label>
      <input
        id="site-search"
        ref={inputRef}
        type="search"
        name="q"
        value={term}
        autoFocus={autoFocus}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="ابحث عن عطر، زيت عطري، أو ماركة فاخرة…"
        className="h-10 w-full rounded-full border border-input bg-card pe-4 ps-10 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring shadow-2xs transition-all focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        aria-label="ابحث"
        className="absolute start-0 inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Search className="size-4 text-primary" aria-hidden="true" />
      </button>
    </form>
  )
}
