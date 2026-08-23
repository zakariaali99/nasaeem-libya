import { ChevronLeft, Home } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

const ROUTE_LABELS: Record<string, string> = {
  admin: 'لوحة التحكم',
  orders: 'الطلبات',
  products: 'المنتجات',
  new: 'جديد',
  variants: 'المتغيرات',
  categories: 'الأقسام والتصنيفات',
  collections: 'المجموعات',
  inventory: 'المخزون',
  logs: 'سجل الحركات',
  users: 'العملاء',
  discounts: 'كوبونات الخصم',
  cities: 'المدن والمناطق',
  delivery: 'شركات التوصيل',
  payment_methods: 'طرق الدفع',
  customization: 'تخصيص الواجهة',
}

export function Breadcrumbs({ className = '' }: { className?: string }) {
  const location = useLocation()
  const pathnames = location.pathname.split('/').filter(Boolean)

  // Only render on admin routes
  if (pathnames[0] !== 'admin') return null

  // If we are on /admin root
  if (pathnames.length === 1) {
    return (
      <nav aria-label="مسار التنقل" className={`flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
        <span className="flex items-center gap-1 font-semibold text-foreground">
          <Home className="size-3.5 text-primary" aria-hidden="true" />
          <span>لوحة التحكم الرئيسية</span>
        </span>
      </nav>
    )
  }

  const items = pathnames.map((segment, index) => {
    const url = `/${pathnames.slice(0, index + 1).join('/')}`
    const isLast = index === pathnames.length - 1
    const decodedSegment = decodeURIComponent(segment)
    const label = ROUTE_LABELS[segment] || decodedSegment

    return { url, label, isLast }
  })

  return (
    <nav aria-label="مسار التنقل" className={`flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto no-scrollbar py-1 ${className}`}>
      <Link
        to="/admin"
        className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors shrink-0"
      >
        <Home className="size-3.5" aria-hidden="true" />
        <span className="sr-only">الرئيسية</span>
      </Link>

      {items.slice(1).map((item) => (
        <div key={item.url} className="flex items-center gap-1 shrink-0">
          <ChevronLeft className="size-3 opacity-40 rtl:rotate-0" aria-hidden="true" />
          {item.isLast ? (
            <span className="font-semibold text-foreground max-w-48 truncate" aria-current="page">
              {item.label}
            </span>
          ) : (
            <Link
              to={item.url}
              className="text-muted-foreground hover:text-primary transition-colors max-w-36 truncate"
            >
              {item.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  )
}
