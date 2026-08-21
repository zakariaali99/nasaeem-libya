import { History, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable, type Column } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useAdjustInventory, useInventory } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import type { InventoryRow } from '@/types/api'

const REASONS = [
  ['restock', 'إعادة تخزين'],
  ['correction', 'تصحيح'],
  ['return', 'مرتجع'],
  ['manual', 'تعديل يدوي'],
] as const

interface AdjustTarget {
  productId: string
  variantId: string | null
  label: string
  current: number
}

export default function AdminInventoryPage() {
  usePageTitle('المخزون — لوحة التحكم')
  const { get, set } = useUrlState()
  const page = Number(get('page') || 1)
  const search = get('search')
  const lowOnly = get('low_stock') === '1'

  const query = useInventory({ page, search: search || undefined, low_stock: lowOnly ? 1 : undefined })
  const adjust = useAdjustInventory()

  const [target, setTarget] = useState<AdjustTarget | null>(null)
  const [change, setChange] = useState('1')
  const [reason, setReason] = useState<string>('restock')
  const [note, setNote] = useState('')

  const openAdjust = (next: AdjustTarget) => {
    setTarget(next)
    setChange('1')
    setReason('restock')
    setNote('')
  }

  const stockBadge = (available: number) =>
    available <= 0 ? (
      <Badge tone="danger">نفد</Badge>
    ) : available <= 5 ? (
      <Badge tone="warning">{formatNumber(available)}</Badge>
    ) : (
      <Badge tone="success">{formatNumber(available)}</Badge>
    )

  const columns: Column<InventoryRow>[] = [
    { key: 'name', header: 'المنتج', cell: (row) => <span className="font-medium text-foreground">{row.name}</span> },
    { key: 'sku', header: 'الرمز', cell: (row) => row.sku || '—' },
    { key: 'stock', header: 'المخزون', cell: (row) => formatNumber(row.stock) },
    { key: 'reserved', header: 'محجوز', cell: (row) => formatNumber(row.reserved_stock) },
    { key: 'available', header: 'المتاح', cell: (row) => stockBadge(row.available_stock) },
    {
      key: 'variants',
      header: 'الخيارات',
      cell: (row) =>
        row.variants.length === 0 ? (
          '—'
        ) : (
          <ul className="space-y-1">
            {row.variants.map((variant) => (
              <li key={variant.variant_id} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{variant.label || variant.sku}</span>
                {stockBadge(variant.available_stock)}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`تعديل مخزون ${variant.label || variant.sku}`}
                  onClick={() =>
                    openAdjust({
                      productId: row.product_id,
                      variantId: variant.variant_id,
                      label: `${row.name} — ${variant.label || variant.sku}`,
                      current: variant.stock,
                    })
                  }
                >
                  <Plus aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
        ),
    },
  ]

  const apiError = adjust.error instanceof ApiError ? adjust.error.message : null

  return (
    <>
      <PageHeader
        title="المخزون"
        description="المتاح = المخزون − المحجوز. كل تعديل يُسجَّل في سجل المخزون."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/inventory/logs">
              <History aria-hidden="true" />
              سجل المخزون
            </Link>
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={(row) => row.product_id}
        isLoading={query.isLoading}
        error={query.error ? { message: 'تعذّر تحميل المخزون' } : null}
        onRetry={() => query.refetch()}
        page={page}
        pages={query.data?.meta?.pages ?? 1}
        total={query.data?.meta?.total}
        onPageChange={(next) => set({ page: next })}
        search={search}
        onSearchChange={(value) => set({ search: value })}
        searchPlaceholder="ابحث عن منتج…"
        toolbar={
          <Button
            variant={lowOnly ? 'default' : 'outline'}
            aria-pressed={lowOnly}
            onClick={() => set({ low_stock: lowOnly ? '' : '1' })}
          >
            المخزون المنخفض فقط
          </Button>
        }
        emptyTitle="لا توجد منتجات متتبَّعة"
        emptyDescription="فعّل «تتبّع الكمية» على منتج ليظهر هنا."
        rowActions={(row) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`زيادة مخزون ${row.name}`}
              disabled={row.has_variants}
              onClick={() =>
                openAdjust({ productId: row.product_id, variantId: null, label: row.name, current: row.stock })
              }
            >
              <Plus aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`إنقاص مخزون ${row.name}`}
              disabled={row.has_variants}
              onClick={() => {
                openAdjust({ productId: row.product_id, variantId: null, label: row.name, current: row.stock })
                setChange('-1')
              }}
            >
              <Minus aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogTitle>تعديل المخزون</DialogTitle>
          <DialogDescription>
            {target?.label} — المخزون الحالي {formatNumber(target?.current ?? 0)}
          </DialogDescription>

          <div className="mt-4 space-y-4">
            {apiError ? <Alert tone="error">{apiError}</Alert> : null}

            <Field id="adj-change" label="التغيير" hint="استخدم قيمة سالبة للإنقاص، مثل 3-">
              {(field) => (
                <Input
                  {...field}
                  value={change}
                  onChange={(event) => setChange(event.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className="text-start"
                />
              )}
            </Field>

            <Field id="adj-reason" label="السبب">
              {(field) => (
                <Select {...field} value={reason} onChange={(event) => setReason(event.target.value)}>
                  {REASONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field id="adj-note" label="ملاحظة">
              {(field) => (
                <Textarea {...field} rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              )}
            </Field>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setTarget(null)}>
              إلغاء
            </Button>
            <Button
              loading={adjust.isPending}
              disabled={!Number(change)}
              onClick={async () => {
                if (!target) return
                await adjust.mutateAsync({
                  product_id: target.productId,
                  variant_id: target.variantId,
                  change: Number(change),
                  reason,
                  note,
                })
                setTarget(null)
              }}
            >
              تطبيق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
