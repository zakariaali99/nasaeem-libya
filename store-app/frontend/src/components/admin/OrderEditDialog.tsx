import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { LineThumb } from '@/components/ui/line-thumb'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { FEATURES } from '@/lib/features'
import { formatPrice } from '@/lib/format'
import { useProducts } from '@/lib/queries/catalog'
import { useCities, useDeliveryMethods, useRegions } from '@/lib/queries/delivery'
import { useEditOrder, type OrderEditBody } from '@/lib/queries/orders'
import { cn } from '@/lib/utils'
import type { Order, Product, ProductImage, VariantChoice } from '@/types/api'

/** One row of the basket being edited. `id` is set for lines already on the
 * order (their price is the one the customer was quoted); new rows have none. */
interface EditLine {
  key: string
  id?: string
  productId?: string
  variantId?: string | null
  name: string
  variantLabel: string
  unitPrice: number
  quantity: number
  image: ProductImage | null
}

interface OrderEditDialogProps {
  order: Order
  lookup: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function linesFromOrder(order: Order): EditLine[] {
  return (order.items ?? []).map((item) => ({
    key: item.id,
    id: item.id,
    name: item.product_name,
    variantLabel: item.variant_label,
    unitPrice: Number(item.unit_price),
    quantity: item.quantity,
    image: item.image,
  }))
}

export function OrderEditDialog({ order, lookup, open, onOpenChange }: OrderEditDialogProps) {
  const edit = useEditOrder(order.id, lookup)
  const [lines, setLines] = React.useState<EditLine[]>(() => linesFromOrder(order))
  const [cityId, setCityId] = React.useState(order.shipping_city ?? '')
  const [regionId, setRegionId] = React.useState(order.shipping_region ?? '')
  const [address, setAddress] = React.useState(order.shipping_address ?? '')
  const [notes, setNotes] = React.useState(order.customer_notes ?? '')
  const [methodCode, setMethodCode] = React.useState('')
  const [shippingFee, setShippingFee] = React.useState(order.shipping_total ?? '')
  const [error, setError] = React.useState<string | null>(null)

  const { data: cityData } = useCities()
  const { data: regionData } = useRegions(cityId || undefined)
  const { data: methods } = useDeliveryMethods()
  const cities = cityData?.cities ?? []
  const regions = regionData?.regions ?? []

  // Fresh state from the order every time the dialog opens, so a cancelled
  // edit never leaks into the next one.
  React.useEffect(() => {
    if (!open) return
    setLines(linesFromOrder(order))
    setCityId(order.shipping_city ?? '')
    setRegionId(order.shipping_region ?? '')
    setAddress(order.shipping_address ?? '')
    setNotes(order.customer_notes ?? '')
    setShippingFee(order.shipping_total ?? '')
    setError(null)
  }, [open, order])

  React.useEffect(() => {
    if (!methods) return
    setMethodCode(methods.find((m) => m.id === order.delivery_method)?.code ?? '')
  }, [methods, order.delivery_method, open])

  const setQuantity = (key: string, quantity: number) =>
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, quantity: Math.min(Math.max(quantity, 1), 999) } : line)),
    )
  const removeLine = (key: string) => setLines((prev) => prev.filter((line) => line.key !== key))

  const addProduct = (product: Product, choice?: VariantChoice) => {
    const variantId = choice?.id ?? null
    setLines((prev) => {
      const same = prev.find((line) => !line.id && line.productId === product.id && line.variantId === variantId)
      if (same) return prev.map((line) => (line === same ? { ...line, quantity: line.quantity + 1 } : line))
      return [
        ...prev,
        {
          key: `new-${product.id}-${variantId ?? 'base'}`,
          productId: product.id,
          variantId,
          name: product.name,
          variantLabel: choice?.label ?? '',
          unitPrice: Number(choice?.price ?? product.price),
          quantity: 1,
          image: product.images?.[0] ?? null,
        },
      ]
    })
  }

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)

  const save = () => {
    setError(null)
    if (lines.length === 0) {
      setError('يجب أن يحتوي الطلب على صنف واحد على الأقل')
      return
    }
    const body: OrderEditBody = {
      items: lines.map((line) =>
        line.id
          ? { id: line.id, quantity: line.quantity }
          : { product_id: line.productId, variant_id: line.variantId, quantity: line.quantity },
      ),
      customer_notes: notes,
    }
    if (cityId) body.city_id = cityId
    if (regionId) body.region_id = regionId
    if (address.trim()) body.address = address
    if (FEATURES.shipping && methodCode) body.delivery_method_code = methodCode
    // Sent only when the operator changed it, so an untouched field never
    // overrides a fee the system computed.
    if (FEATURES.shipping && shippingFee.trim() !== '' && Number(shippingFee) !== Number(order.shipping_total)) {
      body.shipping_total = shippingFee.trim()
    }
    edit.mutate(body, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => setError(err instanceof ApiError ? err.message : 'تعذّر حفظ التعديلات'),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl min-w-0 p-0">
        <div className="max-h-[85vh] overflow-y-auto p-5 sm:p-6 space-y-5">
          <div className="pe-10">
            <DialogTitle>تعديل الطلب #{order.order_number}</DialogTitle>
            <DialogDescription>
              غيّر الكميات أو أضف منتجاً أو احذفه، وعدّل عنوان العميل. يُعاد حساب المجموع والمخزون تلقائياً عند الحفظ.
            </DialogDescription>
          </div>

          {/* Lines */}
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-foreground">الأصناف</h3>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {lines.map((line) => (
                <li key={line.key} className="flex flex-wrap items-center gap-3 p-3">
                  <LineThumb image={line.image} alt={line.name} size={48} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="truncate text-sm font-bold text-foreground">
                      {line.name}
                      {!line.id && (
                        <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">جديد</span>
                      )}
                    </p>
                    {line.variantLabel && <p className="text-xs text-muted-foreground">{line.variantLabel}</p>}
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {formatPrice(line.unitPrice)} × {line.quantity} = {formatPrice(line.unitPrice * line.quantity)}
                    </p>
                  </div>
                  <div className="ms-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-9 p-0"
                      aria-label="إنقاص الكمية"
                      disabled={line.quantity <= 1}
                      onClick={() => setQuantity(line.key, line.quantity - 1)}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={999}
                      value={line.quantity}
                      onChange={(e) => setQuantity(line.key, Number(e.target.value) || 1)}
                      className="h-9 w-14 px-1 text-center font-mono text-sm"
                      aria-label={`كمية ${line.name}`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-9 p-0"
                      aria-label="زيادة الكمية"
                      onClick={() => setQuantity(line.key, line.quantity + 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="size-9 p-0 text-destructive border-destructive/30 hover:bg-destructive/10"
                      aria-label={`حذف ${line.name}`}
                      onClick={() => removeLine(line.key)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
              {lines.length === 0 && (
                <li className="p-4 text-center text-xs text-muted-foreground">لا توجد أصناف — أضف منتجاً من البحث أدناه.</li>
              )}
            </ul>
            <ProductPicker onPick={addProduct} />
          </section>

          {/* Destination */}
          <section className="grid gap-3 sm:grid-cols-2">
            <Field id="edit-city" label="المدينة">
              <Select
                id="edit-city"
                value={cityId}
                onChange={(e) => {
                  setCityId(e.target.value)
                  setRegionId('')
                }}
              >
                <option value="">— اختر المدينة —</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </Select>
            </Field>
            <Field id="edit-region" label="المنطقة (اختياري)">
              <Select
                id="edit-region"
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                disabled={!cityId || regions.length === 0}
              >
                <option value="">— بدون منطقة —</option>
                {regions.map((region) => (
                  <option key={region.id} value={region.id}>{region.name}</option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field id="edit-address" label="العنوان التفصيلي">
                <Textarea id="edit-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
            </div>
            {FEATURES.shipping && (
              <>
                <Field id="edit-method" label="شركة التوصيل">
                  <Select id="edit-method" value={methodCode} onChange={(e) => setMethodCode(e.target.value)}>
                    <option value="">— بدون تغيير —</option>
                    {(methods ?? []).map((m) => (
                      <option key={m.code} value={m.code}>{m.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field
                  id="edit-shipping"
                  label="سعر التوصيل المتفق عليه (د.ل)"
                  hint="يُضاف إلى إجمالي الطلب والفاتورة ومبلغ التحصيل عند المندوب."
                >
                  <Input
                    id="edit-shipping"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.5"
                    dir="ltr"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    className="font-mono"
                  />
                </Field>
              </>
            )}
            <Field id="edit-notes" label="ملاحظات العميل">
              <Textarea id="edit-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </section>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              المجموع الفرعي الجديد (تقديري):{' '}
              <span className="font-mono text-sm font-extrabold text-foreground">
                {formatPrice(subtotal + (FEATURES.shipping ? Number(shippingFee) || 0 : 0))}
              </span>
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button type="button" loading={edit.isPending} onClick={save}>
                حفظ التعديلات
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Server-side product search (the whole catalogue, not a first page), with
 * the sizes from the list payload so a sized perfume is added in one tap. */
function ProductPicker({ onPick }: { onPick: (product: Product, choice?: VariantChoice) => void }) {
  const [query, setQuery] = React.useState('')
  const [term, setTerm] = React.useState('')

  React.useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300)
    return () => clearTimeout(timer)
  }, [query])

  const { data, isFetching } = useProducts(
    { search: term, limit: 8, is_active: true },
    { enabled: term.length >= 2 },
  )
  const results = term.length >= 2 ? data?.items ?? [] : []

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute start-3 top-3 size-4 text-muted-foreground" aria-hidden="true" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="أضف منتجاً: اكتب اسم العطر أو رمزه…"
          className="ps-9"
          aria-label="البحث عن منتج لإضافته"
        />
      </div>
      {term.length >= 2 && (
        <ul className="max-h-64 overflow-y-auto rounded-2xl border border-border divide-y divide-border">
          {results.map((product) => {
            const choices = product.variant_choices ?? []
            const outOfStock = !product.in_stock
            return (
              <li key={product.id} className="flex flex-wrap items-center gap-3 p-2.5">
                <LineThumb image={product.images?.[0]} alt={product.name} size={40} />
                <div className="min-w-0 flex-1 basis-32">
                  <p className="truncate text-sm font-bold text-foreground">{product.name}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {formatPrice(product.price)}
                    {outOfStock && <span className="ms-2 text-destructive">نفد المخزون</span>}
                  </p>
                </div>
                {product.has_variants && choices.length > 0 ? (
                  <div className="ms-auto flex flex-wrap justify-end gap-1.5">
                    {choices.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={!choice.in_stock}
                        onClick={() => onPick(product, choice)}
                        className={cn(
                          'rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors',
                          choice.in_stock
                            ? 'border-primary/40 text-primary hover:bg-primary/10'
                            : 'border-border text-muted-foreground line-through opacity-60',
                        )}
                      >
                        + {choice.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="ms-auto"
                    disabled={outOfStock}
                    onClick={() => onPick(product)}
                  >
                    <Plus className="size-4 me-1" /> إضافة
                  </Button>
                )}
              </li>
            )
          })}
          {!isFetching && results.length === 0 && (
            <li className="p-3 text-center text-xs text-muted-foreground">لا توجد نتائج مطابقة</li>
          )}
        </ul>
      )}
    </div>
  )
}
