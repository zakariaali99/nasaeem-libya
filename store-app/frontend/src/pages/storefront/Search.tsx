import { Search as SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { FragranceFinderQuizModal } from '@/components/storefront/FragranceFinderQuizModal'
import { NotesBrowserBar } from '@/components/storefront/NotesBrowserBar'
import { EmptyState } from '@/components/storefront/EmptyState'
import { ProductListing } from '@/components/storefront/ProductListing'
import { SearchBox } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * New work, not a port: the reference had a search *button* and a panel, but no
 * results page at all (`reference/INVENTORY.md` §2).
 *
 * The query lives in `?q=`, so a search is shareable and survives a refresh.
 */
export default function SearchPage() {
  const [params] = useSearchParams()
  const [quizOpen, setQuizOpen] = useState(false)
  const term = (params.get('q') ?? '').trim()
  const { data: categories } = useCategories()

  usePageTitle(term ? `نتائج البحث عن ${term}` : 'البحث', 'ابحث في متجر نسائم ليبيا.')

  return (
    <div>
      <div className="border-b border-border bg-muted/40">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 space-y-4">
          <SearchBox autoFocus={!term} />
          <NotesBrowserBar
            currentQuery={term}
            onOpenFinder={() => setQuizOpen(true)}
          />
        </div>
      </div>

      <FragranceFinderQuizModal open={quizOpen} onClose={() => setQuizOpen(false)} />

      {term ? (
        <ProductListing
          heading={`نتائج البحث عن «${term}»`}
          fixedParams={{ search: term }}
          emptyTitle={`لم نجد نتائج لـ «${term}»`}
          emptyDescription="تحقّق من الإملاء، أو جرّب كلمة أقصر، أو تصفّح العلامات التجارية أدناه."
        />
      ) : (
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-10">
          <h1 className="sr-only">البحث</h1>
          <EmptyState
            icon={<SearchIcon className="size-8" aria-hidden="true" />}
            title="ابحث عن عطر أو علامة تجارية"
            description="اكتب اسم المنتج أو العلامة في الحقل أعلاه."
          />
          {(categories ?? []).length > 0 ? (
            <section>
              <h2 className="mb-3 text-lg font-semibold">تصفّح العلامات التجارية</h2>
              <ul className="flex flex-wrap gap-2">
                {(categories ?? []).map((category) => (
                  <li key={category.id}>
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/categories/${encodeURIComponent(category.slug)}`}>
                        {category.name}
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
