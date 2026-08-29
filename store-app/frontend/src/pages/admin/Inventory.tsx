import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  History,
  Minus,
  Package,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { DataTable, type Column } from '@/components/admin/DataTable'
import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useAdjustInventory, useInventory, useManageProductSizes, useProductSizes } from '@/lib/queries/catalog'
import { usePageTitle } from '@/lib/usePageTitle'
import { useUrlState } from '@/lib/useUrlState'
import { cn } from '@/lib/utils'
import type { InventoryRow } from '@/types/api'

interface AdjustTarget {
  productId: string
  variantId: string | null
  label: string
  current: number
}

type AdjustTab = 'restock' | 'damage' | 'return' | 'audit'

export default function AdminInventoryPage() {
  usePageTitle('إدارة وتوريد المخزون — لوحة التحكم')
  const { get, set } = useUrlState()
  const page = Number(get('page') || 1)
  const search = get('search')
  const stockFilter = get('stock_filter') || ''

  const query = useInventory({
    page,
    search: search || undefined,
    low_stock: stockFilter === 'low' ? 1 : undefined,
  })
  const adjust = useAdjustInventory()

  const [target, setTarget] = useState<AdjustTarget | null>(null)
  const [activeTab, setActiveTab] = useState<AdjustTab>('restock')
  const [amount, setAmount] = useState('10')
  const [auditTarget, setAuditTarget] = useState('')
  const [damageReason, setDamageReason] = useState('damaged_transit')
  const [note, setNote] = useState('')
  const [sizesModalProduct, setSizesModalProduct] = useState<{ id: string; name: string } | null>(null)

  const openAdjust = (next: AdjustTarget, initialTab: AdjustTab = 'restock') => {
    setTarget(next)
    setActiveTab(initialTab)
    setAmount('10')
    setAuditTarget(String(next.current))
    setDamageReason('damaged_transit')
    setNote('')
  }

  const items = query.data?.items ?? []
  const totalTracked = query.data?.meta?.total ?? 0
  const outOfStockCount = items.filter((i) => i.available_stock <= 0).length
  const lowStockCount = items.filter((i) => i.available_stock > 0 && i.available_stock <= 5).length
  const inStockCount = items.filter((i) => i.available_stock > 5).length

  // Filter chips
  const filterChips = [
    {
      id: 'all',
      label: `كل المنتجات (${totalTracked})`,
      active: !stockFilter,
      onClick: () => set({ stock_filter: '', page: 1 }),
    },
    {
      id: 'low',
      label: 'مخزون منخفض (≤ 5)',
      active: stockFilter === 'low',
      onClick: () => set({ stock_filter: 'low', page: 1 }),
    },
    {
      id: 'out',
      label: 'نفد من المخزون (0)',
      active: stockFilter === 'out',
      onClick: () => set({ stock_filter: 'out', page: 1 }),
    },
  ]

  // Client filtering when 'out' is selected
  const displayedItems = items.filter((item) => {
    if (stockFilter === 'out') return item.available_stock <= 0
    return true
  })

  const calculateChange = (): number => {
    const num = Number.parseInt(amount, 10) || 0
    if (activeTab === 'restock' || activeTab === 'return') return Math.abs(num)
    if (activeTab === 'damage') return -Math.abs(num)
    if (activeTab === 'audit') {
      const targetVal = Number.parseInt(auditTarget, 10) || 0
      return targetVal - (target?.current ?? 0)
    }
    return 0
  }

  const calculatedNewStock = (target?.current ?? 0) + calculateChange()

  const columns: Column<InventoryRow>[] = [
    {
      key: 'name',
      header: 'المنتج والرمز',
      cell: (row) => (
        <div className="space-y-0.5">
          <span className="font-bold text-foreground text-xs sm:text-sm block">{row.name}</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">{row.sku ? `SKU: ${row.sku}` : 'بدون رمز'}</span>
            {row.has_variants && (
              <Badge tone="neutral" className="text-[10px] py-0 px-1.5 font-mono">
                {row.variants.length} خيارات
              </Badge>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'stock',
      header: 'المخزون الإجمالي',
      cell: (row) => (
        <div className="space-y-1">
          <span className="font-mono font-bold text-xs sm:text-sm text-foreground">{formatNumber(row.stock)} قطعة</span>
          {/* Visual stock gauge */}
          <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                row.stock <= 0 ? 'bg-destructive' : row.stock <= 5 ? 'bg-amber-500' : 'bg-emerald-500',
              )}
              style={{ width: `${Math.min(100, Math.max(10, (row.stock / 50) * 100))}%` }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'reserved',
      header: 'محجوز للطلبات',
      cell: (row) => (
        <span className="font-mono text-xs">
          {row.reserved_stock > 0 ? (
            <span className="font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
              {formatNumber(row.reserved_stock)}
            </span>
          ) : (
            <span className="text-muted-foreground">0</span>
          )}
        </span>
      ),
    },
    {
      key: 'available',
      header: 'المتاح للبيع الفعلي',
      cell: (row) =>
        row.available_stock <= 0 ? (
          <Badge tone="danger" className="font-mono text-xs font-bold gap-1">
            <AlertTriangle className="size-3" />
            <span>نفد (0)</span>
          </Badge>
        ) : row.available_stock <= 5 ? (
          <Badge tone="warning" className="font-mono text-xs font-bold gap-1">
            <AlertTriangle className="size-3" />
            <span>{formatNumber(row.available_stock)} متبقي</span>
          </Badge>
        ) : (
          <Badge tone="success" className="font-mono text-xs font-bold gap-1">
            <CheckCircle2 className="size-3" />
            <span>{formatNumber(row.available_stock)} قطعة</span>
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'التحكم والتوريد',
      align: 'end' as const,
      cell: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          {!row.has_variants ? (
            <>
              {/* Quick +1 / -1 Buttons */}
              <button
                type="button"
                aria-label={`خصم قطعة واحدة من ${row.name}`}
                title="إنقاص قطعة واحدة (-1)"
                disabled={adjust.isPending || row.stock <= 0}
                onClick={async () => {
                  await adjust.mutateAsync({
                    product_id: row.product_id,
                    variant_id: null,
                    change: -1,
                    reason: 'manual',
                    note: 'إنقاص سريع (-1)',
                  })
                }}
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all disabled:opacity-40"
              >
                <Minus className="size-3.5" />
              </button>

              <button
                type="button"
                aria-label={`إضافة قطعة واحدة لـ ${row.name}`}
                title="إضافة قطعة واحدة (+1)"
                disabled={adjust.isPending}
                onClick={async () => {
                  await adjust.mutateAsync({
                    product_id: row.product_id,
                    variant_id: null,
                    change: 1,
                    reason: 'restock',
                    note: 'إضافة سريعة (+1)',
                  })
                }}
                className="flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 transition-all"
              >
                <Plus className="size-3.5" />
              </button>

              {/* Full Stock Manager Modal Trigger */}
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-xl text-xs font-bold gap-1 border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs"
                onClick={() =>
                  openAdjust({ productId: row.product_id, variantId: null, label: row.name, current: row.stock })
                }
              >
                <SlidersHorizontal className="size-3" />
                <span>إدارة التوريد</span>
              </Button>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 w-full min-w-56 max-w-sm">
              {row.variants.map((v) => (
                <div
                  key={v.variant_id}
                  className="flex items-center justify-between gap-2 text-xs bg-muted/40 hover:bg-muted/70 p-1.5 rounded-xl border border-border/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="inline-flex items-center justify-center font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] shrink-0">
                      {v.label || v.sku}
                    </span>
                    <span className="font-mono font-bold text-[11px] text-foreground truncate">
                      {formatNumber(v.available_stock)} متاح
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Quick -1 for this size */}
                    <button
                      type="button"
                      aria-label={`خصم 1 من ${v.label}`}
                      title="إنقاص قطعة واحدة (-1)"
                      disabled={adjust.isPending || v.stock <= 0}
                      onClick={() =>
                        adjust.mutate({
                          product_id: row.product_id,
                          variant_id: v.variant_id,
                          change: -1,
                          reason: 'manual',
                          note: `إنقاص سريع (-1) لسعة ${v.label}`,
                        })
                      }
                      className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all disabled:opacity-30"
                    >
                      <Minus className="size-3" />
                    </button>

                    {/* Quick +1 for this size */}
                    <button
                      type="button"
                      aria-label={`إضافة 1 لـ ${v.label}`}
                      title="إضافة قطعة واحدة (+1)"
                      disabled={adjust.isPending}
                      onClick={() =>
                        adjust.mutate({
                          product_id: row.product_id,
                          variant_id: v.variant_id,
                          change: 1,
                          reason: 'restock',
                          note: `إضافة سريعة (+1) لسعة ${v.label}`,
                        })
                      }
                      className="flex size-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-600 transition-all"
                    >
                      <Plus className="size-3" />
                    </button>

                    {/* Full Adjust for this size */}
                    <button
                      type="button"
                      aria-label={`إدارة وتدقيق مخزون ${v.label}`}
                      title="إدارة وتدقيق مخزون هذه السعة"
                      onClick={() =>
                        openAdjust({
                          productId: row.product_id,
                          variantId: v.variant_id,
                          label: `${row.name} — ${v.label || v.sku}`,
                          current: v.stock,
                        })
                      }
                      className="flex size-6 items-center justify-center rounded-md bg-card border border-border text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      <SlidersHorizontal className="size-3" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Action buttons for multi-size perfume */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSizesModalProduct({ id: row.product_id, name: row.name })}
                  className="h-7 px-2 rounded-lg text-[11px] font-bold border-primary/40 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground transition-all shadow-2xs gap-1 flex-1"
                >
                  <Boxes className="size-3" />
                  <span>توريد وتعديل السعات</span>
                </Button>

                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 rounded-lg text-[11px] font-bold text-muted-foreground hover:text-foreground"
                >
                  <Link to={`/admin/products/${encodeURIComponent(row.product_id)}/variants`}>
                    <Plus className="size-3 me-0.5" />
                    سعة جديدة
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      ),
    },
  ]

  const apiError = adjust.error instanceof ApiError ? adjust.error.message : null

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="إدارة وتوريد المخزون"
        description="متابعة الأرصدة المتوفرة، تسجيل الشحنات والتوريدات الجديدة، وتدقيق حركات الجرد"
        action={
          <Button asChild variant="outline" size="sm" className="rounded-xl font-bold shadow-2xs gap-1.5 h-10 px-4">
            <Link to="/admin/inventory/logs">
              <History className="size-4 text-primary" aria-hidden="true" />
              <span>سجل حركات وتدقيق المخزون</span>
            </Link>
          </Button>
        }
      />

      {/* KPI Metric Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي الأصناف</span>
            <Package className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">{formatNumber(totalTracked)}</p>
          <p className="text-[11px] text-muted-foreground">صنف متتبع بالمستودع</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>متوفر بوفرة</span>
            <PackageCheck className="size-4 text-emerald-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatNumber(inStockCount)}</p>
          <p className="text-[11px] text-muted-foreground">أرصدة أعلى من 5 قطع</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>مخزون منخفض</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">{formatNumber(lowStockCount)}</p>
          <p className="text-[11px] text-muted-foreground">تحتاج إلى إعادة توريد</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>نفد من المخزون</span>
            <PackageMinus className="size-4 text-destructive" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-destructive">{formatNumber(outOfStockCount)}</p>
          <p className="text-[11px] text-muted-foreground">غير متاح للبيع حالياً</p>
        </div>
      </div>

      {/* Main Inventory DataTable */}
      <DataTable
        columns={columns}
        rows={displayedItems}
        rowKey={(row) => row.product_id}
        isLoading={query.isLoading}
        error={query.error ? { message: 'تعذّر تحميل المخزون' } : null}
        onRetry={() => query.refetch()}
        page={page}
        pages={query.data?.meta?.pages ?? 1}
        total={query.data?.meta?.total}
        onPageChange={(next) => set({ page: next })}
        search={search}
        onSearchChange={(value) => set({ search: value, page: 1 })}
        searchPlaceholder="ابحث باسم العطر أو الرمز SKU…"
        filterChips={filterChips}
        emptyTitle="لا توجد منتجات متتبَّعة"
        emptyDescription="فعّل خيار «تتبّع الكمية» على بطاقة المنتج لتظهر في جدول المستودع."
      />

      {/* Comprehensive Multi-Tab Stock Adjust Modal */}
      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent className="rounded-3xl max-w-lg p-6">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            <span>إدارة وتوريد المخزون</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {target?.label}
          </DialogDescription>

          <div className="mt-4 space-y-5">
            {/* Live Stock Comparison Card */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-center">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-semibold">الرصيد الحالي بالمستودع</span>
                <p className="font-mono text-xl font-bold text-foreground">{formatNumber(target?.current ?? 0)} قطعة</p>
              </div>
              <div className="space-y-0.5 border-s border-border ps-3">
                <span className="text-xs text-muted-foreground font-semibold">الرصيد بعد العملية</span>
                <p className={cn(
                  'font-mono text-xl font-extrabold flex items-center justify-center gap-1',
                  calculatedNewStock < 0 ? 'text-destructive' : 'text-primary'
                )}>
                  {calculatedNewStock > (target?.current ?? 0) ? (
                    <ArrowUpRight className="size-4 text-emerald-500" />
                  ) : calculatedNewStock < (target?.current ?? 0) ? (
                    <ArrowDownRight className="size-4 text-destructive" />
                  ) : null}
                  <span>{formatNumber(Math.max(0, calculatedNewStock))} قطعة</span>
                </p>
              </div>
            </div>

            {/* Action Tabs */}
            <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-muted p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => { setActiveTab('restock'); setAmount('10'); }}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all',
                  activeTab === 'restock' ? 'bg-card text-primary shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <PackagePlus className="size-4" />
                <span>توريد (+)</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('damage'); setAmount('1'); }}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all',
                  activeTab === 'damage' ? 'bg-card text-destructive shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <PackageMinus className="size-4" />
                <span>خصم/تالف (-)</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('return'); setAmount('1'); }}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all',
                  activeTab === 'return' ? 'bg-card text-sky-600 dark:text-sky-400 shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <RefreshCw className="size-4" />
                <span>مرتجع (+)</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('audit'); setAuditTarget(String(target?.current ?? 0)); }}
                className={cn(
                  'flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all',
                  activeTab === 'audit' ? 'bg-card text-amber-600 dark:text-amber-400 shadow-xs font-bold' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <ClipboardList className="size-4" />
                <span>جرد مباشر (=)</span>
              </button>
            </div>

            {apiError && <Alert tone="error">{apiError}</Alert>}

            {/* Tab 1: Restock New Supply */}
            {activeTab === 'restock' && (
              <div className="space-y-4 animate-fade-rise">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">الكمية المورّدة (إضافة للمخزون)</label>
                  <Input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 font-mono text-sm rounded-xl font-bold"
                  />
                </div>
                {/* Quick Add Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-semibold">كميات سريعة:</span>
                  {[5, 10, 25, 50, 100, 250].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setAmount(String(qty))}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-mono font-bold text-foreground hover:border-primary hover:bg-primary/10 transition-all"
                    >
                      +{qty}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">بيان الشحنة / رقم الفاتورة (اختياري)</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="مثال: شحنة رقم 104 من المورد الإماراتي"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Tab 2: Damage / Deduction */}
            {activeTab === 'damage' && (
              <div className="space-y-4 animate-fade-rise">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">الكمية المخصومة (خصم من المخزون)</label>
                  <Input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 font-mono text-sm rounded-xl font-bold text-destructive"
                  />
                </div>
                {/* Quick Deduct Buttons */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground font-semibold">خصم سريع:</span>
                  {[1, 2, 5, 10, 20].map((qty) => (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setAmount(String(qty))}
                      className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-mono font-bold text-destructive hover:bg-destructive/10 transition-all"
                    >
                      -{qty}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">سبب الخصم والتسوية</label>
                  <select
                    value={damageReason}
                    onChange={(e) => setDamageReason(e.target.value)}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 text-xs"
                  >
                    <option value="damaged_transit">تالف أثناء النقل والشحن</option>
                    <option value="damaged_warehouse">كسر أو تلف داخل المستودع</option>
                    <option value="sample_gift">عينة تجربة / هدية تسويقية</option>
                    <option value="expired">انتهاء الصلاحية أو الجودة</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">ملاحظة التقرير (اختياري)</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="بيان الخصم للتسوية المالية..."
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Return */}
            {activeTab === 'return' && (
              <div className="space-y-4 animate-fade-rise">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">الكمية المرتجعة الصالحة للبيع</label>
                  <Input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="h-11 font-mono text-sm rounded-xl font-bold text-sky-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">رقم طلب العميل المرتجع منه</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="مثال: مرتجع من الطلب #1042"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Direct Physical Audit Count */}
            {activeTab === 'audit' && (
              <div className="space-y-4 animate-fade-rise">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">العدد الفعلي بعد الجرد اليدوي بالمستودع</label>
                  <Input
                    type="number"
                    min="0"
                    value={auditTarget}
                    onChange={(e) => setAuditTarget(e.target.value)}
                    className="h-11 font-mono text-sm rounded-xl font-bold"
                  />
                </div>
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                  <span>سيتم تسجيل حركة تصحيح تلقائية بقيمة: </span>
                  <span className="font-mono font-bold">
                    {calculateChange() > 0 ? `+${calculateChange()}` : calculateChange()} قطعة
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">رقم محضر الجرد / ملاحظة المشرف</label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="محضر جرد الربع الأول 2026..."
                    className="h-10 text-xs rounded-xl"
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button variant="ghost" className="rounded-xl text-xs font-semibold" onClick={() => setTarget(null)}>
                إلغاء
              </Button>
              <Button
                loading={adjust.isPending}
                className="rounded-xl text-xs font-bold px-6 shadow-sm"
                onClick={async () => {
                  if (!target) return
                  const changeValue = calculateChange()
                  if (changeValue === 0) {
                    setTarget(null)
                    return
                  }
                  const finalReason =
                    activeTab === 'restock' ? 'restock' :
                    activeTab === 'return' ? 'return' :
                    activeTab === 'damage' ? 'correction' : 'manual'

                  await adjust.mutateAsync({
                    product_id: target.productId,
                    variant_id: target.variantId,
                    change: changeValue,
                    reason: finalReason,
                    note: note || (activeTab === 'damage' ? `خصم: ${damageReason}` : undefined),
                  })
                  setTarget(null)
                }}
              >
                تأكيد وحفظ الحركة بالمستودع
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dedicated Perfume Sizes Multi-Restock Modal */}
      <ProductSizesRestockDialog
        product={sizesModalProduct}
        onClose={() => setSizesModalProduct(null)}
      />
    </div>
  )
}

function ProductSizesRestockDialog({
  product,
  onClose,
}: {
  product: { id: string; name: string } | null
  onClose: () => void
}) {
  const sizesQuery = useProductSizes(product?.id)
  const manageSizes = useManageProductSizes()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [newSizeName, setNewSizeName] = useState('')
  const [newSizePrice, setNewSizePrice] = useState('')
  const [newSizeStock, setNewSizeStock] = useState('10')
  const [showAddForm, setShowAddForm] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!product) return null

  const sizes = sizesQuery.data?.data ?? []

  const handleApplyPresetToAll = (qty: number) => {
    const next: Record<string, number> = {}
    sizes.forEach((s) => {
      if (s.id) next[s.id] = qty
    })
    setQuantities(next)
  }

  const handleSaveBatchAdjust = async () => {
    setErrorMsg(null)
    const adjustments = Object.entries(quantities)
      .map(([variant_id, change]) => ({
        variant_id,
        change,
        reason: change > 0 ? 'restock' : 'manual',
        note: 'توريد دفعي من صفحة المخزون',
      }))
      .filter((a) => a.change !== 0)

    if (adjustments.length === 0) {
      onClose()
      return
    }

    try {
      await manageSizes.mutateAsync({
        lookup: product.id,
        action: 'batch_adjust',
        adjustments,
      })
      onClose()
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'تعذّر حفظ التوريد')
    }
  }

  const handleAddNewSize = async () => {
    if (!newSizeName.trim()) {
      setErrorMsg('اسم السعة مطلوب (مثال: 100 مل)')
      return
    }
    setErrorMsg(null)
    try {
      await manageSizes.mutateAsync({
        lookup: product.id,
        action: 'add_size',
        size: newSizeName.trim(),
        price: newSizePrice.trim() || '0',
        stock: Number(newSizeStock) || 0,
      })
      setNewSizeName('')
      setNewSizePrice('')
      setNewSizeStock('10')
      setShowAddForm(false)
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'تعذّر إضافة السعة')
    }
  }

  return (
    <Dialog open={Boolean(product)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-3xl p-6">
        <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
          <Boxes className="size-5 text-primary" />
          إدارة وتوريد سعات: {product.name}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          يمكنك توريد شحنات جديدة لجميع سعات العطر دفعة واحدة، أو إضافة حجم وسعة جديدة مباشرة للمنتج.
        </DialogDescription>

        {errorMsg && <Alert tone="error">{errorMsg}</Alert>}

        {sizesQuery.isLoading ? (
          <div className="py-8 text-center text-xs text-muted-foreground">جارٍ تحميل السعات...</div>
        ) : (
          <div className="space-y-4 pt-2">
            {/* Quick Bulk Presets */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/80 text-xs">
              <span className="font-bold text-foreground">توريد سريع لجميع السعات:</span>
              <div className="flex gap-1.5">
                {[5, 10, 20, 50].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleApplyPresetToAll(num)}
                    className="px-2.5 py-1 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:border-primary hover:text-primary transition-all shadow-2xs"
                  >
                    +{num} للكل
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setQuantities({})}
                  className="px-2 py-1 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                >
                  تفريغ
                </button>
              </div>
            </div>

            {/* Sizes List with Restock Inputs */}
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {sizes.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  لا توجد سعات بعد لهذا العطر. أضف سعة جديدة أدناه.
                </div>
              ) : (
                sizes.map((s) => {
                  const currentQty = quantities[s.id || ''] || 0
                  return (
                    <div
                      key={s.id || s.size}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card shadow-2xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary text-xs">
                            {s.size}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground">{s.sku}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          الرصيد الحالي: <strong className="font-mono text-foreground">{s.stock}</strong> قطعة
                          {currentQty !== 0 && (
                            <span className="ms-2 font-bold text-primary">
                              ← الجديد: <span className="font-mono">{s.stock + currentQty}</span>
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantities((prev) => ({
                              ...prev,
                              [s.id || '']: (prev[s.id || ''] || 0) - 1,
                            }))
                          }
                          className="size-7 rounded-lg border border-border bg-muted/40 text-muted-foreground flex items-center justify-center hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Minus className="size-3" />
                        </button>

                        <Input
                          type="number"
                          value={currentQty === 0 ? '' : currentQty}
                          onChange={(e) => {
                            const val = Number(e.target.value) || 0
                            setQuantities((prev) => ({ ...prev, [s.id || '']: val }))
                          }}
                          placeholder="+0"
                          className="h-8 w-16 text-center font-mono font-bold text-xs rounded-lg"
                        />

                        <button
                          type="button"
                          onClick={() =>
                            setQuantities((prev) => ({
                              ...prev,
                              [s.id || '']: (prev[s.id || ''] || 0) + 1,
                            }))
                          }
                          className="size-7 rounded-lg border border-border bg-muted/40 text-muted-foreground flex items-center justify-center hover:bg-emerald-500/10 hover:text-emerald-600"
                        >
                          <Plus className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Inline Add New Size Form */}
            {showAddForm ? (
              <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 space-y-3 animate-fade-rise">
                <h4 className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Plus className="size-3.5" />
                  إضافة حجم وسعة جديدة للعطر (بالـ مل)
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={newSizeName}
                    onChange={(e) => setNewSizeName(e.target.value)}
                    placeholder="السعة (مثال: 150 مل)"
                    className="h-8 text-xs rounded-lg bg-card"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    dir="ltr"
                    value={newSizePrice}
                    onChange={(e) => setNewSizePrice(e.target.value)}
                    placeholder="السعر (د.ل)"
                    className="h-8 text-xs font-mono font-bold rounded-lg bg-card text-price"
                  />
                  <Input
                    type="number"
                    min="0"
                    dir="ltr"
                    value={newSizeStock}
                    onChange={(e) => setNewSizeStock(e.target.value)}
                    placeholder="المخزون الأولي"
                    className="h-8 text-xs font-mono rounded-lg bg-card text-center"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddForm(false)}
                    className="h-7 text-xs px-2"
                  >
                    إلغاء
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    loading={manageSizes.isPending}
                    onClick={handleAddNewSize}
                    className="h-7 text-xs font-bold px-3 rounded-lg"
                  >
                    حفظ السعة
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full py-2 rounded-2xl border border-dashed border-border text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>إضافة سعة وحجم جديد لهذا العطر</span>
              </button>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Link to={`/admin/products/${encodeURIComponent(product.id)}/variants`}>
                  انتقال لصفحة السعات الكاملة ←
                </Link>
              </Button>

              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={onClose}>
                  إغلاق
                </Button>
                <Button
                  size="sm"
                  loading={manageSizes.isPending}
                  onClick={handleSaveBatchAdjust}
                  className="rounded-xl text-xs font-bold px-5 shadow-sm"
                >
                  حفظ وتطبيق التوريد
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
