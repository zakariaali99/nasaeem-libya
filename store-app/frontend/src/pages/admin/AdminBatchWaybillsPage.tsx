import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import * as React from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ThermalWaybill } from '@/components/admin/ThermalWaybill'
import { Button } from '@/components/ui/button'
import { useBatchWaybills } from '@/lib/queries/orders'

export default function AdminBatchWaybillsPage() {
  const [searchParams] = useSearchParams()
  const orderIds = React.useMemo(() => {
    const raw = searchParams.get('ids') || ''
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }, [searchParams])

  const { data: waybills, isLoading, error } = useBatchWaybills(orderIds)
  const [format, setFormat] = React.useState<'100x150' | '80mm'>('100x150')

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">
          جارٍ تجهيز {orderIds.length} بوليصة شحن للطباعة المتتالية...
        </p>
      </div>
    )
  }

  if (error || !waybills || waybills.length === 0) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-md mx-auto my-12">
        <p className="text-sm font-bold text-destructive">لم يتم العثور على بوالص للطلبات المحددة</p>
        <Link
          to="/admin/orders"
          className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-primary underline"
        >
          <ArrowLeft className="size-3.5" />
          العودة لقائمة الطلبات
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/40 p-4 sm:p-8 print:p-0 print:bg-white">
      {/* Top Floating Control Bar */}
      <div className="max-w-[100mm] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm print:hidden">
        <Link
          to="/admin/orders"
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          title="العودة لقائمة الطلبات"
        >
          <ArrowLeft className="size-4" />
        </Link>

        {/* Format Selector */}
        <div className="flex items-center rounded-xl bg-muted p-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => setFormat('100x150')}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              format === '100x150'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            4x6 (100x150)
          </button>
          <button
            type="button"
            onClick={() => setFormat('80mm')}
            className={`rounded-lg px-2.5 py-1 transition-colors ${
              format === '80mm'
                ? 'bg-card text-foreground shadow-2xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            80 ملم
          </button>
        </div>

        <Button
          onClick={handlePrint}
          className="h-9 px-3.5 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
        >
          <Printer className="size-4" />
          <span>طباعة الكل ({waybills.length})</span>
        </Button>
      </div>

      {/* Printable Sequential Waybills */}
      <div className="space-y-6 print:space-y-0">
        {waybills.map((w, idx) => (
          <div key={w.order_id || idx} className="print:break-after-page print:mb-0">
            <ThermalWaybill
              data={w}
              format={format}
              className="shadow-lg print:shadow-none mb-6 print:mb-0"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
