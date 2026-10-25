import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/admin/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/format'
import { fetchHideImpact } from '@/lib/queries/catalog'

/** «12 منتجاً», «منتجان», «3 منتجات» — Arabic counts change with the number. */
export function productCount(n: number) {
  if (n === 1) return 'منتج واحد'
  if (n === 2) return 'منتجان'
  if (n >= 3 && n <= 10) return `${formatNumber(n)} منتجات`
  return `${formatNumber(n)} منتجاً`
}

/** On the store, hidden on its own, or hidden with a parent / brand. */
export function StoreVisibilityBadge({ hidden, because }: { hidden: boolean; because?: string }) {
  if (hidden) return <Badge tone="neutral">مخفي من المتجر</Badge>
  if (because) return <Badge tone="warning">مخفي مع «{because}»</Badge>
  return <Badge tone="success">ظاهر في المتجر</Badge>
}

interface Switchable {
  id: string
  name: string
  is_active: boolean
}

/**
 * The eye button on a category, brand or collection. Hiding asks first and
 * says how many products go with it; showing again needs no confirmation —
 * every product comes back exactly as it was.
 */
export function useStoreVisibilitySwitch(
  kind: 'categories' | 'collections',
  save: (id: string, isActive: boolean) => Promise<unknown>,
) {
  const [pending, setPending] = useState<(Switchable & { count: number }) | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const toggle = async (item: Switchable) => {
    setBusyId(item.id)
    try {
      if (!item.is_active) {
        await save(item.id, true)
        return
      }
      setPending({ ...item, count: await fetchHideImpact(kind, item.id) })
    } finally {
      setBusyId(null)
    }
  }

  const pronoun = kind === 'collections' ? 'معها' : 'معه'
  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={`إخفاء «${pending?.name ?? ''}» من المتجر`}
      description={
        pending && pending.count > 0
          ? `سيُخفى ${pronoun} ${productCount(pending.count)} من المتجر. تبقى كلها هنا في لوحة التحكم، وتعود كما كانت عند الإظهار.`
          : 'لا توجد فيه منتجات ظاهرة الآن. سيختفي من قوائم المتجر فقط.'
      }
      confirmLabel="إخفاء من المتجر"
      loading={saving}
      onConfirm={async () => {
        if (!pending) return
        setSaving(true)
        try {
          await save(pending.id, false)
          setPending(null)
        } finally {
          setSaving(false)
        }
      }}
    />
  )

  const button = (item: Switchable) => (
    <Button
      variant="ghost"
      size="icon"
      loading={busyId === item.id}
      aria-label={item.is_active ? `إخفاء ${item.name} من المتجر` : `إظهار ${item.name} في المتجر`}
      title={item.is_active ? 'إخفاء من المتجر' : 'إظهار في المتجر'}
      onClick={() => toggle(item)}
    >
      {busyId === item.id ? null : item.is_active ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
    </Button>
  )

  return { button, dialog }
}
