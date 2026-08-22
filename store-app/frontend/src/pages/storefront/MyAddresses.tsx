import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/storefront/EmptyState'
import { formatPrice } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useCities, useRegions } from '@/lib/queries/delivery'
import {
  useAddresses,
  useDeleteAddress,
  useSaveAddress,
} from '@/lib/queries/orders'
import type { Address } from '@/types/api'

export default function MyAddresses() {
  usePageTitle('عناويني')
  const { data: addresses, isPending } = useAddresses()
  const [editing, setEditing] = useState<Address | null>(null)
  const [creating, setCreating] = useState(false)

  if (isPending) return <div className="mx-auto max-w-2xl px-4 py-8"><Skeleton className="h-40 w-full" /></div>

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">عناويني</h1>
        <Button size="sm" onClick={() => { setEditing(null); setCreating(true) }}>إضافة عنوان</Button>
      </div>

      {(addresses ?? []).length === 0 && !creating ? (
        <EmptyState title="لا توجد عناوين محفوظة" description="احفظ عنواناً لتسريع إتمام طلباتك القادمة." />
      ) : (
        <ul className="space-y-3">
          {(addresses ?? []).map((address) => (
            <li key={address.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {address.city_name} — {address.region_name}
                    {address.is_default && (
                      <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">الافتراضي</span>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">{address.address}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setCreating(false); setEditing(address) }}>تعديل</Button>
                  <DeleteButton id={address.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <AddressForm
          address={editing}
          onDone={() => { setEditing(null); setCreating(false) }}
        />
      )}
    </div>
  )
}

function DeleteButton({ id }: { id: string }) {
  const remove = useDeleteAddress()
  return (
    <Button
      variant="outline"
      size="sm"
      loading={remove.isPending}
      onClick={() => { if (window.confirm('حذف هذا العنوان؟')) remove.mutate(id) }}
    >
      حذف
    </Button>
  )
}

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const [regionId, setRegionId] = useState(address?.region ?? '')
  const [text, setText] = useState(address?.address ?? '')
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false)
  const save = useSaveAddress(address?.id)
  const { data: cityData } = useCities()
  const cities = cityData?.cities ?? []
  const [cityId, setCityId] = useState(
    cities.find((c) => c.name === address?.city_name)?.id ?? '',
  )
  const { data: regionData } = useRegions(cityId || undefined)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    await save.mutateAsync({ region: regionId, address: text, is_default: isDefault })
    onDone()
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
      <Field label="المدينة" id="addr-city">
        {(props) => (
          <Select {...props} value={cityId} onChange={(e) => setCityId(e.target.value)} required>
            <option value="">اختر المدينة</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </Select>
        )}
      </Field>
      <Field label="المنطقة" id="addr-region">
        {(props) => (
          <Select {...props} value={regionId} onChange={(e) => setRegionId(e.target.value)} disabled={!cityId} required>
            <option value="">{cityId ? 'اختر المنطقة' : 'اختر المدينة أولاً'}</option>
            {(regionData?.regions ?? []).map((region) => (
              <option key={region.id} value={region.id}>{region.name} — {formatPrice(region.delivery_fee)}</option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="العنوان بالتفصيل" id="addr-text">
        {(props) => (
          <Textarea {...props} rows={3} value={text} onChange={(e) => setText(e.target.value)} required />
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        تعيين كعنوان افتراضي
      </label>
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>حفظ</Button>
        <Button type="button" variant="outline" onClick={onDone}>إلغاء</Button>
      </div>
    </form>
  )
}
