import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR, TableWrapper } from '@/components/ui/table'
import { formatNumber, formatPrice } from '@/lib/format'
import { useGenerateVariantMatrix, useProduct, useVariantOptions } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * The variant matrix builder: pick values per option, generate every
 * combination, then set price/SKU/stock per row.
 */
export default function AdminProductVariantsPage() {
  usePageTitle('خيارات المنتج — لوحة التحكم')
  const { productSlugOrId } = useParams()
  const product = useProduct(productSlugOrId)
  const options = useVariantOptions()
  const generate = useGenerateVariantMatrix()

  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [defaultStock, setDefaultStock] = useState('0')

  if (product.isLoading || options.isLoading) {
    return <Skeleton className="h-64 w-full max-w-3xl" />
  }
  if (!product.data) {
    return <Alert tone="error">تعذّر تحميل المنتج.</Alert>
  }

  const combinations = Object.values(picked).filter((v) => v.length > 0)
  const expected = combinations.reduce((total, values) => total * values.length, 1)
  const variants = product.data.variants ?? []

  return (
    <>
      <PageHeader
        title={`خيارات: ${product.data.name}`}
        description="اختر القيم ثم ولّد كل التركيبات، وعدّل السعر والمخزون لكل تركيبة."
        actions={
          <Button asChild variant="outline">
            <Link to={`/admin/products/${encodeURIComponent(product.data.slug)}`}>العودة للمنتج</Link>
          </Button>
        }
      />

      <div className="max-w-3xl space-y-6">
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">اختر القيم</h2>

          {options.data?.length === 0 ? (
            <Alert tone="info">
              لا توجد خيارات معرّفة بعد. أنشئ خياراً مثل «الحجم» أو «اللون» أولاً من إعدادات الخيارات.
            </Alert>
          ) : (
            options.data?.map((option) => (
              <fieldset key={option.id} className="space-y-2">
                <legend className="text-sm font-medium text-foreground">{option.name}</legend>
                <div className="flex flex-wrap gap-2">
                  {option.values.map((value) => {
                    const active = picked[option.id]?.includes(value.id) ?? false
                    return (
                      <button
                        key={value.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setPicked((current) => {
                            const existing = current[option.id] ?? []
                            return {
                              ...current,
                              [option.id]: active
                                ? existing.filter((id) => id !== value.id)
                                : [...existing, value.id],
                            }
                          })
                        }
                        className={
                          active
                            ? 'min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground'
                            : 'min-h-11 rounded-full border border-input px-4 text-sm text-muted-foreground hover:bg-muted'
                        }
                      >
                        {value.value}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            ))
          )}

          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40 space-y-2">
              <Label htmlFor="default-stock">المخزون الافتراضي</Label>
              <Input
                id="default-stock"
                value={defaultStock}
                onChange={(event) => setDefaultStock(event.target.value)}
                inputMode="numeric"
                dir="ltr"
                className="text-start"
              />
            </div>
            <Button
              loading={generate.isPending}
              disabled={combinations.length === 0}
              onClick={() =>
                generate.mutate({
                  lookup: product.data!.slug,
                  value_groups: combinations,
                  defaults: { stock: Number(defaultStock) || 0 },
                })
              }
            >
              توليد {combinations.length > 0 ? formatNumber(expected) : ''} تركيبة
            </Button>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            الخيارات الحالية ({formatNumber(variants.length)})
          </h2>

          {variants.length === 0 ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">
                لا توجد خيارات بعد. اختر القيم أعلاه ثم اضغط «توليد».
              </p>
            </div>
          ) : (
            <TableWrapper>
              <Table>
                <THead>
                  <TR>
                    <TH>التركيبة</TH>
                    <TH>الرمز</TH>
                    <TH>السعر</TH>
                    <TH>المخزون</TH>
                    <TH>الحالة</TH>
                  </TR>
                </THead>
                <TBody>
                  {variants.map((variant) => (
                    <TR key={variant.id}>
                      <TD className="font-medium text-foreground">
                        {variant.values.map((v) => v.value).join(' / ') || '—'}
                      </TD>
                      <TD>{variant.sku || '—'}</TD>
                      <TD className="text-price">{variant.price ? formatPrice(variant.price) : '—'}</TD>
                      <TD>{formatNumber(variant.available_stock)}</TD>
                      <TD>
                        {variant.is_active ? (
                          <Badge tone="success">مفعّل</Badge>
                        ) : (
                          <Badge tone="neutral">موقوف</Badge>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>
          )}
        </section>
      </div>
    </>
  )
}
