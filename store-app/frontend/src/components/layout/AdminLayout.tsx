import {
  ArrowUpRight,
  Blocks,
  Boxes,
  ClipboardList,
  CreditCard,
  FolderTree,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Package,
  Percent,
  ShoppingBag,
  Store,
  Tags,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'

import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useLogout, useMe } from '@/lib/queries/auth'
import { cn } from '@/lib/utils'

interface NavGroup {
  title: string
  items: {
    to: string
    label: string
    icon: typeof LayoutGrid
    end?: boolean
  }[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'الرئيسية والعمليات',
    items: [
      { to: '/admin', label: 'لوحة التحكم', icon: LayoutGrid, end: true },
      { to: '/admin/orders', label: 'إدارة الطلبات', icon: ShoppingBag },
      { to: '/admin/users', label: 'سجل العملاء', icon: Users },
      { to: '/admin/discounts', label: 'كوبونات الخصم', icon: Percent },
    ],
  },
  {
    title: 'الكتالوج والمستودع',
    items: [
      { to: '/admin/products', label: 'المنتجات', icon: Package },
      { to: '/admin/categories', label: 'الأقسام والتصنيفات', icon: FolderTree },
      { to: '/admin/collections', label: 'المجموعات المميزة', icon: Tags },
      { to: '/admin/inventory', label: 'مستويات المخزون', icon: Boxes },
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
  const [open, setOpen] = useState(false)
  const { data: user } = useMe()
  const logout = useLogout()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout.mutateAsync()
    navigate('/login')
  }

  return (
    <div className="min-h-dvh bg-muted/20 text-foreground flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card px-4 md:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </Button>
          <div className="flex items-center gap-2">
            <img src="/brand/logo.svg" alt="" width={28} height={28} className="size-7" />
            <span className="font-bold text-sm text-foreground">لوحة الإدارة</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button asChild size="sm" variant="ghost">
            <Link to="/" target="_blank" rel="noopener noreferrer">
              <Store className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'border-border bg-card md:sticky md:top-0 md:flex md:h-dvh md:w-64 md:shrink-0 md:flex-col md:border-e shadow-2xs z-30',
          open ? 'fixed inset-0 top-16 z-40 block overflow-y-auto' : 'hidden md:flex',
        )}
        aria-label="التنقل في لوحة التحكم"
      >
        {/* Brand Header */}
        <div className="hidden md:flex h-16 items-center justify-between px-5 border-b border-border">
          <Link to="/admin" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <img src="/brand/logo.svg" alt="" width={20} height={20} className="size-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-foreground block leading-none">نسائم ليبيا</span>
              <span className="text-[10px] text-muted-foreground">لوحة الإدارة التنفيذية</span>
            </div>
          </Link>
          <ThemeToggle />
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1">
              <span className="px-3 text-[11px] font-bold text-muted-foreground/80 tracking-wider">
                {group.title}
              </span>
              <ul className="space-y-0.5 pt-1">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex h-10 items-center gap-3 rounded-xl px-3 text-xs font-semibold transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
                        )
                      }
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer Account Card */}
        <div className="p-3 border-t border-border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                {user?.name?.charAt(0) || <User className="size-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{user?.name || 'مدير النظام'}</p>
                <span className="text-[10px] text-muted-foreground capitalize">{user?.role || 'مسؤول'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive p-1 rounded-lg transition-colors"
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
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors shadow-2xs"
          >
            <span>زيارة المتجر الإلكتروني</span>
            <ArrowUpRight className="size-3.5 text-primary" />
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-w-0 flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
  actions,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}) {
  const actionContent = action || actions || children
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-border/70 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actionContent && <div>{actionContent}</div>}
    </div>
  )
}
