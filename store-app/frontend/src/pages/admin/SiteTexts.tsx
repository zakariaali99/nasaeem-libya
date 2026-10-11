import { EyeOff, RotateCcw } from 'lucide-react'
import * as React from 'react'

import { PageHeader } from '@/components/layout/AdminLayout'
import { Alert } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { useAdminStoreSettings, useUpdateStoreSettings } from '@/lib/queries/storeSettings'
import { SITE_TEXTS, type SiteTextEntry } from '@/lib/siteText'
import { usePageTitle } from '@/lib/usePageTitle'

/**
 * Every fixed line of wording on the storefront, in one editable list.
 *
 * A line has three states: the built-in wording (no override stored), the
 * operator's own wording, or hidden (an empty override).
 */
export default function SiteTexts() {
  usePageTitle('نصوص المتجر — لوحة التحكم')
  const { data: settings, isPending } = useAdminStoreSettings()
  const update = useUpdateStoreSettings()

  const [overrides, setOverrides] = React.useState<Record<string, string> | null>(null)
  const [dirty, setDirty] = React.useState(false)
  const [message, setMessage] = React.useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // Start from what is stored; keep the operator's edits across a background refetch.
  React.useEffect(() => {
    if (settings && overrides === null) setOverrides({ ...(settings.texts ?? {}) })
  }, [settings, overrides])

  if (isPending || overrides === null) return <Skeleton className="h-96 w-full" />

  const change = (key: string, value: string | undefined) => {
    const next = { ...overrides }
    if (value === undefined) delete next[key]
    else next[key] = value
    setOverrides(next)
    setDirty(true)
    setMessage(null)
  }

  const save = async () => {
    try {
      await update.mutateAsync({ texts: overrides })
      setDirty(false)
      setMessage({ tone: 'success', text: 'تم الحفظ — النصوص الجديدة تظهر في المتجر الآن' })
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'تعذّر الحفظ، حاول مرة أخرى' })
    }
  }

  const groups: { name: string; entries: SiteTextEntry[] }[] = []
  for (const entry of SITE_TEXTS) {
    const group = groups.find((g) => g.name === entry.group)
    if (group) group.entries.push(entry)
    else groups.push({ name: entry.group, entries: [entry] })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="نصوص المتجر"
        description="كل العبارات الثابتة التي يراها العميل خارج الصفحة الرئيسية: أعلى الصفحة، التذييل، صفحة المنتج، السلة وإتمام الطلب. اكتب صيغتك، أو أخفِ السطر."
        action={
          <Button onClick={save} loading={update.isPending} disabled={!dirty} className="rounded-xl font-bold">
            حفظ النصوص
          </Button>
        }
      />

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <Alert tone="info">
        نصوص الصفحة الرئيسية (البانر، العناوين، الأزرار) تُعدَّل من «محرر الواجهة والقوالب»، وبيانات التواصل من «إعدادات المتجر».
      </Alert>

      {groups.map((group) => (
        <section key={group.name} className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
          <h2 className="text-base font-black text-foreground">{group.name}</h2>
          <div className="space-y-4">
            {group.entries.map((entry) => {
              const stored = overrides[entry.key]
              const hidden = stored === ''
              const customised = stored !== undefined && !hidden
              const value = stored ?? entry.fallback
              const inputId = `text-${entry.key}`
              return (
                <div key={entry.key} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor={inputId} className="text-sm font-bold text-foreground">{entry.label}</label>
                    <div className="flex items-center gap-1.5">
                      {hidden ? (
                        <Badge tone="warning" className="text-[11px]">مخفي</Badge>
                      ) : customised ? (
                        <Badge tone="success" className="text-[11px]">صيغتك</Badge>
                      ) : !entry.fallback ? (
                        <Badge tone="neutral" className="text-[11px]">فارغ — لا يظهر</Badge>
                      ) : (
                        <Badge tone="neutral" className="text-[11px]">الصيغة الافتراضية</Badge>
                      )}
                      {!hidden && value && (
                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => change(entry.key, '')}>
                          <EyeOff className="size-3.5" /> إخفاء
                        </Button>
                      )}
                      {stored !== undefined && (
                        <Button type="button" size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => change(entry.key, undefined)}>
                          <RotateCcw className="size-3.5" /> الافتراضي
                        </Button>
                      )}
                    </div>
                  </div>
                  {entry.multiline ? (
                    <textarea
                      id={inputId}
                      rows={2}
                      value={value}
                      onChange={(e) => change(entry.key, e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-4 py-2 text-sm"
                    />
                  ) : (
                    <Input id={inputId} value={value} onChange={(e) => change(entry.key, e.target.value)} />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} loading={update.isPending} disabled={!dirty} size="lg" className="rounded-xl font-bold shadow-lg">
          {dirty ? 'حفظ النصوص' : 'لا توجد تغييرات'}
        </Button>
      </div>
    </div>
  )
}
