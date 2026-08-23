import {
  Check,
  Loader2,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Truck,
  User,
  Zap,
} from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { formatPrice } from '@/lib/format'
import { useProducts } from '@/lib/queries/catalog'
import { useCities, useDeliveryMethods, useRegions } from '@/lib/queries/delivery'
import {
  CustomerLookupResult,
  useActiveCartPromotion,
  useCustomerLookup,
  useQuickCreateOrder,
} from '@/lib/queries/orders'
import type { Product, ProductVariant } from '@/types/api'

interface SelectedLineItem {
  product: Product
  variant?: ProductVariant
  quantity: number
  unitPrice: number
}

interface QuickOrderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickOrderModal({ open, onOpenChange }: QuickOrderModalProps) {
  const navigate = useNavigate()

  // Form states
  const [customerPhone, setCustomerPhone] = React.useState('')
  const [customerName, setCustomerName] = React.useState('')
  const [customerEmail, setCustomerEmail] = React.useState('')
  const [shippingCityId, setShippingCityId] = React.useState('')
  const [shippingRegionId, setShippingRegionId] = React.useState('')
  const [shippingAddress, setShippingAddress] = React.useState('')
  const [deliveryMethodCode, setDeliveryMethodCode] = React.useState('')
  const [paymentMethodCode, setPaymentMethodCode] = React.useState('manual_payment')
  const [discountCode, setDiscountCode] = React.useState('')
  const [customerNotes, setCustomerNotes] = React.useState('')
  const [selectedItems, setSelectedItems] = React.useState<SelectedLineItem[]>([])
  const [formError, setFormError] = React.useState<string | null>(null)

  // Product search combobox state
  const [productQuery, setProductQuery] = React.useState('')
  const [productSearchFocused, setProductSearchFocused] = React.useState(false)

  // Queries
  const { data: customerResults } = useCustomerLookup(customerPhone)
  const { data: productsData } = useProducts({ is_active: true, limit: 100 })
  const { data: cityData } = useCities()
  const { data: regionData } = useRegions(shippingCityId || undefined)
  const { data: deliveryMethods } = useDeliveryMethods()
  const { data: promo } = useActiveCartPromotion()
  const quickCreate = useQuickCreateOrder()

  const cities = cityData?.cities ?? []
  const regions = regionData?.regions ?? []
  const allProducts = productsData?.items ?? []

  // Reset regions when city changes
  React.useEffect(() => {
    setShippingRegionId('')
  }, [shippingCityId])

  // Default delivery method
  React.useEffect(() => {
    if (deliveryMethods?.length && !deliveryMethodCode) {
      setDeliveryMethodCode(deliveryMethods[0]!.code)
    }
  }, [deliveryMethods, deliveryMethodCode])

