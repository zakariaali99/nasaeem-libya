import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/format'
import { useProcessRefund } from '@/lib/queries/ledger'
import type { Order } from '@/types/api'

interface RefundModalProps {
  order: Order
  open: boolean
  onClose: () => void
}

const COMMON_REASONS = [
  'طلب العميل إلغاء الطلب واسترجاع المبلغ',
  'عدم توفر الصنف أو نفاد المخزون',
  'إرجاع العطر بعد الاستلام وبحالته الأصلية',
  'خطأ في عملية التحويل أو السداد المزدوج',
  'أخرى (تحديد يدوي)',
]

export function RefundModal({ order, open, onClose }: RefundModalProps) {
  const payment = order.payments?.[0]
  const paymentId = payment?.id || ''
  const maxRefundable = parseFloat(payment?.amount || order.total || '0')

  const [amount, setAmount] = React.useState<string>(String(maxRefundable))
  const [reasonPreset, setReasonPreset] = React.useState<string>(COMMON_REASONS[0]!)
  const [customReason, setCustomReason] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const refundMutation = useProcessRefund(paymentId)

  React.useEffect(() => {
    if (open) {
      setAmount(String(maxRefundable))
      setReasonPreset(COMMON_REASONS[0]!)
      setCustomReason('')
      setErrorMsg(null)
      setSuccessMsg(null)
    }
  }, [open, maxRefundable])

  if (!open) return null

  const handleFullRefund = () => {
    setAmount(String(maxRefundable))
  }

  const handleHalfRefund = () => {
    setAmount(String((maxRefundable / 2).toFixed(2)))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('يرجى إدخال مبلغ استرداد صحيح أكبر من الصفر')
      return
    }

    if (numAmount > maxRefundable) {
      setErrorMsg(`مبلغ الاسترداد يتجاوز الحد الأقصى المتاح (${formatPrice(maxRefundable)})`)
      return
    }

    const finalReason = reasonPreset === 'أخرى (تحديد يدوي)' ? customReason : reasonPreset
    if (!finalReason.trim()) {
      setErrorMsg('يرجى تحديد أو كتابة سبب الاسترداد')
      return
    }

    try {
      const res = await refundMutation.mutateAsync({
        amount: numAmount,
        reason: finalReason,
      })
      setSuccessMsg(`تم استرداد ${formatPrice(res.amount)} بنجاح وتم ترحيل القيود المحاسبية.`)
      setTimeout(() => {
        onClose()
      }, 1800)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'تعذر معالجة طلب الاسترداد'
      setErrorMsg(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <RotateCcw className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">استرداد مالي للطلب #{order.order_number}</h2>
              <p className="text-xs text-muted-foreground">
                المبلغ الأصلي المسدد: <strong className="text-foreground font-mono">{formatPrice(maxRefundable)}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Alert / Warning */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-xs text-foreground mb-4">
          <AlertTriangle className="size-4 text-primary shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            سيتم إرجاع المبلغ المسجل للعميل إلكترونياً أو خصمه من رصيد الحساب المصرفي وتسجيل قيد عكسي بدفتر الأستاذ المالي.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs font-bold text-destructive">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-xs font-bold text-primary">
            <CheckCircle2 className="size-4" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-foreground">مبلغ الاسترداد (د.ل):</label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleFullRefund}
                  className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground hover:bg-muted/80 transition-colors"
                >
                  كامل المبلغ ({formatPrice(maxRefundable)})
                </button>
                <button
                  type="button"
                  onClick={handleHalfRefund}
                  className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-bold text-foreground hover:bg-muted/80 transition-colors"
                >
                  النصف (50%)
                </button>
              </div>
            </div>
            <Input
              type="number"
              step="0.01"
              max={maxRefundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-10 text-base font-mono font-bold rounded-xl"
              required
            />
          </div>

          {/* Reason Selection */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">سبب الاسترداد:</label>
            <select
              value={reasonPreset}
              onChange={(e) => setReasonPreset(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {COMMON_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {reasonPreset === 'أخرى (تحديد يدوي)' && (
            <div>
              <Input
                placeholder="اكتب سبب الاسترداد بالتفصيل..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={refundMutation.isPending}
              className="h-10 rounded-xl text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={refundMutation.isPending || Boolean(successMsg)}
              className="h-10 rounded-xl text-xs font-bold gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xs"
            >
              {refundMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              <span>تأكيد الاسترداد المالي</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
