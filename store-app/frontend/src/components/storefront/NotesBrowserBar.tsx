import { Compass } from 'lucide-react'
import { Link } from '@/lib/i18nRouter'

import { useCategories } from '@/lib/queries/catalog'
import { t } from '@/lib/i18n'

interface NotesBrowserBarProps {
  onOpenFinder?: () => void
}

/**
 * Quick links above the search results: the fragrance guide and the store's
 * own categories.
 *
 * The chips used to be five scent families typed into this file, each running
 * a text search; one of them returned nothing. Categories always have a page.
 */
export function NotesBrowserBar({ onOpenFinder }: NotesBrowserBarProps) {
  const { data: categories } = useCategories()
  const chips = (categories ?? []).filter((category) => category.is_active !== false).slice(0, 12)

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      {onOpenFinder && (
        <button
          type="button"
          onClick={onOpenFinder}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2 text-xs font-black text-primary hover:bg-primary/20 transition-colors shadow-xs"
        >
          <Compass className="size-4" aria-hidden="true" />
          <span>{t('header.finder')}</span>
        </button>
      )}

      {chips.map((category) => (
        <Link
          key={category.id}
          to={`/categories/${encodeURIComponent(category.slug)}`}
          className="flex min-h-11 shrink-0 items-center rounded-2xl border border-border bg-card px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary/50 hover:bg-muted/30 shadow-2xs"
        >
          {category.name}
        </Link>
      ))}
    </div>
  )
}