  // Filter products for autocomplete dropdown
  const filteredProducts = React.useMemo(() => {
    const q = productQuery.toLowerCase().trim()
    let pool = allProducts
    if (q) {
      pool = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.categories?.some((c) => c.name.toLowerCase().includes(q)),
      )
    } else if (!productSearchFocused) {
      pool = allProducts.slice(0, 6)
    }
    return [...pool].sort((a, b) => (b.available_stock > 0 ? 1 : 0) - (a.available_stock > 0 ? 1 : 0)).slice(0, 10)
  }, [allProducts, productQuery, productSearchFocused])

  // Autocomplete customer selection
  const handleSelectCustomer = (c: CustomerLookupResult) => {
    setCustomerName(c.name || '')
    setCustomerPhone(c.phone_number || '')
    setCustomerEmail(c.email || '')
    if (c.last_city_id) setShippingCityId(c.last_city_id)
    if (c.last_region_id) setShippingRegionId(c.last_region_id)
    if (c.last_address) setShippingAddress(c.last_address)
  }

  // Add product line item
  const handleAddProduct = (product: Product, variant?: ProductVariant) => {
    const rawPrice = variant?.price ?? product.price ?? '0'
    const price = parseFloat(rawPrice)
    setSelectedItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) => it.product.id === product.id && it.variant?.id === variant?.id,
      )
      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx]!.quantity += 1
        return updated
      }
      return [
        ...prev,
        {
          product,
          variant,
          quantity: 1,
          unitPrice: price,
        },
      ]
    })
    setProductQuery('')
  }

  // Update item quantity
  const handleUpdateQty = (index: number, delta: number) => {
    setSelectedItems((prev) => {
      const updated = [...prev]
      const target = updated[index]
      if (!target) return prev
      const newQty = target.quantity + delta
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index)
      }
      target.quantity = newQty
      return updated
    })
  }

  // Remove item
  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, i) => i !== index))
  }

  // Calculate live financial numbers
  const subtotal = React.useMemo(() => {
    return selectedItems.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0)
  }, [selectedItems])

  const selectedRegion = React.useMemo(
    () => regions.find((r) => r.id === shippingRegionId),
    [regions, shippingRegionId],
  )
  const selectedCity = React.useMemo(
    () => cities.find((c) => c.id === shippingCityId),
    [cities, shippingCityId],
  )

  const rawShippingFee = selectedRegion
    ? parseFloat(selectedRegion.delivery_fee)
    : selectedCity
    ? parseFloat(selectedCity.delivery_fee)
    : 0

  const qualifiesFreeShipping = Boolean(
    promo?.is_active && promo.min_order_amount && subtotal >= parseFloat(promo.min_order_amount),
  )

  const finalShippingFee = qualifiesFreeShipping ? 0 : rawShippingFee
  const netTotal = subtotal + finalShippingFee

  // Submit quick order
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!customerPhone.trim()) {
      setFormError('يرجى إدخال رقم هاتف العميل.')
      return
    }
    if (selectedItems.length === 0) {
      setFormError('يرجى إضافة عطر أو منتج واحد على الأقل للطلب.')
      return
    }

    try {
      const order = await quickCreate.mutateAsync({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || undefined,
        shipping_city_id: shippingCityId || undefined,
        shipping_region_id: shippingRegionId || undefined,
        shipping_address: shippingAddress,
        delivery_method_code: deliveryMethodCode,
        payment_method_code: paymentMethodCode,
        discount_code: discountCode || undefined,
        customer_notes: customerNotes,
        items: selectedItems.map((it) => ({
          product_id: it.product.id,
          variant_id: it.variant?.id || undefined,
          quantity: it.quantity,
        })),
      })

      // Reset state and navigate
      onOpenChange(false)
      setSelectedItems([])
      setCustomerPhone('')
      setCustomerName('')
      setCustomerEmail('')
      setShippingAddress('')
      setCustomerNotes('')
      navigate(`/admin/orders/${order.order_number}`)
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الطلب السريع، يرجى التحقق من المدخلات والمخزون.'
      setFormError(errorMsg)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-5 sm:p-7">
        <div className="flex items-center justify-between border-b border-border/80 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">إنشاء طلب يدوي سريع (مبيعات الهاتف / الواتساب)</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                إدخال فوري للطلبات وحجز المخزون ذرياً مع الجلب التلقائي لبيانات العميل بالهاتف.
              </DialogDescription>
            </div>
          </div>
        </div>

        {formError && (
          <Alert tone="error" className="mt-4">
            {formError}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Section 1: Customer Details & Auto-lookup */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <User className="size-4 text-primary" />
                بيانات العميل (بحث ذكي بالهاتف)
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                اختصار لوحة المفاتيح: Cmd+Shift+O
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative space-y-1 sm:col-span-1">
                <Label htmlFor="quick-phone" className="text-xs font-medium">
                  رقم الهاتف *
                </Label>
                <Input
                  id="quick-phone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="0912345678"
                  className="h-9 text-xs font-mono"
                  dir="ltr"
                  autoFocus
                />

                {/* Autocomplete dropdown for matched customers */}
                {customerResults && customerResults.length > 0 && customerPhone.length >= 3 && (
                  <div className="absolute top-full start-0 z-50 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-md animate-fade-rise">
                    <p className="px-2 py-1 text-[10px] text-muted-foreground font-medium border-b border-border/60">
                      عملاء مطابقون في النظام:
                    </p>
                    {customerResults.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-start text-xs hover:bg-muted focus-visible:bg-muted"
                      >
                        <span className="font-semibold text-foreground">{c.name || 'عميل'}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{c.phone_number}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="quick-name" className="text-xs font-medium">
                  اسم العميل
                </Label>
                <Input
                  id="quick-name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="مثال: أحمد الفرجاني"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1 sm:col-span-1">
                <Label htmlFor="quick-email" className="text-xs font-medium">
                  البريد الإلكتروني (اختياري)
                </Label>
                <Input
                  id="quick-email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="client@example.ly"
                  className="h-9 text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Product Search & Line Items */}
          <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Package className="size-4 text-primary" />
                المنتجات والعطور المطلوبة *
              </span>
              <span className="text-[11px] text-muted-foreground">
                {selectedItems.length} منتجات مضافة
              </span>
            </div>

            {/* Product Combobox Search */}
            <div className="relative">
              <div className="relative">
                <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="quick-product-search"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  onFocus={() => setProductSearchFocused(true)}
                  placeholder="ابحث عن العطور أو اختر من القائمة..."
                  className="h-9 ps-9 text-xs"
                />
              </div>

              {filteredProducts.length > 0 && (
                <div className="absolute top-full start-0 z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-lg animate-fade-rise space-y-1">
                  {filteredProducts.map((p) => (
                    <div key={p.id} className="rounded-md p-1.5 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {p.images?.[0]?.url ? (
                            <img
                              src={p.images[0].url}
                              alt={p.name}
                              className="size-8 rounded object-cover border border-border/60"
                            />
                          ) : (
                            <div className="size-8 rounded bg-muted flex items-center justify-center text-muted-foreground text-[10px]">
                              عطر
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-bold text-foreground">{p.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {p.categories?.[0]?.name || 'عطر فاخر'} — المتوفر: {p.available_stock} قطعة
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-primary">
                            {formatPrice(p.price)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={p.available_stock <= 0}
                            onClick={() => handleAddProduct(p)}
                            className="h-7 text-xs px-2.5 disabled:opacity-50"
                          >
                            <Plus className="size-3.5 me-1" />
                            {p.available_stock > 0 ? 'إضافة' : 'نفد'}
                          </Button>
                        </div>
                      </div>

                      {/* Variant options if product has variants */}
                      {p.variants && p.variants.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5 ps-10 border-t border-border/40 pt-1">
                          {p.variants.map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => handleAddProduct(p, v)}
                              className="rounded border border-border/70 bg-card px-2 py-0.5 text-[11px] hover:border-primary text-foreground transition-colors"
                            >
                              {v.values?.map((val) => val.value).join(' / ') || v.sku} — {formatPrice(v.price || p.price)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Line Items Table */}
            {selectedItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
                لم تقم بإضافة أي عطور أو منتجات حتى الآن. استخدم حقل البحث بالأعلى للإضافة.
              </div>
            ) : (
              <div className="space-y-2 divide-y divide-border/60">
                {selectedItems.map((item, idx) => (
                  <div key={`${item.product.id}-${item.variant?.id || 'base'}`} className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2.5">
                      {item.product.images?.[0]?.url ? (
                        <img
                          src={item.product.images[0].url}
                          alt={item.product.name}
                          className="size-9 rounded-lg object-cover border border-border"
                        />
                      ) : (
                        <div className="size-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-xs">
                          عطر
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-bold text-foreground">{item.product.name}</p>
                        {item.variant && (
                          <p className="text-[10px] text-muted-foreground">
                            {item.variant.values?.map((v) => v.value).join(' / ') || item.variant.sku}
                          </p>
                        )}
                        <p className="text-[11px] font-mono text-muted-foreground">
                          {formatPrice(item.unitPrice)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Quantity Stepper */}
                      <div className="flex items-center rounded-lg border border-border bg-card">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, -1)}
                          className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="إنقاص الكمية"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-bold text-foreground">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(idx, 1)}
                          className="flex size-7 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label="زيادة الكمية"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>

                      {/* Line Subtotal */}
                      <span className="w-20 text-end text-xs font-mono font-bold text-foreground">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                        aria-label="حذف المنتج"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Delivery & Payment Details */}
          <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-border bg-muted/20 p-4">
            <div className="space-y-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <MapPin className="size-4 text-primary" />
                عنوان ومكان التوصيل
              </span>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="المدينة *" htmlFor="quick-city">
                  <Select
                    id="quick-city"
                    value={shippingCityId}
                    onChange={(e) => setShippingCityId(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="">اختر المدينة...</option>
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name} ({formatPrice(city.delivery_fee)})
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="الحي / المنطقة" htmlFor="quick-region">
                  <Select
                    id="quick-region"
                    value={shippingRegionId}
                    onChange={(e) => setShippingRegionId(e.target.value)}
                    disabled={!shippingCityId || regions.length === 0}
                    className="h-9 text-xs"
                  >
                    <option value="">اختر الحي / المنطقة...</option>
                    {regions.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name} ({formatPrice(reg.delivery_fee)})
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <Field label="تفاصيل العنوان والشارع" htmlFor="quick-address">
                <Input
                  id="quick-address"
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="مثال: شارع النصر، بالقرب من مصرف الجمهورية"
                  className="h-9 text-xs"
                />
              </Field>
            </div>

            <div className="space-y-3">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Truck className="size-4 text-primary" />
                الشحن والدفع والملاحظات
              </span>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="شركة التوصيل" htmlFor="quick-courier">
                  <Select
                    id="quick-courier"
                    value={deliveryMethodCode}
                    onChange={(e) => setDeliveryMethodCode(e.target.value)}
                    className="h-9 text-xs"
                  >
                    {deliveryMethods?.map((dm) => (
                      <option key={dm.code} value={dm.code}>
                        {dm.name}
                      </option>
                    )) || <option value="">الافتراضي</option>}
                  </Select>
                </Field>

                <Field label="طريقة الدفع" htmlFor="quick-payment">
                  <Select
                    id="quick-payment"
                    value={paymentMethodCode}
                    onChange={(e) => setPaymentMethodCode(e.target.value)}
                    className="h-9 text-xs"
                  >
                    <option value="manual_payment">الدفع عند الاستلام (COD / كاش)</option>
                    <option value="bank_cards_on_delivery">بطاقة مصرفية عند الاستلام (POS)</option>
                    <option value="sadad_pay">سداد باي (Sadad Pay)</option>
                    <option value="moamalat">بطاقة محلية (تداول / معاملات)</option>
                  </Select>
                </Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="كود الخصم (اختياري)" htmlFor="quick-discount">
                  <Input
                    id="quick-discount"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    placeholder="مثال: NASAEEM10"
                    className="h-9 text-xs font-mono uppercase"
                  />
                </Field>

                <Field label="ملاحظات العميل والتوصيل" htmlFor="quick-notes">
                  <Input
                    id="quick-notes"
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    placeholder="مثال: الاتصال قبل الوصول بنصف ساعة"
                    className="h-9 text-xs"
                  />
                </Field>
              </div>
            </div>
          </div>

          {/* Section 4: Live Totals & Free Shipping Promo Indicator */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            {qualifiesFreeShipping && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary animate-fade-rise">
                <Sparkles className="size-4" />
                مؤهل لعرض الشحن المجاني التلقائي لجميع المدن!
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>المجموع الفرعي ({selectedItems.length} عطور):</span>
              <span className="font-mono font-bold text-foreground">{formatPrice(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>رسوم التوصيل والشحن:</span>
              <span className="font-mono font-bold text-foreground">
                {qualifiesFreeShipping ? (
                  <span className="text-success font-bold">مجاني (0.00 د.ل)</span>
                ) : (
                  formatPrice(finalShippingFee)
                )}
              </span>
            </div>

            <div className="border-t border-primary/20 pt-2 flex items-center justify-between">
              <span className="text-sm font-bold text-foreground">الإجمالي النهائي المطلوب تحصيله:</span>
              <span className="text-base font-mono font-bold text-primary">
                {formatPrice(netTotal)}
              </span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={quickCreate.isPending}
              className="h-10 text-xs px-4"
            >
              إلغاء
            </Button>

            <Button
              type="submit"
              disabled={quickCreate.isPending || selectedItems.length === 0}
              className="h-10 text-xs px-6 font-bold"
            >
              {quickCreate.isPending ? (
                <>
                  <Loader2 className="size-4 me-2 animate-spin" />
                  جارٍ إنشاء وحجز الطلب...
                </>
              ) : (
                <>
                  <Check className="size-4 me-2" />
                  حفظ وتأكيد الطلب فوراً (Enter)
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
