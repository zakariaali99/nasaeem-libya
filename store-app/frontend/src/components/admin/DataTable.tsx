import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Inbox,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR, TableWrapper } from '@/components/ui/table'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

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

export interface FilterChip {
  id: string
  label: string
  count?: number
  active: boolean
  onClick: () => void
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

  /** Quick filter pill chips */
  filterChips?: FilterChip[]

  /** Optional full-row click handler */
  onRowClick?: (row: T) => void

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
  columns,
  rows,
  rowKey,
  isLoading = false,
  error = null,
  onRetry,
  page = 1,
  pages = 1,
  total,
  onPageChange,
  sort,
  onSortChange,
  search,
  onSearchChange,
  searchPlaceholder = 'ابحث…',
  filterChips,
  onRowClick,
  bulkActions,
  rowActions,
  toolbar,
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

  const columnMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!showColumns) return
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumns(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [showColumns])

  return (
    <div className="space-y-4">
      {/* Quick filter chips (if provided) */}
      {filterChips && filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-1">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.onClick}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shadow-2xs',
                chip.active
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
              )}
            >
              <span>{chip.label}</span>
              {chip.count !== undefined && (
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.2 text-[10px] font-mono',
                    chip.active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-foreground',
                  )}
                >
                  {formatNumber(chip.count)}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
        {onSearchChange ? (
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-48">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search ?? ''}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              className="ps-10 h-10 rounded-xl bg-card border-border shadow-2xs"
              aria-label={searchPlaceholder}
            />
          </div>
        ) : null}

        {toolbar}

        <div className="relative ms-auto" ref={columnMenuRef}>
          <Button
            variant="outline"
            size="icon"
            aria-label="إظهار وإخفاء الأعمدة"
            aria-expanded={showColumns}
            onClick={() => setShowColumns((open) => !open)}
            className="size-10 rounded-xl border-border bg-card shadow-2xs"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </Button>
          {showColumns ? (
            <div className="absolute end-0 top-full z-50 mt-2 w-56 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card p-3 shadow-xl backdrop-blur-md animate-fade-rise">
              <span className="text-xs font-bold text-foreground block mb-2 px-1">تخصيص الأعمدة:</span>
              <div className="space-y-1">
                {columns.map((column) => (
                  <label
                    key={column.key}
                    className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs font-medium hover:bg-muted transition-colors"
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
            </div>
          ) : null}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectable && selected.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3.5 shadow-xs animate-fade-rise">
          <div className="flex items-center gap-2.5">
            <Badge tone="primary" className="font-mono text-xs font-bold px-2.5 py-1">
              {formatNumber(selected.length)} محدد
            </Badge>
            <span className="text-xs text-muted-foreground">عناصر محددة من القائمة</span>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions?.(selected, clearSelection)}
            <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-xs font-semibold">
              إلغاء التحديد
            </Button>
          </div>
        </div>
      ) : null}

      {/* Table content */}
      {error ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
          <p className="text-sm font-semibold text-destructive">{error.message}</p>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry} className="rounded-xl">
              <RefreshCw className="size-4" aria-hidden="true" />
              <span>إعادة المحاولة</span>
            </Button>
          ) : null}
        </div>
      ) : isLoading ? (
        <LoadingRows columns={visible.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} />
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-12 text-center shadow-2xs">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Inbox className="size-6" aria-hidden="true" />
          </div>
          <h2 className="text-base font-bold text-foreground">{emptyTitle}</h2>
          <p className="max-w-sm text-xs text-muted-foreground">{emptyDescription}</p>
          {emptyAction}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <TableWrapper className="hidden md:block rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
            <Table>
              {caption ? <caption className="p-3 text-xs text-muted-foreground">{caption}</caption> : null}
              <THead className="bg-muted/40 border-b border-border">
                <TR className="hover:bg-transparent">
                  {selectable ? (
                    <TH className="w-12 text-center">
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
                    <TH
                      key={column.key}
                      style={column.width ? { width: column.width } : undefined}
                      className={cn('text-xs font-bold text-foreground py-3.5', column.align === 'end' && 'text-end')}
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column.key)}
                          className="inline-flex items-center gap-1.5 font-bold hover:text-primary transition-colors cursor-pointer"
                          aria-label={`ترتيب حسب ${column.header}`}
                        >
                          <span>{column.header}</span>
                          {sortIcon(column.key)}
                        </button>
                      ) : (
                        column.header
                      )}
                    </TH>
                  ))}
                  {rowActions ? <TH className="w-24 text-end text-xs font-bold">إجراءات</TH> : null}
                </TR>
              </THead>
              <TBody className="divide-y divide-border/60">
                {rows.map((row, index) => {
                  const id = rowKey(row)
                  const isSelected = selected.includes(id)
                  return (
                    <TR
                      key={id}
                      data-selected={isSelected || undefined}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        'row-hover transition-colors',
                        index % 2 === 1 && 'bg-muted/15',
                        isSelected && 'bg-primary/5',
                        onRowClick && 'cursor-pointer',
                      )}
                    >
                      {selectable ? (
                        <TD className="text-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
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
                        <TD
                          key={column.key}
                          className={cn('py-3.5 text-xs text-foreground', column.align === 'end' && 'text-end')}
                        >
                          {column.cell(row)}
                        </TD>
                      ))}
                      {rowActions ? (
                        <TD className="text-end py-3.5" onClick={(e) => e.stopPropagation()}>
                          {rowActions(row)}
                        </TD>
                      ) : null}
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableWrapper>

          {/* Mobile Card Layout */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => {
              const id = rowKey(row)
              const [first, ...rest] = visible
              return (
                <li
                  key={id}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'rounded-2xl border border-border bg-card p-4 shadow-2xs transition-all',
                    onRowClick && 'cursor-pointer active:scale-[0.99]',
                  )}
                >
                  <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                    <div className="min-w-0 flex-1 font-bold text-foreground text-sm">{first?.cell(row)}</div>
                    {rowActions ? <div className="shrink-0" onClick={(e) => e.stopPropagation()}>{rowActions(row)}</div> : null}
                  </div>
                  <dl className="mt-3 divide-y divide-border/40">
                    {rest.map((column) => (
                      <div key={column.key} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                        <dt className="text-muted-foreground font-medium">{column.header}</dt>
                        <dd className="text-foreground font-semibold text-end min-w-0 max-w-full">{column.cell(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* Pagination Bar */}
      {pages > 1 && onPageChange ? (
        <nav
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-2xs text-xs"
          aria-label="التنقل بين الصفحات"
        >
          <p className="text-muted-foreground font-medium">
            صفحة <span className="font-bold font-mono text-foreground">{formatNumber(page)}</span> من{' '}
            <span className="font-bold font-mono text-foreground">{formatNumber(pages)}</span>
            {total !== undefined ? ` · ${formatNumber(total)} عنصر إجمالاً` : ''}
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="h-8 rounded-lg text-xs font-semibold gap-1"
            >
              <ChevronRight className="size-3.5 rtl:rotate-0" />
              <span>السابق</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
              className="h-8 rounded-lg text-xs font-semibold gap-1"
            >
              <span>التالي</span>
              <ChevronLeft className="size-3.5 rtl:rotate-0" />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

function LoadingRows({ columns }: { columns: number }) {
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-2xs" role="status" aria-live="polite">
      <span className="sr-only">جارٍ تحميل البيانات…</span>
      {Array.from({ length: 6 }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 p-2">
          {Array.from({ length: Math.max(columns, 3) }).map((__, cellIndex) => (
            <Skeleton key={cellIndex} className="h-5 flex-1 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  )
}
