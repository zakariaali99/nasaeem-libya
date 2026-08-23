import {
  ArrowLeft,
  Flame,
  FolderTree,
  Loader2,
  Package,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import * as React from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/format'
import { usePredictiveSearch } from '@/lib/queries/search'

interface InstantSearchModalProps {
  open: boolean
  onClose: () => void
}

export function InstantSearchModal({ open, onClose }: InstantSearchModalProps) {
  const [query, setQuery] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const { data: searchResults, isPending } = usePredictiveSearch(query)

  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [open])

  // Global shortcut (Cmd+K / Ctrl+K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
        else {
          // Open handled by parent or state
        }
      }
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const handleFullSearch = (q: string) => {
    if (!q.trim()) return
    onClose()
    navigate(`/search?q=${encodeURIComponent(q.trim())}`)
  }

  const trending = searchResults?.trending_keywords || [
    'عود ملكي فاخر',
    'عطور سهرات ومناسبات',
    'مسك أبيض بيور',
    'عطور صيفية منعشة',
  ]
  const products = searchResults?.products || []
  const categories = searchResults?.matched_categories || []
  const collections = searchResults?.matched_collections || []

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/80 p-4 pt-16 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl rounded-3xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-label="البحث اللحظي الفوري"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border p-4 px-5 bg-muted/20">
          <Search className="size-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFullSearch(query)
            }}
            placeholder="ابحث عن اسم العطر، الماركة، النوتة (مثل: عود، ديور، مسك)..."
            className="flex-1 bg-transparent text-sm sm:text-base font-medium text-foreground placeholder:text-muted-foreground outline-hidden"
          />
          {isPending && <Loader2 className="size-4 animate-spin text-primary shrink-0" />}
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="flex min-h-11 items-center px-2 text-muted-foreground hover:text-foreground"
              aria-label="مسح البحث"
            >
              <X className="size-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 items-center rounded-xl border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:text-foreground shadow-2xs"
          >
            إغلاق
          </button>
        </div>

        {/* Search Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Trending Suggestions */}
          {!query && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Flame className="size-4 text-primary" />
                <span>الكلمات الأكثر بحثاً ورواجاً:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {trending.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      setQuery(kw)
                      handleFullSearch(kw)
                    }}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-muted/30 px-3.5 py-2 text-xs font-bold text-foreground hover:border-primary hover:bg-primary/5 transition-colors shadow-2xs"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span>{kw}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Matched Categories & Collections */}
          {query && (categories.length > 0 || collections.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <FolderTree className="size-3.5" />
                <span>الأقسام والمجموعات المطابقة:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/categories/${cat.slug}`}
                    onClick={onClose}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                  >
                    <span>{cat.name}</span>
                  </Link>
                ))}
                {collections.map((col) => (
                  <Link
                    key={col.id}
                    to={`/collections/${col.slug}`}
                    onClick={onClose}
                    className="flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground hover:border-primary transition-colors"
                  >
                    <span>{col.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Instant Product Results */}
          {query && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">العطور المطابقة:</span>
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleFullSearch(query)}
                    className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <span>عرض كافة النتائج ({products.length})</span>
                    <ArrowLeft className="size-3" />
                  </button>
                )}
              </div>

              {products.length === 0 && !isPending && (
                <div className="text-center py-8 space-y-2">
                  <Package className="size-8 text-muted-foreground/50 mx-auto" />
                  <p className="text-sm font-bold text-foreground">لم يتم العثور على عطور تطابق "{query}"</p>
                  <p className="text-xs text-muted-foreground">جرب البحث بكلمات أخرى مثل "عود" أو "سوفاج" أو "أرماف"</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {products.map((p) => {
                  const img = p.images?.[0]?.url
                  return (
                    <Link
                      key={p.id}
                      to={`/products/${p.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2.5 hover:border-primary/50 hover:bg-primary/5 transition-all shadow-2xs group"
                    >
                      {img ? (
                        <img
                          src={img}
                          alt={p.name}
                          className="size-14 rounded-xl object-cover border border-border shrink-0"
                        />
                      ) : (
                        <div className="size-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0 border border-border">
                          <Package className="size-6" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h4 className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-black text-primary">
                            {formatPrice(p.price || '0')}
                          </span>
                          {p.compare_at_price && (
                            <span className="font-mono text-[10px] text-muted-foreground line-through">
                              {formatPrice(p.compare_at_price)}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground block truncate">
                          {p.categories?.[0]?.name || 'عطور فاخرة'}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer Full Search Button */}
        {query && products.length > 0 && (
          <div className="border-t border-border p-3 px-5 bg-muted/10 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">اضغط Enter للبحث المتقدم</span>
            <Button
              size="sm"
              onClick={() => handleFullSearch(query)}
              className="gap-1.5 rounded-xl font-bold text-xs"
            >
              <span>عرض جميع النتائج</span>
              <ArrowLeft className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
