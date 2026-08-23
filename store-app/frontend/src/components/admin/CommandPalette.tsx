import {
  Boxes,
  CreditCard,
  FolderTree,
  History,
  LayoutDashboard,
  Loader2,
  MapPin,
  Package,
  Palette,
  Percent,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Truck,
  User,
  Users,
  X,
} from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { StatusBadge } from '@/components/admin/StatusBadge'

interface SearchResponse {
  products: {
    id: string
    name: string
    slug: string
    sku: string
    price: string | null
    compare_at_price: string | null
    image_url: string | null
    stock: number
    url: string
  }[]
  orders: {
    id: string
    order_number: string
    customer_name: string
    customer_phone: string
    total: string
    status: string
    shipping_status: string
    created_at: string
    url: string
  }[]
  users: {
    id: string
    name: string
    phone_number: string
    role: string
    is_active: boolean
    url: string
  }[]
  pages: {
    title: string
    url: string
    category: string
    icon: string
  }[]
}

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  ShoppingCart,
  Plus,
  Package,
  FolderTree,
  Tag,
  Boxes,
  History,
  Users,
  Percent,
  CreditCard,
  Truck,
  MapPin,
  Palette,
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [query, setQuery] = React.useState('')
  const [debouncedQuery, setDebouncedQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isPending } = useQuery({
    queryKey: ['admin-search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return { products: [], orders: [], users: [], pages: [] }
      const res = await api.get<SearchResponse>(`/admin/search/?q=${encodeURIComponent(debouncedQuery)}`)
      return res.data
    },
    enabled: open && debouncedQuery.length > 0,
    staleTime: 10_000,
  })

  // Global shortcut listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  const flatResults = React.useMemo(() => {
    if (!data) return []
    const items: { type: string; title: string; subtitle?: string; url: string; badge?: React.ReactNode; icon?: React.ElementType }[] = []

    data.pages.forEach((p) => {
      items.push({
        type: 'page',
        title: p.title,
        subtitle: p.category,
        url: p.url,
        icon: ICON_MAP[p.icon] || LayoutDashboard,
      })
    })

    data.products.forEach((p) => {
      items.push({
        type: 'product',
        title: p.name,
        subtitle: `${p.sku ? `الرمز: ${p.sku} · ` : ''}${p.price ? formatPrice(p.price) : ''} · المخزون: ${p.stock}`,
        url: p.url,
        icon: Package,
      })
    })

    data.orders.forEach((o) => {
      items.push({
        type: 'order',
        title: `طلب #${o.order_number}`,
        subtitle: `${o.customer_name} (${o.customer_phone}) · ${formatPrice(o.total)}`,
        url: o.url,
        badge: <StatusBadge status={o.status} />,
        icon: ShoppingCart,
      })
    })

    data.users.forEach((u) => {
      items.push({
        type: 'user',
        title: u.name,
        subtitle: `${u.phone_number} · الدور: ${u.role}`,
        url: u.url,
        icon: User,
      })
    })

    return items
  }, [data])

  const handleSelect = (url: string) => {
    onOpenChange(false)
    navigate(url)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (flatResults.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % flatResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + flatResults.length) % flatResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = flatResults[selectedIndex]
      if (item) handleSelect(item.url)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Dialog card */}
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all"
        role="dialog"
        aria-modal="true"
        aria-label="البحث السريع والتنقل في النظام"
      >
        {/* Search header */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search className="size-5 text-muted-foreground shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ابحث عن صفحة، منتج، طلب، أو عميل..."
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              aria-label="مسح البحث"
            >
              <X className="size-4" />
            </button>
          ) : null}
          <div className="hidden sm:flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
            <span>ESC للإغلاق</span>
          </div>
        </div>

        {/* Results area */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-border/40">
          {isPending && query ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>جارٍ البحث في النظام...</span>
            </div>
          ) : !query ? (
            <div className="py-8 text-center text-xs text-muted-foreground space-y-3">
              <p className="font-medium text-foreground">اختصارات سريعة للبدء:</p>
              <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={() => handleSelect('/admin/products/new')}
                  className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs hover:border-primary/50 transition-colors"
                >
                  + إضافة منتج جديد
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect('/admin/orders')}
                  className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs hover:border-primary/50 transition-colors"
                >
                  الطلبات الجديدة
                </button>
                <button
                  type="button"
                  onClick={() => handleSelect('/admin/inventory')}
                  className="rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs hover:border-primary/50 transition-colors"
                >
                  فحص المخزون
                </button>
              </div>
            </div>
          ) : flatResults.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              لا توجد نتائج تطابق <span className="font-semibold text-foreground">"{query}"</span>
            </div>
          ) : (
            <div className="space-y-1 py-1">
              {flatResults.map((item, index) => {
                const Icon = item.icon || LayoutDashboard
                const isSelected = index === selectedIndex
                return (
                  <button
                    key={`${item.type}-${item.url}-${index}`}
                    type="button"
                    onClick={() => handleSelect(item.url)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start transition-colors ${
                      isSelected ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted/50 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg border ${
                          isSelected
                            ? 'border-primary/30 bg-primary/20 text-primary'
                            : 'border-border bg-muted/50 text-muted-foreground'
                        }`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate leading-tight">{item.title}</p>
                        {item.subtitle && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                        )}
                      </div>
                    </div>
                    {item.badge && <div className="shrink-0">{item.badge}</div>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ للتنقل</span>
            <span>↵ للاختيار</span>
          </div>
          <span>نسائم ليبيا — نظام الإدارة المتكامل</span>
        </div>
      </div>
    </div>
  )
}
