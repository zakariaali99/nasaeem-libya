import {
  ArrowUpRight,
  Blocks,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FolderTree,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Package,
  Percent,
  Plus,
  Search,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { Breadcrumbs } from '@/components/admin/Breadcrumbs'
import { CommandPalette } from '@/components/admin/CommandPalette'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useLogout, useMe } from '@/lib/queries/auth'
import { useDashboardStats } from '@/lib/queries/orders'
import { cn } from '@/lib/utils'

interface NavGroup {
  title: string
  items: {
    to: string
    label: string
    icon: typeof LayoutGrid
    badgeKey?: 'pending_orders' | 'low_stock'
    badgeTone?: 'warning' | 'danger'
    end?: boolean
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'الرئيسية والعمليات',
    items: [
      { to: '/admin', label: 'لوحة التحكم', icon: LayoutGrid, end: true },
      { to: '/admin/orders', label: 'إدارة الطلبات', icon: ShoppingBag, badgeKey: 'pending_orders', badgeTone: 'warning' },
      { to: '/admin/users', label: 'سجل العملاء', icon: Users },
      { to: '/admin/discounts', label: 'كوبونات الخصم', icon: Percent },
    ],
  },
  {
    title: 'الكتالوج والمستودع',
    items: [
      { to: '/admin/products', label: 'كتالوج المنتجات', icon: Package },
      { to: '/admin/categories', label: 'الأقسام والتصنيفات', icon: FolderTree },
      { to: '/admin/collections', label: 'المجموعات المميزة', icon: Tags },
      { to: '/admin/inventory', label: 'مستويات المخزون', icon: Boxes, badgeKey: 'low_stock', badgeTone: 'danger' },
      { to: '/admin/inventory/logs', label: 'سجل حركات المخزون', icon: ClipboardList },
    ],
  },
  {
    title: 'الشحن والمدفوعات',
    items: [
      { to: '/admin/cities', label: 'المدن والمناطق', icon: MapPin },
      { to: '/admin/delivery', label: 'شركات التوصيل', icon: Truck },
      { to: '/admin/payment_methods', label: 'بوابات الدفع', icon: CreditCard },
      { to: '/admin/customization', label: 'محرر الواجهة والقوالب', icon: Blocks },
    ],
  },
]

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [isCollapsed, setIsCollapsed] = React.useState(() => {
    return localStorage.getItem('admin_sidebar_collapsed') === 'true'
  })

  const { data: user } = useMe()
  const { data: stats } = useDashboardStats()
  const logout = useLogout()
  const navigate = useNavigate()

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('admin_sidebar_collapsed', String(next))
      return next
    })
  }

  const handleLogout = async () => {
    await logout.mutateAsync()
    navigate('/login')
  }

  const badgeCounts: Record<string, number> = {
    pending_orders: stats?.pending_orders ?? 0,
    low_stock: stats?.low_stock ?? 0,
  }

  return (
    <div className="min-h-dvh bg-muted/25 text-foreground flex flex-col md:flex-row antialiased">
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-card/95 backdrop-blur-md px-4 md:hidden">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((value) => !value)}
            className="size-10 rounded-xl hover:bg-muted"
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
          <div className="flex items-center gap-2">
            <img src="/brand/logo.svg" alt="" width={28} height={28} className="size-7" />
            <span className="font-bold text-sm text-foreground">نسائم ليبيا</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPaletteOpen(true)}
            className="h-9 px-3 text-xs gap-1.5 text-muted-foreground rounded-xl shadow-2xs"
          >
            <Search className="size-3.5" />
            <span>بحث</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Mobile Overlay Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 animate-fade-in bg-scrim/50 backdrop-blur-xs transition-opacity duration-300 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Desktop & Mobile Sidebar Drawer */}
      <aside
        className={cn(
          'border-border bg-sidebar text-sidebar-foreground transition-all duration-300 z-50',
          // Desktop styles
          'md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col md:border-e',
          isCollapsed ? 'md:w-20' : 'md:w-64',
          // Mobile Off-Canvas Drawer from the RIGHT (RTL start)
          mobileOpen
            ? 'fixed inset-y-0 start-0 w-[80vw] max-w-[300px] flex flex-col bg-card shadow-2xl border-e border-border overflow-hidden animate-fade-rise'
            : 'hidden md:flex',
        )}
        aria-label="التنقل في لوحة التحكم"
      >
        {/* Brand Header / Mobile Close Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-border/80 bg-muted/20">
          <Link to="/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 overflow-hidden">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shadow-2xs">
              <img src="/brand/logo.svg" alt="" width={22} height={22} className="size-5" />
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="min-w-0 transition-opacity duration-200 text-start">
                <span className="font-bold text-sm text-foreground block leading-tight truncate">نسائم ليبيا</span>
                <span className="text-[11px] text-muted-foreground truncate block">لوحة الإدارة التنفيذية</span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse button */}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden md:flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            title={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
            aria-label={isCollapsed ? 'توسيع القائمة' : 'تصغير القائمة'}
          >
            {isCollapsed ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
          </button>

          {/* Mobile Close button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Quick action button */}
        {!isCollapsed || mobileOpen ? (
          <div className="p-3 pb-1">
            <Link
              to="/admin/products/new"
              onClick={() => setMobileOpen(false)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90 transition-colors"
            >
              <Plus className="size-4" />
              <span>إضافة منتج جديد</span>
            </Link>
          </div>
        ) : (
          <div className="p-2 flex justify-center">
            <Link
              to="/admin/products/new"
              className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 transition-colors"
              title="إضافة منتج جديد"
            >
              <Plus className="size-5" />
            </Link>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5 no-scrollbar">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              {!isCollapsed || mobileOpen ? (
                <span className="px-2.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider block">
                  {group.title}
                </span>
              ) : (
                <div className="my-2 border-t border-border/60 mx-1" />
              )}
              <ul className="space-y-1 pt-0.5">
                {group.items.map(({ to, label, icon: Icon, badgeKey, badgeTone, end }) => {
                  const count = badgeKey ? badgeCounts[badgeKey] : 0
                  return (
                    <li key={to}>
                      <NavLink
                        to={to}
                        end={end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex h-10 items-center gap-3 rounded-xl px-2.5 text-xs font-semibold transition-all duration-150',
                            isCollapsed && !mobileOpen && 'justify-center px-0',
                            isActive
                              ? 'bg-primary/10 text-primary font-bold shadow-2xs'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )
                        }
                        title={isCollapsed && !mobileOpen ? label : undefined}
                      >
                        {({ isActive }) => (
                          <>
                            {/* Active indicator bar */}
                            {isActive && (
                              <span className="absolute start-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-e-full bg-primary" />
                            )}
                            <Icon
                              className={cn(
                                'size-4 shrink-0 transition-colors',
                                isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                              )}
                              aria-hidden="true"
                            />
                            {(!isCollapsed || mobileOpen) && <span className="truncate flex-1">{label}</span>}
                            {(!isCollapsed || mobileOpen) && (count ?? 0) > 0 && (
                              <span
                                className={cn(
                                  'ms-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold font-mono',
                                  badgeTone === 'danger'
                                    ? 'bg-destructive/10 text-destructive'
                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                )}
                              >
                                {count}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer Account Card */}
        <div className="p-3 border-t border-border/80 bg-muted/20 space-y-2">
          {!isCollapsed || mobileOpen ? (
            <>
              <div className="flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                    {user?.name?.charAt(0) || <User className="size-4" />}
                  </div>
                  <div className="min-w-0 text-start">
                    <p className="text-xs font-bold text-foreground truncate">{user?.name || 'مدير النظام'}</p>
                    <span className="text-[10px] text-muted-foreground block capitalize">{user?.role || 'مسؤول'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                  title="تسجيل الخروج"
                  aria-label="تسجيل الخروج"
                >
                  <LogOut className="size-4" />
                </button>
              </div>

              <Link
                to="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted/70 transition-colors shadow-2xs"
              >
                <span>زيارة المتجر الإلكتروني</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Link
                to="/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground"
                title="زيارة المتجر"
              >
                <Store className="size-4" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="تسجيل الخروج"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop Top Header Bar */}
        <header className="hidden md:flex h-16 items-center justify-between border-b border-border bg-card/80 backdrop-blur-md px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4 min-w-0">
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Command Palette Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaletteOpen(true)}
              className="h-9 px-3 text-xs gap-2 rounded-xl text-muted-foreground hover:text-foreground shadow-2xs border-border bg-background"
            >
              <Search className="size-3.5" />
              <span>بحث سريع في النظام…</span>
              <kbd className="ms-2 pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:inline-flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>

            <ThemeToggle />
          </div>
        </header>

        {/* Page Inner Container with Responsive Padding */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Command Palette Modal */}
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
  actions,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-5">
      <div className="space-y-1 min-w-0">
        <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
        )}
      </div>
      {(action || actions) && (
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {action}
          {actions}
        </div>
      )}
    </div>
  )
}
