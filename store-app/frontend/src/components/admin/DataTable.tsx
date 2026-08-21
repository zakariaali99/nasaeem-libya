import { ChevronDown, ChevronUp, ChevronsUpDown, Inbox, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR, TableWrapper } from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The one table. 26 admin screens use it, so every capability lives here once:
 * sorting, search, server pagination, column visibility, bulk actions, row
 * actions, a designed empty state, a loading skeleton that matches the final
 * layout, and a card layout on mobile.
 *
 * If a screen finds itself overriding `className` to reshape this, the prop set
 * is wrong — fix it here rather than at the call site.
 */

export interface Column<T> {
  key: string
  header: string
  /** Cell renderer. Return a string/number for the mobile card layout to read. */
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  /** Hidden by default on narrow screens unless `primary`. */
  primary?: boolean
  align?: 'start' | 'end'
  width?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  isLoading?: boolean
  error?: { message: string } | null
  onRetry?: () => void

  /** Server pagination */
  page?: number
  pages?: number
  total?: number
  onPageChange?: (page: number) => void

  /** Server sorting */
  sort?: string
  onSortChange?: (sort: string) => void

  /** Server search */
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string

  /** Bulk actions appear once at least one row is selected. */
  bulkActions?: (selected: string[], clear: () => void) => React.ReactNode
  rowActions?: (row: T) => React.ReactNode
  toolbar?: React.ReactNode

  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  caption?: string
}

