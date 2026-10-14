import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { describeEffect, STAGE_BY_VALUE, STAGES } from '@/lib/orderStages'
import { previewStageChange, useChangeStage } from '@/lib/queries/orders'
import { cn } from '@/lib/utils'
import type { Order, OrderStage, StagePreview } from '@/types/api'

/**
 * The order's stage as a coloured drop-down: pick any stage, from any stage.
 *
 * Every pick is first asked of the server as a dry run. A plain step forward
 * that needs nothing from the operator is applied at once; a step back, a
 * cancellation or return, a missing stock, or anything that moves money opens
 * a confirmation that says exactly what will happen.
 */
export function OrderStageSelect({
  order,
  size = 'md',
  onChanged,
}: {
  order: Pick<Order, 'id' | 'order_number' | 'stage' | 'items'>
  size?: 'sm' | 'md'
  /** Called with the stage the order moved to. */
  onChanged?: (stage: OrderStage) => void
}) {
  const change = useChangeStage(order.id)
  const [checking, setChecking] = React.useState(false)
  const [preview, setPreview] = React.useState<StagePreview | null>(null)
  const [note, setNote] = React.useState('')
  const [damaged, setDamaged] = React.useState<string[]>([])
  const [error, setError] = React.useState<string | null>(null)
  const current = STAGE_BY_VALUE[order.stage] ?? STAGES[0]!
  const busy = checking || change.isPending

  const apply = async (stage: OrderStage, extra: { note?: string; damaged?: string[]; allowShort?: boolean } = {}) => {
    setError(null)
    try {
      await change.mutateAsync({
        stage,
        note: extra.note || undefined,
        damaged_item_ids: extra.damaged?.length ? extra.damaged : undefined,
        allow_short: extra.allowShort || undefined,
      })
      setPreview(null)
      onChanged?.(stage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تغيير المرحلة')
    }
  }

  const pick = async (stage: OrderStage) => {
    if (stage === order.stage) return
    setChecking(true)
    setError(null)
    try {
      const result = await previewStageChange(order.id, stage)
      const quiet =
        !result.backward &&
        result.shortages.length === 0 &&
        !result.effects.some((e) => e.kind === 'sale_reversed' || e.kind === 'stock_back')
      if (quiet) {
        await apply(stage)
      } else {
        setNote('')
        setDamaged([])
        setPreview(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تغيير المرحلة')
    } finally {
      setChecking(false)
    }
  }

  const target = preview ? STAGE_BY_VALUE[preview.to_stage] : null
  const returning = preview?.to_stage === 'returned' && preview.effects.some((e) => e.kind === 'stock_back')

  return (
    <div className="inline-flex flex-col items-start gap-1" onClick={(e) => e.stopPropagation()}>
      <label className="relative inline-flex items-center">
        <span className="sr-only">مرحلة الطلب {order.order_number}</span>
        <current.icon
          className={cn('pointer-events-none absolute start-2.5 size-3.5', size === 'sm' && 'start-2')}
          aria-hidden="true"
        />
        <select
          value={order.stage}
          disabled={busy}
          onChange={(e) => pick(e.target.value as OrderStage)}
          className={cn(
            'appearance-none rounded-full border font-bold transition-colors cursor-pointer',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
            size === 'sm' ? 'h-9 ps-7 pe-7 text-xs' : 'h-11 ps-8 pe-8 text-sm',
            current.tone,
          )}
        >
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {busy ? (
          <Loader2 className="pointer-events-none absolute end-2.5 size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown className="pointer-events-none absolute end-2.5 size-3.5" aria-hidden="true" />
        )}
      </label>
      {error && !preview ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent>
          {preview && target ? (
            <div className="space-y-4">
              <DialogTitle>
                نقل الطلب <bdi className="font-mono">#{order.order_number}</bdi> إلى «{target.label}»
              </DialogTitle>
              <DialogDescription>
                من «{STAGE_BY_VALUE[preview.from_stage].label}». هذا ما سيحدث:
              </DialogDescription>

              {preview.effects.length ? (
                <ul className="space-y-1.5 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  {preview.effects.map((effect, i) => (
                    <li key={i}>{describeEffect(effect)}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">لا يتغير شيء في المخزون أو المبالغ.</p>
              )}

              {preview.shortages.length ? (
                <div className="space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="alert">
                  <p className="flex items-center gap-1.5 font-bold text-warning">
                    <AlertTriangle className="size-4" aria-hidden="true" /> المخزون المسجّل لا يكفي
                  </p>
                  {preview.shortages.map((s) => (
                    <p key={s.item}>
                      «{s.item}»: المطلوب {s.needed}، المتوفر {s.available}
                    </p>
                  ))}
                  <p className="text-xs text-muted-foreground">إن كانت البضاعة موجودة فعلاً يمكنك المتابعة.</p>
                </div>
              ) : null}

              {returning ? (
                <fieldset className="space-y-1">
                  <legend className="text-sm font-bold">منتجات رجعت تالفة (لا تُعاد للمخزون):</legend>
                  {order.items.map((item) => (
                    <label key={item.id} className="flex items-center gap-1 text-sm">
                      <Checkbox
                        checked={damaged.includes(item.id)}
                        onCheckedChange={(checked) =>
                          setDamaged((prev) =>
                            checked ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                          )
                        }
                      />
                      {item.product_name} × {item.quantity}
                    </label>
                  ))}
                </fieldset>
              ) : null}

              <label className="block space-y-1.5">
                <span className="text-sm font-bold">السبب (اختياري، يُحفظ في سجل الطلب)</span>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="مثال: شركة التوصيل أخطأت، العميل استلم الطلب"
                  className="min-h-20"
                />
              </label>

              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  تراجع
                </Button>
                <Button
                  variant={preview.to_stage === 'cancelled' ? 'destructive' : 'default'}
                  loading={change.isPending}
                  onClick={() =>
                    apply(preview.to_stage, { note, damaged, allowShort: preview.shortages.length > 0 })
                  }
                >
                  {preview.shortages.length ? 'متابعة رغم النقص' : `نقل إلى «${target.label}»`}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
