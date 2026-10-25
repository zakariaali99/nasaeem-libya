import { ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { t } from '@/lib/i18n'

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
    <nav className="flex items-center justify-between gap-3 pt-6" aria-label={t('pagination.label')}>
      <Button
        variant="outline"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={t('pagination.previousLabel')}
      >
        {/* The glyph mirrors with the document; the label carries the meaning. */}
        <ChevronRight className="rotate-180 rtl:-scale-x-100" aria-hidden="true" />
        {t('pagination.previous')}
      </Button>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('pagination.summary', { page: formatNumber(page), pages: formatNumber(pages), total: formatNumber(total) })}
      </p>

      <Button
        variant="outline"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
        aria-label={t('pagination.nextLabel')}
      >
        {t('pagination.next')}
        <ChevronRight className="rtl:-scale-x-100" aria-hidden="true" />
      </Button>
    </nav>
  )
}
