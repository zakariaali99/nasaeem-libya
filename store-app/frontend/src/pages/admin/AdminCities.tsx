import { CheckCircle2, ChevronDown, ChevronUp, MapPin, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/layout/AdminLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatNumber } from '@/lib/format'
import { useCitiesAdmin, useUpdateCity, useUpdateRegion } from '@/lib/queries/orders'
import { usePageTitle } from '@/lib/usePageTitle'

export default function AdminCities() {
  usePageTitle('المدن ومناطق التوصيل — لوحة التحكم')
  const { data: cities, isPending } = useCitiesAdmin()
  const updateCity = useUpdateCity()
  const updateRegion = useUpdateRegion()
  const [openId, setOpenId] = useState<string | null>(null)

  const cityList = cities ?? []
  const totalCities = cityList.length
  const activeCities = cityList.filter((c) => c.is_active).length
  const totalRegions = useMemo(
    () => cityList.reduce((acc, c) => acc + (c.regions?.length ?? 0), 0),
    [cityList],
  )

  if (isPending) {
    return (
      <div className="space-y-6 animate-fade-rise">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-rise">
      <PageHeader
        title="المدن ومناطق التوصيل"
        description="إدارة تسعير الشحن والتوصيل المحلي، تحديد تكلفة الشحن للمدن والمناطق في ليبيا."
      />

      {/* KPI Metric Summary Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي المدن</span>
            <MapPin className="size-4 text-primary" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-foreground">{formatNumber(totalCities)}</p>
          <p className="text-[11px] text-muted-foreground">مدينة مسجلة في النظام</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>المدن المتاحة للشحن</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">{formatNumber(activeCities)}</p>
          <p className="text-[11px] text-muted-foreground">تستقبل طلبات العملاء</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>إجمالي المناطق والأحياء</span>
            <Truck className="size-4 text-sky-500" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-black text-sky-600 dark:text-sky-400">{formatNumber(totalRegions)}</p>
          <p className="text-[11px] text-muted-foreground">منطقة توصيل فرعية</p>
        </div>
      </div>

      {/* Cities and Regions List */}
      <div className="space-y-4">
        {cityList.map((city) => {
          const isOpen = openId === city.id
          return (
            <div
              key={city.id}
              className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden transition-all duration-200 hover:border-primary/40"
            >
              <div className="flex flex-wrap items-center justify-between gap-3.5 p-4 sm:p-5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                    <MapPin className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm sm:text-base text-foreground truncate">{city.name}</h3>
                      {city.is_active ? (
                        <Badge tone="success" className="text-[10px]">مفعّلة</Badge>
                      ) : (
                        <Badge tone="neutral" className="text-[10px]">غير نشطة</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {city.regions.length} مناطق وأحياء
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 ms-auto">
                  <FeeEditor
                    label="سعر توصيل المدينة:"
                    value={city.delivery_fee}
                    disabled={updateCity.isPending}
                    onSave={(fee) => updateCity.mutate({ id: city.id, delivery_fee: fee })}
                  />

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenId(isOpen ? null : city.id)}
                    className="h-10 rounded-xl text-xs font-bold gap-1.5 shadow-2xs"
                  >
                    <span>المناطق ({city.regions.length})</span>
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-border bg-muted/20 p-4 sm:p-5 space-y-3">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    المناطق والأحياء التابعة لـ {city.name}:
                  </h4>

                  {city.regions.length === 0 ? (
                    <p className="p-4 text-center text-xs text-muted-foreground bg-card rounded-xl border border-dashed border-border">
                      لا توجد مناطق فرعية محددة لهذه المدينة. سيتم تطبيق سعر توصيل المدينة تلقائياً.
                    </p>
                  ) : (
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {city.regions.map((region) => (
                        <div
                          key={region.id}
                          className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border bg-card p-3 shadow-2xs"
                        >
                          <div className="min-w-0">
                            <span className="font-semibold text-xs text-foreground block truncate">{region.name}</span>
                            {!region.is_active && (
                              <span className="text-[10px] text-destructive font-medium">معطّلة</span>
                            )}
                          </div>
                          <FeeEditor
                            value={region.delivery_fee}
                            disabled={updateRegion.isPending}
                            onSave={(fee) => updateRegion.mutate({ id: region.id, delivery_fee: fee })}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FeeEditor({
  label,
  value,
  onSave,
  disabled,
}: {
  label?: string
  value: string
  onSave: (fee: string) => void
  disabled?: boolean
}) {
  const [fee, setFee] = useState(value)
  const isChanged = fee !== value

  return (
    <div className="flex items-center gap-1.5">
      {label && <span className="text-xs text-muted-foreground hidden sm:inline">{label}</span>}
      <div className="relative">
        <input
          type="number"
          step="0.5"
          min="0"
          className="h-9 w-20 sm:w-24 rounded-xl border border-input bg-background px-2 font-mono text-xs font-bold text-price text-center"
          value={fee}
          onChange={(event) => setFee(event.target.value)}
          aria-label="رسوم التوصيل"
        />
      </div>
      {isChanged && (
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => onSave(fee)}
          className="h-9 px-3 rounded-xl text-xs font-bold shadow-2xs"
        >
          حفظ
        </Button>
      )}
    </div>
  )
}
