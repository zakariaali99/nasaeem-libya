import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatPrice } from '@/lib/format'
import { useCitiesAdmin, useUpdateCity, useUpdateRegion } from '@/lib/queries/orders'

export default function AdminCities() {
  const { data: cities, isPending } = useCitiesAdmin()
  const updateCity = useUpdateCity()
  const updateRegion = useUpdateRegion()
  const [openId, setOpenId] = useState<string | null>(null)

  if (isPending) return <Skeleton className="h-64 w-full" />

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">المدن والمناطق</h1>
      <p className="text-sm text-muted-foreground">
        رسوم التوصيل تأتي من المنطقة أولاً ثم من المدينة عند تركها صفراً.
      </p>
      <ul className="space-y-3">
        {(cities ?? []).map((city) => (
          <li key={city.id} className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span className="font-semibold">{city.name}</span>
              <FeeEditor
                value={city.delivery_fee}
                disabled={updateCity.isPending}
                onSave={(fee) => updateCity.mutate({ id: city.id, delivery_fee: fee })}
              />
              {!city.is_active && <span className="text-destructive">غير نشطة</span>}
              <Button variant="outline" size="sm" onClick={() => setOpenId(openId === city.id ? null : city.id)}>
                المناطق ({city.regions.length})
              </Button>
            </div>
            {openId === city.id && (
              <ul className="divide-y divide-border border-t border-border">
                {city.regions.map((region) => (
                  <li key={region.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span>{region.name}</span>
                    <FeeEditor
                      value={region.delivery_fee}
                      disabled={updateRegion.isPending}
                      onSave={(fee) => updateRegion.mutate({ id: region.id, delivery_fee: fee })}
                    />
                    <span className="text-xs text-muted-foreground">
                      {region.is_active ? '' : 'معطّلة'}
                    </span>
                  </li>
                ))}
                {city.regions.length === 0 && (
                  <li className="p-4 text-center text-sm text-muted-foreground">لا توجد مناطق</li>
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FeeEditor({ value, onSave, disabled }: {
  value: string
  onSave: (fee: string) => void
  disabled?: boolean
}) {
  const [fee, setFee] = useState(value)
  return (
    <span className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        min="0"
        className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
        value={fee}
        onChange={(event) => setFee(event.target.value)}
      />
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => onSave(fee)}>
        حفظ ({formatPrice(fee || '0')})
      </Button>
    </span>
  )
}
