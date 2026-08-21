import { SlidersHorizontal, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { ProductGrid, ProductGridSkeleton } from '@/components/storefront/ProductGrid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select } from '@/components/ui/select'
import { formatNumber } from '@/lib/format'
import { useCategories, useCollections, useProducts } from '@/lib/queries/catalog'
import { useUrlState } from '@/lib/useUrlState'
import { cn } from '@/lib/utils'

export const SORT_OPTIONS = [
  { value: 'newest', label: 'الأحدث' },
  { value: 'price_asc', label: 'السعر: من الأقل' },
  { value: 'price_desc', label: 'السعر: من الأعلى' },
  { value: 'name', label: 'الاسم' },
] as const

export interface ProductListingProps {
  heading: string
  description?: ReactNode
  /** Query parameters fixed by the route — a category slug, a search term. */
  fixedParams?: Record<string, string | undefined>
  /** Category and collection pickers are hidden on a category/collection page. */
  showFacets?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

/**
 * The catalogue, shared by `/products`, `/categories/:slug`,
 * `/collections/:slug` and `/search`.
 *
 * **Every filter lives in the URL.** Results are shareable, the back button
 * works, and a refresh keeps the filters — the reference held them in component
 * state, so refreshing a filtered list silently reset it.
 */
export function ProductListing({
  heading,
  description,
  fixedParams = {},
  showFacets = true,
  emptyTitle = 'لا توجد منتجات مطابقة',
  emptyDescription = 'جرّب تعديل عوامل التصفية أو تصفّح كل المنتجات.',
}: ProductListingProps) {
  const { get, set } = useUrlState({ sort: 'newest', page: '1' })
  const [filtersOpen, setFiltersOpen] = useState(false)

  // `fixedParams` is spread LAST on purpose. Spreading it first let the facet
  // keys below overwrite it with `undefined`, and /categories/:slug quietly
  // listed the entire catalogue under the category's own heading.
  const params = {
    page: get('page') || '1',
    limit: '20',
    sort: get('sort') || 'newest',
    category: showFacets ? get('category') || undefined : undefined,
    collection: showFacets ? get('collection') || undefined : undefined,
    min_price: get('min_price') || undefined,
    max_price: get('max_price') || undefined,
    in_stock: get('in_stock') || undefined,
    ...fixedParams,
  }

  const { data, isPending, isError, error, refetch, isPlaceholderData } = useProducts(params)
  const products = data?.items ?? []
  const meta = data?.meta

  const activeFilters = [
    params.category,
    params.collection,
    params.min_price,
    params.max_price,
    params.in_stock,
  ].filter(Boolean).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="mb-4 space-y-1">
        <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        {meta ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {formatNumber(meta.total)} منتج
          </p>
        ) : null}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setFiltersOpen((open) => !open)}
          aria-expanded={filtersOpen}
          aria-controls="product-filters"
        >
          <SlidersHorizontal aria-hidden="true" />
          تصفية
          {activeFilters > 0 ? (
            <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {formatNumber(activeFilters)}
            </span>
          ) : null}
        </Button>

        <div className="ms-auto flex items-center gap-2">
          <label htmlFor="sort" className="text-sm text-muted-foreground">
            ترتيب
          </label>
          <Select
            id="sort"
            className="w-44"
            value={params.sort}
            onChange={(event) => set({ sort: event.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div
        id="product-filters"
        className={cn(
          'mb-6 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4',
          filtersOpen ? 'grid' : 'hidden',
        )}
      >
        {showFacets ? <FacetPickers get={get} set={set} /> : null}

        <Field label="أقل سعر" htmlFor="min_price">
          <Input
            id="min_price"
            type="number"
            inputMode="numeric"
            min={0}
            value={get('min_price')}
            onChange={(event) => set({ min_price: event.target.value })}
          />
        </Field>

        <Field label="أعلى سعر" htmlFor="max_price">
          <Input
            id="max_price"
            type="number"
            inputMode="numeric"
            min={0}
            value={get('max_price')}
            onChange={(event) => set({ max_price: event.target.value })}
          />
        </Field>

        <div className="flex items-end gap-3">
          <label className="flex h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={get('in_stock') === 'true'}
              onChange={(event) => set({ in_stock: event.target.checked ? 'true' : '' })}
            />
            المتوفر فقط
          </label>
          {activeFilters > 0 ? (
            <Button
              variant="ghost"
              onClick={() =>
                set({
                  category: '',
                  collection: '',
                  min_price: '',
                  max_price: '',
                  in_stock: '',
                })
              }
            >
              <X aria-hidden="true" />
              مسح الكل
            </Button>
          ) : null}
        </div>
      </div>

      {isPending ? (
        <>
          <span className="sr-only" role="status">
            جارٍ تحميل المنتجات…
          </span>
          <ProductGridSkeleton />
        </>
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : products.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Button asChild variant="outline">
              <Link to="/products">تصفّح كل المنتجات</Link>
            </Button>
          }
        />
      ) : (
        <div className={cn(isPlaceholderData && 'opacity-60 transition-opacity duration-200')}>
          <ProductGrid products={products} />
        </div>
      )}

      {meta ? (
        <Pagination
          page={meta.page}
          pages={meta.pages}
          total={meta.total}
          onPageChange={(page) => {
            set({ page: String(page) })
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      ) : null}
    </div>
  )
}

function FacetPickers({
  get,
  set,
}: {
  get: (key: string) => string
  set: (updates: Record<string, string>) => void
}) {
  const { data: categories } = useCategories()
  const { data: collections } = useCollections()

  return (
    <>
      <Field label="التصنيف" htmlFor="category">
        <Select
          id="category"
          value={get('category')}
          onChange={(event) => set({ category: event.target.value })}
        >
          <option value="">كل التصنيفات</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="المجموعة" htmlFor="collection">
        <Select
          id="collection"
          value={get('collection')}
          onChange={(event) => set({ collection: event.target.value })}
        >
          <option value="">كل المجموعات</option>
          {(collections ?? []).map((collection) => (
            <option key={collection.id} value={collection.slug}>
              {collection.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  )
}
