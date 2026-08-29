import { Boxes, Edit2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TBody, TD, TH, THead, TR, TableWrapper } from '@/components/ui/table'
import { formatNumber, formatPrice } from '@/lib/format'
import { useManageProductSizes, useProduct, useProductSizes } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { cn } from '@/lib/utils'

const PRESET_SIZES = ['30 مل', '50 مل', '75 مل', '100 مل', '125 مل', '150 مل', '200 مل', '250 مل']

export default function AdminProductVariantsPage() {
  const { productSlugOrId } = useParams()
  const product = useProduct(productSlugOrId)
  const productSizes = useProductSizes(product.data?.slug || productSlugOrId)
  const manageSizes = useManageProductSizes()

  usePageTitle(`سعات وأحجام ${product.data?.name || 'العطر'} — لوحة التحكم`)

  // New size form state
  const [newSize, setNewSize] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newComparePrice, setNewComparePrice] = useState('')
  const [newStock, setNewStock] = useState('10')
  const [newSku, setNewSku] = useState('')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Editing size state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editCompare, setEditCompare] = useState('')
  const [editStock, setEditStock] = useState('')

  if (product.isLoading || productSizes.isLoading) {
    return <Skeleton className="h-64 w-full max-w-4xl rounded-3xl" />
  }
  if (!product.data) {
    return <Alert tone="error">تعذّر تحميل المنتج أو أنه غير موجود.</Alert>
  }

  const sizesList = productSizes.data?.data ?? []
  const prodSlug = product.data.slug

  const handleAddSize = async (sizeName?: string) => {
    const sizeToAdd = (sizeName || newSize).trim()
    if (!sizeToAdd) {
      setErrorMessage('يرجى كتابة أو اختيار حجم السعة (مثال: 100 مل)')
      return
    }

    setErrorMessage(null)
    setStatusMessage(null)

    const effectivePrice = newPrice.trim() || product.data?.price || '0'
    const effectiveSku = newSku.trim() || `${product.data?.sku || 'NAS'}-${sizeToAdd.replace(/\s+/g, '')}`

    try {
      await manageSizes.mutateAsync({
        lookup: prodSlug,
        action: 'add_size',
        size: sizeToAdd,
        price: effectivePrice,
        compare_at_price: newComparePrice.trim() || null,
        stock: Number(newStock) || 0,
        sku: effectiveSku,
      })
      setStatusMessage(`تمت إضافة سعة ${sizeToAdd} بنجاح إلى العطر`)
      setNewSize('')
      setNewPrice('')
      setNewComparePrice('')
      setNewStock('10')
      setNewSku('')
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'حدث خطأ أثناء إضافة السعة')
    }
  }

  const handleDeleteSize = async (sizeName: string) => {
    if (!window.confirm(`هل أنت متأكد من رغبتك في حذف سعة ${sizeName} من هذا العطر؟`)) {
      return
    }
    const updated = sizesList.filter((s) => s.size !== sizeName)
    try {
      await manageSizes.mutateAsync({
        lookup: prodSlug,
        action: 'sync_sizes',
        sizes: updated,
      })
      setStatusMessage(`تم حذف سعة ${sizeName} بنجاح`)
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || err?.message || 'تعذّر حذف السعة')
    }
  }

  const handleToggleActive = async (item: any) => {
    const updated = sizesList.map((s) =>
      s.size === item.size ? { ...s, is_active: !s.is_active } : s
    )
    try {
      await manageSizes.mutateAsync({
        lookup: prodSlug,
        action: 'sync_sizes',
        sizes: updated,
      })
    } catch (err: any) {
      setErrorMessage('تعذّر تعديل حالة السعة')
    }
  }

  const handleSaveEdit = async (item: any) => {
    const updated = sizesList.map((s) => {
      if (s.size === item.size) {
        return {
          ...s,
          price: editPrice.trim() || s.price,
          compare_at_price: editCompare.trim() || null,
          stock: editStock !== '' ? Number(editStock) : s.stock,
        }
      }
      return s
    })

    try {
      await manageSizes.mutateAsync({
        lookup: prodSlug,
        action: 'sync_sizes',
        sizes: updated,
      })
      setEditingId(null)
      setStatusMessage(`تم تحديث بيانات سعة ${item.size} بنجاح`)
    } catch (err: any) {
      setErrorMessage('تعذّر حفظ التعديلات')
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`سعات وأحجام: ${product.data.name}`}
        description="إدارة جميع أحجام وسعات العطر بالـ مل (50 مل، 100 مل، 200 مل...) وتحديد أسعار ومخزون كل حجم."
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="rounded-xl font-bold">
              <Link to={`/admin/products/${encodeURIComponent(product.data.slug)}`}>
                العودة لبيانات العطر
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl font-bold">
              <Link to="/admin/inventory">
                <Boxes className="size-4 me-1 text-primary" />
                مستويات المخزون
              </Link>
            </Button>
          </div>
        }
      />

      {statusMessage && <Alert tone="success">{statusMessage}</Alert>}
      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

      {/* Add New Size Card */}
      <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="space-y-0.5">
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Plus className="size-5 text-primary" />
              إضافة سعة وحجم جديد للعطر (بالـ مل)
            </h2>
            <p className="text-xs text-muted-foreground">
              اختر إحدى السعات الشائعة أو اكتب سعة مخصصة وحدد سعرها ومخزونها.
            </p>
          </div>
        </div>

        {/* Quick Size Presets */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground block">
            السعات العطرية المقترحة (انقر للتعبئة الفورية):
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_SIZES.map((preset) => {
              const alreadyExists = sizesList.some((s) => s.size === preset)
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setNewSize(preset)
                    if (!newPrice) setNewPrice(product.data?.price || '')
                    if (!newSku) setNewSku(`${product.data?.sku || 'NAS'}-${preset.replace(/\s+/g, '')}`)
                  }}
                  className={cn(
                    'rounded-xl border px-3.5 py-1.5 text-xs font-bold transition-all',
                    alreadyExists
                      ? 'border-border/60 bg-muted/40 text-muted-foreground line-through opacity-60'
                      : newSize === preset
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border bg-background hover:border-primary hover:text-primary shadow-2xs'
                  )}
                >
                  {preset} {alreadyExists ? '(موجودة)' : ''}
                </button>
              )
            })}
          </div>
        </div>

        {/* Input Form Fields */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-size-input" className="text-xs font-bold">
              السعة / الحجم *
            </Label>
            <Input
              id="new-size-input"
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              placeholder="مثال: 100 مل، 50 مل"
              className="h-10 rounded-xl text-xs font-bold"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-price-input" className="text-xs font-bold">
              سعر البيع (د.ل) *
            </Label>
            <Input
              id="new-price-input"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={product.data.price || '0.00'}
              className="h-10 rounded-xl text-xs font-mono font-bold text-price"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-compare-input" className="text-xs font-bold">
              السعر قبل الخصم (اختياري)
            </Label>
            <Input
              id="new-compare-input"
              type="number"
              step="0.01"
              min="0"
              dir="ltr"
              value={newComparePrice}
              onChange={(e) => setNewComparePrice(e.target.value)}
              placeholder="0.00"
              className="h-10 rounded-xl text-xs font-mono text-muted-foreground"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-stock-input" className="text-xs font-bold">
              المخزون الأولي (قطعة) *
            </Label>
            <Input
              id="new-stock-input"
              type="number"
              min="0"
              dir="ltr"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="h-10 rounded-xl text-xs font-mono font-bold text-center"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-sku-input" className="text-xs font-bold">
              رمز SKU
            </Label>
            <Input
              id="new-sku-input"
              dir="ltr"
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder={`${product.data.sku || 'NAS'}-100ML`}
              className="h-10 rounded-xl text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            loading={manageSizes.isPending}
            onClick={() => handleAddSize()}
            className="rounded-xl font-bold px-6 h-10 shadow-sm"
          >
            <Plus className="size-4 me-1" />
            حفظ وإضافة هذه السعة
          </Button>
        </div>
      </section>

      {/* Existing Sizes Table */}
      <section className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div>
            <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
              <Boxes className="size-5 text-primary" />
              السعات المتاحة حالياً في المتجر ({formatNumber(sizesList.length)})
            </h2>
            <p className="text-xs text-muted-foreground">
              يمكنك تعديل أسعار أو مخزون أي سعة، أو تعطيلها مؤقتاً دون حذفها.
            </p>
          </div>
        </div>

        {sizesList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Boxes className="size-10 text-muted-foreground mx-auto opacity-50" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">
                لا توجد سعات مضافة لهذا العطر بعد
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                يُباع هذا العطر حالياً بحجم وحيد بسعر {formatPrice(product.data.price)}. أضف سعات بالـ مل أعلاه ليتمكن عملاؤك من اختيار الحجم المطلوب في المتجر.
              </p>
            </div>
          </div>
        ) : (
          <TableWrapper>
            <Table>
              <THead>
                <TR>
                  <TH>السعة / الحجم</TH>
                  <TH>رمز SKU</TH>
                  <TH>سعر البيع</TH>
                  <TH>السعر قبل الخصم</TH>
                  <TH>المخزون المتوفر</TH>
                  <TH className="text-center">الحالة</TH>
                  <TH className="text-end">الإجراءات</TH>
                </TR>
              </THead>
              <TBody>
                {sizesList.map((item) => {
                  const isEditing = editingId === item.id

                  return (
                    <TR key={item.id || item.size} className="hover:bg-muted/20">
                      <TD className="font-bold text-foreground flex items-center gap-2">
                        <span className="inline-flex items-center justify-center size-8 rounded-xl bg-primary/10 text-primary font-bold text-xs">
                          {item.size}
                        </span>
                      </TD>
                      <TD className="font-mono text-xs text-muted-foreground">
                        {item.sku || '—'}
                      </TD>
                      <TD>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            dir="ltr"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="h-8 text-xs font-mono font-bold w-24 text-price rounded-lg"
                          />
                        ) : (
                          <span className="font-bold text-price font-mono text-xs">
                            {formatPrice(item.price)}
                          </span>
                        )}
                      </TD>
                      <TD>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            dir="ltr"
                            value={editCompare}
                            onChange={(e) => setEditCompare(e.target.value)}
                            placeholder="0.00"
                            className="h-8 text-xs font-mono text-muted-foreground w-24 rounded-lg"
                          />
                        ) : item.compare_at_price ? (
                          <span className="line-through text-muted-foreground font-mono text-xs">
                            {formatPrice(item.compare_at_price)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TD>
                      <TD>
                        {isEditing ? (
                          <Input
                            type="number"
                            dir="ltr"
                            value={editStock}
                            onChange={(e) => setEditStock(e.target.value)}
                            className="h-8 text-xs font-mono font-bold w-20 rounded-lg text-center"
                          />
                        ) : (
                          <span
                            className={cn(
                              'font-mono text-xs font-bold px-2 py-0.5 rounded-md',
                              item.stock > 10
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : item.stock > 0
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-destructive/10 text-destructive'
                            )}
                          >
                            {formatNumber(item.stock)} قطعة
                          </span>
                        )}
                      </TD>
                      <TD className="text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(item)}
                          className={cn(
                            'px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-colors',
                            item.is_active
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-muted text-muted-foreground border-border hover:bg-muted/80'
                          )}
                        >
                          {item.is_active ? 'معروض للبيع' : 'معطل مؤقتاً'}
                        </button>
                      </TD>
                      <TD className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleSaveEdit(item)}
                                className="h-7 px-2.5 rounded-lg text-xs font-bold"
                              >
                                حفظ
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingId(null)}
                                className="h-7 px-2 rounded-lg text-xs"
                              >
                                إلغاء
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingId(item.id || item.size)
                                setEditPrice(item.price)
                                setEditCompare(item.compare_at_price || '')
                                setEditStock(String(item.stock))
                              }}
                              className="size-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                              title="تعديل السعر والمخزون"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteSize(item.size)}
                            className="size-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="حذف هذه السعة"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </TableWrapper>
        )}
      </section>
    </div>
  )
}
