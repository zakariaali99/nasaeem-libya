/**
 * The single source of formatting for money, numbers and dates.
 *
 * Digit system: Western (0123456789). Recorded in store/IMPLEMENTATION.md §0 —
 * Libya's CLDR locale resolves to `latn`, and the reference rendered Western
 * digits throughout.
 *
 * Note we do NOT use `Intl.NumberFormat('ar-LY')` directly: it renders
 * `12.345,5` (dot as thousands separator, comma as decimal), which reads as
 * wrong next to a د.ل price, and the reference's `minimumFractionDigits: 0`
 * displayed 10.50 د.ل as "11 د.ل".
 */

export const CURRENCY_SYMBOL = 'د.ل'

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const moneyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  let str = String(value).trim()
  str = str.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  str = str.replace(/،/g, '.').replace(/,/g, '.')
  const parsed = Number(str)
  return Number.isFinite(parsed) ? parsed : 0
}

/** `1,234.50 د.ل` — every price in the app goes through this. */
export function formatPrice(value: number | string | null | undefined): string {
  return `${moneyFormatter.format(toNumber(value))} ${CURRENCY_SYMBOL}`
}

/** Money with no currency symbol, for inputs and table cells that label it. */
export function formatAmount(value: number | string | null | undefined): string {
  return moneyFormatter.format(toNumber(value))
}

/** Counts, quantities, stock levels. */
export function formatNumber(value: number | string | null | undefined): string {
  return numberFormatter.format(toNumber(value))
}

/** `٪20` reads badly; percentages stay Western too: `20%`. */
export function formatPercent(value: number | string | null | undefined): string {
  return `${numberFormatter.format(toNumber(value))}%`
}

const dateFormatter = new Intl.DateTimeFormat('ar-LY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  numberingSystem: 'latn',
})

const dateTimeFormatter = new Intl.DateTimeFormat('ar-LY', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  numberingSystem: 'latn',
})

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateTimeFormatter.format(date)
}

/**
 * The discount percentage shown on a badge, derived from the two prices it sits
 * next to — never passed in separately. The reference showed a "20% off" badge
 * beside an undiscounted price because the badge had its own source of truth.
 */
export function discountPercent(
  price: number | string | null | undefined,
  compareAtPrice: number | string | null | undefined,
): number | null {
  const current = toNumber(price)
  const was = toNumber(compareAtPrice)
  if (was <= 0 || current <= 0 || current >= was) return null
  return Math.round(((was - current) / was) * 100)
}
