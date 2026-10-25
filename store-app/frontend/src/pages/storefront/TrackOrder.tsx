import { PackageSearch } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { StageBadge } from '@/components/admin/StatusBadge'
import { EmptyState } from '@/components/storefront/EmptyState'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LineThumb } from '@/components/ui/line-thumb'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice, formatShortDate } from '@/lib/format'
import { useTrackOrders } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'
import { t } from '@/lib/i18n'

/**
 * Anyone can look an order up by phone, order number, or both. The server
 * answers with tracking fields only — no name, phone or address.
 */
export default function TrackOrder() {
  usePageTitle(t('track.title'), t('track.metaDescription'))
  // Kept in the page, not the address bar: a phone number in the URL would
  // sit in browser history and server logs.
  const [query, setQuery] = useState({ phone: '', number: '' })
  const { phone, number } = query
  const [phoneInput, setPhoneInput] = useState('')
  const [numberInput, setNumberInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const { data, isFetching, error } = useTrackOrders({ phone, number })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextPhone = phoneInput.trim()
    const nextNumber = numberInput.trim()
    if (!nextPhone && !nextNumber) {
      setFormError(t('track.needInput'))
      return
    }
    setFormError(null)
    setQuery({ phone: nextPhone, number: nextNumber })
  }

  const searched = Boolean(phone || number)
  const orders = data ?? []

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">{t('track.title')}</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {t('track.intro')}
      </p>

      <form onSubmit={onSubmit} noValidate className="mb-8 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="track-phone">{t('track.phone')}</Label>
            <Input
              id="track-phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              className="text-start font-mono"
              placeholder="0912345678"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="track-number">{t('track.number')}</Label>
            <Input
              id="track-number"
              dir="ltr"
              className="text-start font-mono uppercase"
              placeholder="202610MAN0060"
              value={numberInput}
              onChange={(e) => setNumberInput(e.target.value)}
            />
          </div>
        </div>
        {formError ? <Alert tone="error">{formError}</Alert> : null}
        <Button type="submit" block size="lg" loading={isFetching} className="gap-2">
          <PackageSearch className="size-4" aria-hidden="true" />
          {t('track.search')}
        </Button>
      </form>

      {!searched ? null : isFetching && !data ? (
        <div className="space-y-3">
          {[0, 1].map((i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
      ) : error ? (
        <Alert tone="error">{error.message || t('track.failed')}</Alert>
      ) : orders.length === 0 ? (
        <EmptyState
          title={t('track.notFound')}
          description={t('track.notFoundText')}
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.order_number} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <bdi className="font-mono font-semibold">{order.order_number}</bdi>
                <StageBadge stage={order.stage} />
              </div>
              <div className="mt-1 flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatShortDate(order.created_at)}</span>
                <span className="font-semibold text-foreground">{formatPrice(order.total)}</span>
              </div>
              <ul className="mt-3 space-y-2 border-t border-border/60 pt-3 text-sm">
                {order.items.map((item, index) => (
                  <li key={index} className="flex items-center gap-2.5">
                    <LineThumb image={item.image} alt={item.product_name} size={40} />
                    <span className="min-w-0 flex-1 truncate">{item.product_name}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {item.variant_label ? `${item.variant_label} · ` : ''}×{item.quantity}
                    </span>
                  </li>
                ))}
              </ul>
              {order.tracking_url ? (
                <a
                  href={order.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  {t('track.courier')}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
