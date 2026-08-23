import { ArrowLeft, Loader2, Printer } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { OfficialInvoice } from '@/components/admin/OfficialInvoice'
import { Button } from '@/components/ui/button'
import { useOrderInvoice } from '@/lib/queries/orders'

export default function AdminOrderInvoicePage() {
  const { orderIdOrNumber } = useParams<{ orderIdOrNumber: string }>()
  const { data: invoice, isLoading, error } = useOrderInvoice(orderIdOrNumber || '')

  const handlePrint = () => {
    window.print()
  }

  if (isLoading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm font-bold text-muted-foreground">جارٍ تجهيز الفاتورة الضريبية الرسمية...</p>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-md mx-auto my-12">
        <p className="text-sm font-bold text-destructive">تعذر تحميل بيانات الفاتورة للطلب</p>
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
      {/* Action Controls Bar */}
      <div className="max-w-[210mm] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm print:hidden">
        <Link
          to={`/admin/orders/${invoice.order_number}`}
          className="flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground transition-colors"
          title="العودة للطلب"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            className="h-9 px-4 text-xs font-bold gap-2 rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90"
          >
            <Printer className="size-4" />
            <span>طباعة الفاتورة (A4)</span>
          </Button>
        </div>
      </div>

      {/* Printable Official Invoice */}
      <div className="print:m-0 print:p-0">
        <OfficialInvoice data={invoice} className="shadow-lg print:shadow-none" />
      </div>
    </div>
  )
}
