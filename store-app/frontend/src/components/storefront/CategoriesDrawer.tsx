import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  Gift,
  Heart,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LogIn,
  MapPin,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  User,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { formatNumber } from '@/lib/format'
import { useMe } from '@/lib/queries/auth'
import { useCart } from '@/lib/queries/cart'
import { useCategories } from '@/lib/queries/catalog'
import { useWishlistIds } from '@/lib/queries/wishlist'
import { cn } from '@/lib/utils'
import { isAdminRole } from '@/types/api'

interface CategoriesDrawerProps {
  children?: React.ReactNode
}

export function CategoriesDrawer({ children }: CategoriesDrawerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [brandsOpen, setBrandsOpen] = useState(true)
  const { data: categories = [], isLoading } = useCategories()
  const { data: user } = useMe()
  const { data: cart } = useCart()
  const { data: wishlistIds } = useWishlistIds()
  const navigate = useNavigate()

  const cartCount = cart?.item_count ?? 0
  const wishlistCount = wishlistIds?.length ?? 0

  // Filter categories
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const term = search.trim().toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(term))
  }, [categories, search])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`)
      setOpen(false)
      setSearch('')
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl p-2 text-sm font-semibold transition-colors hover:bg-muted text-foreground"
            aria-label="فتح القائمة الرئيسية"
          >
            <LayoutGrid className="size-5 text-primary" />
          </button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-[82vw] max-w-[340px] sm:max-w-md p-0 flex flex-col bg-card border-s border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-5 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 shadow-2xs">
                <img src="/brand/logo.svg" alt="" width={24} height={24} className="size-6" />
              </div>
              <div className="text-start">
                <SheetTitle className="text-base font-extrabold text-foreground leading-tight">
                  نسائم ليبيا
                </SheetTitle>
                <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                  دار العطور والجمال الفاخرة
                </p>
              </div>
            </div>
          </div>

          {/* Quick Search inside Drawer */}
          <form onSubmit={handleSearchSubmit} className="relative mt-4">
            <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن عطر أو ماركة…"
              className="ps-10 h-10 rounded-xl bg-background border-border text-xs"
            />
          </form>
        </SheetHeader>

        {/* Drawer Scrollable Options Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">
          {/* Main Primary Navigation Options */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground px-3 uppercase tracking-wider block mb-1">
              التسوق والاستكشاف
            </span>

            <DrawerLink to="/" icon={Home} label="الرئيسية" onClick={() => setOpen(false)} />
            <DrawerLink to="/products" icon={Sparkles} label="كل العطور والمنتجات" onClick={() => setOpen(false)} />
            <DrawerLink
              to="/collections"
              icon={Gift}
              label="المجموعات وأطقم الهدايا"
              badge="جديد"
              badgeTone="primary"
              onClick={() => setOpen(false)}
            />
            <DrawerLink
              to="/wishlist"
              icon={Heart}
              label="قائمة المفضلة"
              count={wishlistCount}
              onClick={() => setOpen(false)}
            />
            <DrawerLink
              to="/cart"
              icon={ShoppingBag}
              label="سلة التسوّق"
              count={cartCount}
              onClick={() => setOpen(false)}
            />
          </div>

          {/* Brands & Categories Section */}
          <div className="space-y-2 border-t border-border/80 pt-4">
            <button
              type="button"
              onClick={() => setBrandsOpen(!brandsOpen)}
              className="flex w-full items-center justify-between px-3 py-1 text-start"
            >
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="size-3.5 text-primary" />
                <span>الماركات والعلامات التجارية ({categories.length})</span>
              </span>
              <ChevronDown
                className={cn('size-4 text-muted-foreground transition-transform duration-200', brandsOpen && 'rotate-180')}
              />
            </button>

            {brandsOpen && (
              <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-rise">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-10 rounded-xl bg-muted/60 animate-pulse" />
                  ))
                ) : filteredCategories.length === 0 ? (
                  <p className="col-span-2 text-xs text-muted-foreground text-center py-3">
                    لا توجد ماركات مطابقة
                  </p>
                ) : (
                  filteredCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/categories/${encodeURIComponent(cat.slug)}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2 rounded-xl border border-border/70 bg-card p-2.5 hover:border-primary/50 hover:bg-primary/5 transition-all text-xs font-bold text-foreground shadow-2xs group"
                    >
                      {cat.image_url ? (
                        <img
                          src={cat.image_url}
                          alt=""
                          width={24}
                          height={24}
                          className="size-6 object-contain rounded-md shrink-0"
                        />
                      ) : (
                        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-[10px] shrink-0">
                          {cat.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="truncate group-hover:text-primary transition-colors">{cat.name}</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>

          {/* User Account & Orders Options */}
          <div className="space-y-1 border-t border-border/80 pt-4">
            <span className="text-[11px] font-bold text-muted-foreground px-3 uppercase tracking-wider block mb-1">
              حسابي والطلبات
            </span>

            {user ? (
              <>
                <DrawerLink to="/me" icon={User} label={`حسابي (${user.name})`} onClick={() => setOpen(false)} />
                <DrawerLink to="/me/orders" icon={Package} label="طلباتي ومشترياتي" onClick={() => setOpen(false)} />
                <DrawerLink to="/me/addresses" icon={MapPin} label="عناويني المحفوظة" onClick={() => setOpen(false)} />
              </>
            ) : (
              <DrawerLink
                to="/login"
                icon={LogIn}
                label="تسجيل الدخول / إنشاء حساب"
                badge="موصى به"
                badgeTone="primary"
                onClick={() => setOpen(false)}
              />
            )}
          </div>

          {/* Customer Service & WhatsApp */}
          <div className="space-y-2 border-t border-border/80 pt-4">
            <span className="text-[11px] font-bold text-muted-foreground px-3 uppercase tracking-wider block mb-1">
              خدمة العملاء والتوصيل
            </span>

            <a
              href="https://wa.me/218915555555"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 transition-all shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <MessageCircle className="size-4 text-emerald-600 dark:text-emerald-400" />
                <span>تواصل مع الدعم عبر واتساب</span>
              </div>
              <ArrowLeft className="size-3.5 rtl:rotate-0" />
            </a>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-3 py-1">
              <Truck className="size-3.5 text-primary shrink-0" />
              <span>توصيل سريع لكافة المدن الليبية (1–5 أيام)</span>
            </div>
          </div>
        </div>

        {/* Drawer Footer & Theme Toggle */}
        <div className="border-t border-border p-4 bg-muted/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">المظهر:</span>
            <ThemeToggle />
          </div>

          {isAdminRole(user?.role) && (
            <Link
              to="/admin"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all shadow-2xs"
            >
              <LayoutDashboard className="size-3.5" />
              <span>لوحة الإدارة</span>
            </Link>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DrawerLink({
  to,
  icon: Icon,
  label,
  count,
  badge,
  badgeTone = 'neutral',
  onClick,
}: {
  to: string
  icon: typeof Home
  label: string
  count?: number
  badge?: string
  badgeTone?: 'primary' | 'neutral'
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex items-center justify-between rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-all',
          isActive
            ? 'bg-primary text-primary-foreground shadow-xs'
            : 'text-foreground hover:bg-muted/70',
        )
      }
    >
      <div className="flex items-center gap-3">
        <Icon className="size-4 shrink-0" />
        <span>{label}</span>
      </div>

      <div className="flex items-center gap-2">
        {count !== undefined && count > 0 && (
          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-primary-foreground/20 text-inherit font-bold">
            {formatNumber(count)}
          </span>
        )}
        {badge && (
          <Badge tone={badgeTone} className="text-[10px] py-0 px-1.5 font-bold">
            {badge}
          </Badge>
        )}
        <ChevronLeft className="size-4 rtl:rotate-0 text-muted-foreground/60" />
      </div>
    </NavLink>
  )
}
