import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/storefront/EmptyState'
import { ApiError } from '@/lib/api'
import { FEATURES } from '@/lib/features'
import { formatPrice } from '@/lib/format'
import { usePageTitle } from '@/lib/usePageTitle'
import { useCities, useRegions } from '@/lib/queries/delivery'
import {
  useAddresses,
  useDeleteAddress,
  useSaveAddress,
} from '@/lib/queries/orders'
import type { Address } from '@/types/api'
import { t } from '@/lib/i18n'

export default function MyAddresses() {
  usePageTitle(t('addresses.title'))
  const { data: addresses, isPending } = useAddresses()
  const [editing, setEditing] = useState<Address | null>(null)
  const [creating, setCreating] = useState(false)

  if (isPending) return <div className="mx-auto max-w-2xl px-4 py-8"><Skeleton className="h-40 w-full" /></div>

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('addresses.title')}</h1>
        <Button size="sm" onClick={() => { setEditing(null); setCreating(true) }}>{t('addresses.add')}</Button>
      </div>

      {(addresses ?? []).length === 0 && !creating ? (
        <EmptyState title={t('addresses.emptyTitle')} description={t('addresses.emptyText')} />
      ) : (
        <ul className="space-y-3">
          {(addresses ?? []).map((address) => (
            <li key={address.id} className="rounded-lg border border-border bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {[address.city_name, address.region_name].filter(Boolean).join(' — ')}
                    {address.is_default && (
                      <span className="ms-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{t('addresses.default')}</span>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">{address.address}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setCreating(false); setEditing(address) }}>{t('addresses.edit')}</Button>
                  <DeleteButton id={address.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <AddressForm
          key={editing?.id ?? 'new'}
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
      onClick={() => { if (window.confirm(t('addresses.confirmDelete'))) remove.mutate(id) }}
    >
      {t('addresses.delete')}
    </Button>
  )
}

function AddressForm({ address, onDone }: { address: Address | null; onDone: () => void }) {
  const [cityId, setCityId] = useState(address?.city ?? '')
  const [regionId, setRegionId] = useState(address?.region ?? '')
  const [text, setText] = useState(address?.address ?? '')
  const [isDefault, setIsDefault] = useState(address?.is_default ?? false)
  const [error, setError] = useState<string | null>(null)
  const save = useSaveAddress(address?.id)
  const { data: cityData } = useCities()
  const cities = [...(cityData?.cities ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  const { data: regionData } = useRegions(cityId || undefined)
  const regions = regionData?.regions ?? []

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!cityId) return setError(t('addresses.chooseCity'))
    if (!text.trim()) return setError(t('addresses.writeAddress'))
    try {
      // The region is optional: most cities have none defined, and requiring
      // one made the form impossible to submit for them.
      await save.mutateAsync({ city: cityId, region: regionId || null, address: text.trim(), is_default: isDefault })
      onDone()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : t('addresses.saveFailed'))
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-6 space-y-4 rounded-lg border border-border bg-card p-4">
      <Field label={t('addresses.city')} id="addr-city">
        {(props) => (
          <Select
            {...props}
            value={cityId}
            onChange={(e) => { setCityId(e.target.value); setRegionId('') }}
            required
          >
            <option value="">{t('addresses.chooseCity')}</option>
            {cities.map((city) => <option key={city.id} value={city.id}>{city.name}</option>)}
          </Select>
        )}
      </Field>
      {regions.length > 0 ? (
        <Field label={t('addresses.region')} id="addr-region">
          {(props) => (
            <Select {...props} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">{t('addresses.allRegions')}</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>{region.name}{FEATURES.shipping ? ` — ${formatPrice(region.delivery_fee)}` : ''}</option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label={t('addresses.address')} id="addr-text">
        {(props) => (
          <Textarea
            {...props}
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('addresses.placeholder')}
            required
          />
        )}
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        {t('addresses.makeDefault')}
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" loading={save.isPending}>{t('addresses.save')}</Button>
        <Button type="button" variant="outline" onClick={onDone}>{t('common.cancel')}</Button>
      </div>
    </form>
  )
}
