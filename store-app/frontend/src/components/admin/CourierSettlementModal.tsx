import { Banknote, CheckCircle2, Loader2, X } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/format'
import { useSettleCourier } from '@/lib/queries/ledger'

interface CourierSettlementModalProps {
  open: boolean
  onClose: () => void
}

const COURIERS = [
  'شركة فانكس إكسبريس (Vanex)',
  'شركة النورس للتوصيل (Nawres)',
  'شركة درب السبيل (Darb Sabeel)',
  'مندوب التوصيل المباشر (Local Courier)',
]

export function CourierSettlementModal({ open, onClose }: CourierSettlementModalProps) {
  const [courierName, setCourierName] = React.useState<string>(COURIERS[0]!)
  const [collectedAmount, setCollectedAmount] = React.useState<string>('500.00')
  const [deliveryFee, setDeliveryFee] = React.useState<string>('25.00')
  const [referenceId, setReferenceId] = React.useState<string>('')
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null)

  const settleMutation = useSettleCourier()

  const parsedCollected = parseFloat(collectedAmount) || 0
  const parsedFee = parseFloat(deliveryFee) || 0
  const bankDeposit = Math.max(0, parsedCollected - parsedFee)

  React.useEffect(() => {
    if (open) {
      setErrorMsg(null)
      setSuccessMsg(null)
      setReferenceId(`SETTLE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`)
    }
  }, [open])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (parsedCollected <= 0) {
      setErrorMsg('يرجى إدخال إجمالي النقدية المحصلة من المندوب')
      return
    }

    if (parsedFee < 0 || parsedFee >= parsedCollected) {
      setErrorMsg('رسوم التوصيل يجب أن تكون أقل من المبلغ المحصل')
      return
    }

    try {
      await settleMutation.mutateAsync({
        courier_name: courierName,
        collected_amount: parsedCollected,
        delivery_fee: parsedFee,
        bank_deposit: bankDeposit,
        reference_id: referenceId,
      })
      setSuccessMsg(`تم تسجيل تسوية وإيداع ${formatPrice(bankDeposit)} بالحساب المصرفي بنجاح.`)
      setTimeout(() => {
        onClose()
      }, 1800)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || 'تعذر تسجيل تسوية المندوب'
      setErrorMsg(msg)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-lg rounded-3xl border border-border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Banknote className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground">تسوية نقدية مندوب / شركة شحن</h2>
              <p className="text-xs text-muted-foreground">توريد مبالغ الدفع عند الاستلام وحسم العمولات</p>
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
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">شركة الشحن أو المندوب:</label>
            <select
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">إجمالي المحصل (د.ل):</label>
              <Input
                type="number"
                step="0.01"
                value={collectedAmount}
                onChange={(e) => setCollectedAmount(e.target.value)}
                className="h-10 font-mono font-bold rounded-xl"
                required
              />
            </div>
            <div>
              <label className="text-xs font-bold text-foreground block mb-1.5">عمولة التوصيل المخصومة (د.ل):</label>
              <Input
                type="number"
                step="0.01"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                className="h-10 font-mono font-bold rounded-xl"
                required
              />
            </div>
          </div>

          {/* Auto Computed Bank Deposit */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">صافي المبلغ المودع بالحساب المصرفي:</span>
            <span className="font-mono font-black text-base text-primary">{formatPrice(bankDeposit)}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5">رقم الإيصال / المرجع المصرفي:</label>
            <Input
              value={referenceId}
              onChange={(e) => setReferenceId(e.target.value)}
              className="h-10 font-mono text-xs rounded-xl"
              placeholder="رقم مرجع الحوالة أو الإيداع..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={settleMutation.isPending}
              className="h-10 rounded-xl text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={settleMutation.isPending || Boolean(successMsg)}
              className="h-10 rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
            >
              {settleMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              <span>تأكيد وترحيل التسوية</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