export function DataTable<T>({
  columns, rows, rowKey,
  isLoading = false, error = null, onRetry,
  page = 1, pages = 1, total, onPageChange,
  sort, onSortChange,
  search, onSearchChange, searchPlaceholder = 'ابحث…',
  bulkActions, rowActions, toolbar,
  emptyTitle = 'لا توجد نتائج',
  emptyDescription = 'لم نعثر على أي عناصر مطابقة.',
  emptyAction,
  caption,
}: DataTableProps<T>) {
  const [selected, setSelected] = React.useState<string[]>([])
  const [hidden, setHidden] = React.useState<string[]>([])
  const [showColumns, setShowColumns] = React.useState(false)

  const visible = columns.filter((c) => !hidden.includes(c.key))
  const selectable = Boolean(bulkActions)
  const allSelected = rows.length > 0 && selected.length === rows.length

  const clearSelection = React.useCallback(() => setSelected([]), [])

  React.useEffect(() => {
    setSelected([])
  }, [page, search, sort])

  const toggleSort = (key: string) => {
    if (!onSortChange) return
    onSortChange(sort === key ? `-${key}` : sort === `-${key}` ? key : key)
  }

  const sortIcon = (key: string) => {
    if (sort === key) return <ChevronUp className="size-4" aria-hidden="true" />
    if (sort === `-${key}`) return <ChevronDown className="size-4" aria-hidden="true" />
    return <ChevronsUpDown className="size-4 opacity-40" aria-hidden="true" />
  }

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {onSearchChange ? (
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search ?? ''}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="ps-11"
              aria-label={searchPlaceholder}
            />
          </div>
        ) : null}

        {toolbar}

        <div className="relative">
          <Button
            variant="outline"
            size="icon"
            aria-label="إظهار وإخفاء الأعمدة"
            aria-expanded={showColumns}
            onClick={() => setShowColumns((open) => !open)}
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
          {showColumns ? (
            <div className="absolute end-0 top-full z-20 mt-2 w-56 rounded-md border border-border bg-popover p-2 shadow-md">
              {columns.map((column) => (
                <label
                  key={column.key}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded px-2 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={!hidden.includes(column.key)}
                    onCheckedChange={(checked) =>
                      setHidden((current) =>
                        checked ? current.filter((k) => k !== column.key) : [...current, column.key],
                      )
                    }
                  />
                  <span>{column.header}</span>
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* bulk bar */}
      {selectable && selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3">
          <Badge tone="primary">{formatNumber(selected.length)} محدد</Badge>
          {bulkActions?.(selected, clearSelection)}
          <Button variant="ghost" onClick={clearSelection}>
            إلغاء التحديد
          </Button>
        </div>
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-10 text-center">
          <p className="text-base text-destructive">{error.message}</p>
          {onRetry ? (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw aria-hidden="true" />
              إعادة المحاولة
            </Button>
          ) : null}
        </div>
      ) : isLoading ? (
        <LoadingRows columns={visible.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-12 text-center">
          <Inbox className="size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-foreground">{emptyTitle}</h2>
          <p className="max-w-sm text-sm text-muted-foreground">{emptyDescription}</p>
          {emptyAction}
        </div>
      ) : (
        <>
          {/* desktop */}
          <TableWrapper className="hidden md:block">
            <Table>
              {caption ? <caption className="p-3 text-sm text-muted-foreground">{caption}</caption> : null}
              <THead>
                <TR>
                  {selectable ? (
                    <TH className="w-12">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(checked) =>
                          setSelected(checked ? rows.map(rowKey) : [])
                        }
                        aria-label="تحديد كل الصفوف"
                      />
                    </TH>
                  ) : null}
                  {visible.map((column) => (
                    <TH key={column.key} style={column.width ? { width: column.width } : undefined}>
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex min-h-11 items-center gap-1 font-medium hover:text-foreground"
                          aria-label={`ترتيب حسب ${column.header}`}
                        >
                          {column.header}
                          {sortIcon(column.key)}
                        </button>
                      ) : (
                        column.header
                      )}
                    </TH>
                  ))}
                  {rowActions ? <TH className="w-24 text-end">إجراءات</TH> : null}
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => {
                  const id = rowKey(row)
                  return (
                    <TR key={id} data-selected={selected.includes(id) || undefined}>
                      {selectable ? (
                        <TD>
                          <Checkbox
                            checked={selected.includes(id)}
                            onCheckedChange={(checked) =>
                              setSelected((current) =>
                                checked ? [...current, id] : current.filter((k) => k !== id),
                              )
                            }
                            aria-label="تحديد الصف"
                          />
                        </TD>
                      ) : null}
                      {visible.map((column) => (
                        <TD key={column.key} className={cn(column.align === 'end' && 'text-end')}>
                          {column.cell(row)}
                        </TD>
                      ))}
                      {rowActions ? <TD className="text-end">{rowActions(row)}</TD> : null}
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableWrapper>

          {/* mobile: a table at 390px is unusable, so each row becomes a card */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => {
              const id = rowKey(row)
              const [first, ...rest] = visible
              return (
                <li key={id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 font-medium text-foreground">{first?.cell(row)}</div>
                    {rowActions ? <div className="shrink-0">{rowActions(row)}</div> : null}
                  </div>
                  <dl className="mt-3 space-y-1.5">
                    {rest.map((column) => (
                      <div key={column.key} className="flex items-center justify-between gap-3 text-sm">
                        <dt className="text-muted-foreground">{column.header}</dt>
                        <dd className="text-foreground">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {pages > 1 && onPageChange ? (
        <nav className="flex items-center justify-between gap-3" aria-label="التنقل بين الصفحات">
          <p className="text-sm text-muted-foreground">
            صفحة {formatNumber(page)} من {formatNumber(pages)}
            {total !== undefined ? ` · ${formatNumber(total)} عنصر` : ''}
          </p>
          <div className="flex gap-2">
            {/* Default size (h-11), not `sm` (h-10). 07-design-system.md lists
                both `sm: h-10` and an absolute 44px minimum; where they conflict
                the minimum wins, because these are the primary touch targets on
                a paginated list. */}
            <Button variant="outline" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
              السابق
            </Button>
            <Button variant="outline" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
              التالي
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">جارٍ تحميل البيانات…</span>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: Math.max(columns, 3) }).map((__, cellIndex) => (
            <Skeleton key={cellIndex} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
