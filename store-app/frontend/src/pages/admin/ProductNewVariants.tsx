import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR, TableWrapper } from '@/components/ui/table'
import { useVariantOptions } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'

interface GeneratedRow {
  key: string
  label: string
  sku: string
  price: string
  stock: string
  enabled: boolean
}

export default function ProductNewVariantsPage() {
  usePageTitle('مصفوفة خيارات المنتج — لوحة التحكم')
  const navigate = useNavigate()
  const options = useVariantOptions()

  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const [basePrice, setBasePrice] = useState('100.00')
  const [baseStock, setBaseStock] = useState('10')
  const [skuPrefix, setSkuPrefix] = useState('NSM')
  const [generatedRows, setGeneratedRows] = useState<GeneratedRow[]>([])

  if (options.isLoading) {
    return <Skeleton className="h-64 w-full max-w-3xl" />
  }

  const toggleValue = (optionId: string, value: string) => {
    setPicked((current) => {
      const list = current[optionId] ?? []
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
      return { ...current, [optionId]: next }
    })
  }

  const handleGenerate = () => {
    const activeOptions = (options.data ?? []).filter((opt) => (picked[opt.id] ?? []).length > 0)
    if (activeOptions.length === 0) return

    // Cartesian product
    let combinations: string[][] = [[]]
    for (const opt of activeOptions) {
      const values = picked[opt.id] ?? []
      const next: string[][] = []
      for (const comb of combinations) {
        for (const val of values) {
          next.push([...comb, val])
        }
      }
      combinations = next
    }

    const rows: GeneratedRow[] = combinations.map((comb, index) => {
      const label = comb.join(' / ')
      const skuSuffix = comb.map((v) => v.slice(0, 3).toUpperCase()).join('-')
      return {
        key: String(index),
        label,
        sku: `${skuPrefix}-${skuSuffix}-${index + 1}`,
        price: basePrice,
        stock: baseStock,
        enabled: true,
      }
    })

    setGeneratedRows(rows)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="مُولّد مصفوفة الخيارات (Variant Matrix)"
        description="توليد وتخصيص تركيبات المتغيرات (مثل الأحجام والألوان) لحفظها مع المنتجات الجديدة."
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/products/new">العودة لإنشاء منتج</Link>
          </Button>
        }
      />

      <div className="space-y-6">
        <section className="space-y-4 rounded-lg border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground">1. اختر الخيارات والقيم</h2>

          {(options.data ?? []).length === 0 ? (
            <Alert tone="info">لا توجد خيارات معرّفة بعد في النظام.</Alert>
          ) : (
            <div className="space-y-4">
              {(options.data ?? []).map((opt) => (
                <div key={opt.id} className="space-y-2 border-b border-border pb-3 last:border-0">
                  <span className="font-semibold text-foreground">{opt.name}</span>
                  <div className="flex flex-wrap gap-2">
                    {opt.values.map((val) => {
                      const selected = (picked[opt.id] ?? []).includes(val.value)
                      return (
                        <button
                          key={val.id}
                          type="button"
                          onClick={() => toggleValue(opt.id, val.value)}
                          className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                            selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-background text-foreground hover:bg-muted'
                          }`}
                        >
                          {val.value}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-3 border-t border-border pt-4">
            <Field label="السعر الافتراضي لكل تركيبة" htmlFor="basePrice">
              <Input
                id="basePrice"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label="المخزون الافتراضي" htmlFor="baseStock">
              <Input
                id="baseStock"
                value={baseStock}
                onChange={(e) => setBaseStock(e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label="بادئة رمز الـ SKU" htmlFor="skuPrefix">
              <Input
                id="skuPrefix"
                value={skuPrefix}
                onChange={(e) => setSkuPrefix(e.target.value)}
                dir="ltr"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGenerate}>توليد التركيبات</Button>
          </div>
        </section>

        {generatedRows.length > 0 && (
          <section className="space-y-4 rounded-lg border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-foreground">2. مصفوفة التركيبات المولدة ({generatedRows.length})</h2>

            <TableWrapper>
              <Table>
                <THead>
                  <TR>
                    <TH className="w-12">تفعيل</TH>
                    <TH>التركيبة</TH>
                    <TH>رمز SKU</TH>
                    <TH>السعر (د.ل)</TH>
                    <TH>المخزون</TH>
                  </TR>
                </THead>
                <TBody>
                  {generatedRows.map((row, idx) => (
                    <TR key={row.key}>
                      <TD>
                        <Checkbox
                          checked={row.enabled}
                          onCheckedChange={(checked) => {
                            const updated = [...generatedRows]
                            updated[idx]!.enabled = Boolean(checked)
                            setGeneratedRows(updated)
                          }}
                        />
                      </TD>
                      <TD className="font-semibold text-foreground">{row.label}</TD>
                      <TD>
                        <Input
                          value={row.sku}
                          onChange={(e) => {
                            const updated = [...generatedRows]
                            updated[idx]!.sku = e.target.value
                            setGeneratedRows(updated)
                          }}
                          className="h-8 text-xs font-mono"
                          dir="ltr"
                        />
                      </TD>
                      <TD>
                        <Input
                          value={row.price}
                          onChange={(e) => {
                            const updated = [...generatedRows]
                            updated[idx]!.price = e.target.value
                            setGeneratedRows(updated)
                          }}
                          className="h-8 w-24 text-xs"
                          dir="ltr"
                        />
                      </TD>
                      <TD>
                        <Input
                          value={row.stock}
                          onChange={(e) => {
                            const updated = [...generatedRows]
                            updated[idx]!.stock = e.target.value
                            setGeneratedRows(updated)
                          }}
                          className="h-8 w-20 text-xs"
                          dir="ltr"
                        />
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableWrapper>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <Button asChild variant="outline">
                <Link to="/admin/products/new">العودة لنموذج المنتج</Link>
              </Button>
              <Button onClick={() => navigate('/admin/products/new')}>
                تطبيق وحفظ مع المنتج
              </Button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
