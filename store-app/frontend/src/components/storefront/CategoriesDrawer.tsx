import { useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft, FolderTree, LayoutGrid, Search } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useCategories } from '@/lib/queries/catalog'
import type { Category } from '@/types/api'

interface CategoriesDrawerProps {
  children?: React.ReactNode
}

export function CategoriesDrawer({ children }: CategoriesDrawerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})
  const { data: categories = [], isLoading } = useCategories()
  const [searchParams] = useSearchParams()
  const activeSlug = searchParams.get('category')

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Filter categories by search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    const term = search.trim().toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(term))
  }, [categories, search])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <button
            type="button"
            className="flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors hover:bg-muted text-foreground"
            aria-label="تصفح الأقسام والتصنيفات"
          >
            <LayoutGrid className="size-5 text-primary" />
            <span className="hidden sm:inline">الأقسام</span>
          </button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <FolderTree className="size-5" />
            </div>
            <div>
              <SheetTitle className="text-xl font-bold text-foreground">أقسام المتجر</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">تصفح تشكيلات العطور ومستحضرات التجميل</p>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث داخل الأقسام…"
              className="ps-9 h-10 rounded-full bg-muted/50 text-sm"
            />
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          <Link
            to="/products"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-foreground hover:bg-muted/70 transition-colors"
          >
            <span className="flex items-center gap-2.5">
              <LayoutGrid className="size-4 text-primary" />
              <span>جميع المنتجات</span>
            </span>
            <ChevronLeft className="size-4 text-muted-foreground" />
          </Link>

          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-muted/60 animate-pulse" />
              ))}
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              لا توجد أقسام مطابقة للبحث «{search}»
            </div>
          ) : (
            filteredCategories.map((cat: Category) => {
              const hasChildren = Boolean(cat.children && cat.children.length > 0)
              const isExpanded = Boolean(expandedIds[cat.id])
              const isActive = activeSlug === cat.slug

              return (
                <div key={cat.id} className="space-y-1">
                  <div
                    className={`group flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'text-foreground hover:bg-muted/70'
                    }`}
                  >
                    <Link
                      to={`/categories/${encodeURIComponent(cat.slug)}`}
                      onClick={() => setOpen(false)}
                      className="flex-1 flex items-center gap-2 min-w-0"
                    >
                      <span className="truncate">{cat.name}</span>
                      {hasChildren && (
                        <Badge tone="neutral" className="text-[10px] py-0 px-1.5 font-normal">
                          {cat.children!.length} فرعي
                        </Badge>
                      )}
                    </Link>

                    {hasChildren && (
                      <button
                        type="button"
                        onClick={(e) => toggleExpand(cat.id, e)}
                        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-colors"
                        aria-label={isExpanded ? 'طي القسم' : 'توسيع القسم'}
                      >
                        <ChevronDown
                          className={`size-4 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>

                  {hasChildren && isExpanded && (
                    <div className="ms-6 border-s-2 border-border/80 ps-2 space-y-1 py-1">
                      {cat.children!.map((sub) => (
                        <Link
                          key={sub.id}
                          to={`/categories/${encodeURIComponent(sub.slug)}`}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <span>{sub.name}</span>
                          <ChevronLeft className="size-3 text-muted-foreground/60" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="p-4 border-t border-border bg-muted/20">
          <Link
            to="/collections/new-arrivals"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-2 rounded-lg bg-primary/10 py-2.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
          >
            <span>✨ وصل حديثاً لموسم 2026</span>
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  )
}
