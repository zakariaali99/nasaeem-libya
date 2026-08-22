import {
  Blocks, Boxes, ClipboardList, FolderTree, LayoutGrid, Menu, Package, Tags, X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/admin', label: 'لوحة التحكم', icon: LayoutGrid, end: true },
  { to: '/admin/products', label: 'المنتجات', icon: Package },
  { to: '/admin/categories', label: 'التصنيفات', icon: FolderTree },
  { to: '/admin/collections', label: 'المجموعات', icon: Tags },
  { to: '/admin/inventory', label: 'المخزون', icon: Boxes },
  { to: '/admin/inventory/logs', label: 'سجل المخزون', icon: ClipboardList },
  { to: '/admin/customization', label: 'تخصيص الصفحة', icon: Blocks },
]

export function AdminLayout() {
  const [open, setOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card px-4 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </Button>
        <span className="font-semibold text-foreground">لوحة التحكم</span>
      </header>

      <div className="md:flex">
        <nav
          className={cn(
            'border-border bg-card md:sticky md:top-0 md:block md:h-dvh md:w-64 md:shrink-0 md:border-e',
            open ? 'block border-b' : 'hidden',
          )}
          aria-label="التنقل في لوحة التحكم"
        >
          <div className="hidden items-center gap-3 p-4 md:flex">
            <img src="/brand/logo.svg" alt="" width={32} height={32} className="size-8" />
            <span className="font-semibold text-foreground">نسائم ليبيا</span>
          </div>
          <ul className="space-y-1 p-3">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )
                  }
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}
