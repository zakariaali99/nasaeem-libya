import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'

export interface PaginationProps {
  page: number
  pages: number
  total: number
  onPageChange: (page: number) => void
}

/**
 * Server pagination. Both controls are ≥ 44×44 px — on a paginated list these
 * are the primary touch targets, and `07-design-system.md` contradicts itself
 * by specifying both `sm: h-10` and a 44 px floor. The floor wins.
 */
export function Pagination({ page, pages, total, onPageChange }: PaginationProps) {
  if (pages <= 1) return null

  return (
    <nav className="flex items-center justify-between gap-3 pt-6" aria-label="التنقّل بين الصفحات">
      <Button
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="الصفحة السابقة"
      >
        {/* The glyph mirrors with the document; the label carries the meaning. */}
        <ChevronRight className="rotate-180 rtl:-scale-x-100" aria-hidden="true" />
        السابق
      </Button>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        صفحة {formatNumber(page)} من {formatNumber(pages)} · {formatNumber(total)} منتج
      </p>

      <Button
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        aria-label="الصفحة التالية"
      >
        التالي
        <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
      </Button>
    </nav>
  )
}
