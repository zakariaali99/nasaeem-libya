import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { usePaymentRedirect } from '@/lib/queries/payments'
import { usePageTitle } from '@/lib/usePageTitle'

export default function CheckoutRedirectPage() {
  usePageTitle('التحقق من الدفع')
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const orderId = searchParams.get('order_id') || searchParams.get('order') || ''
  const { data, isLoading, isError } = usePaymentRedirect(orderId)

  useEffect(() => {
    if (data?.order_status === 'processing' || data?.order_status === 'completed') {
      const orderNumber = data.order?.order_number || ''
      navigate(`/checkout/complete?order=${encodeURIComponent(orderNumber)}`, { replace: true })
    }
  }, [data, navigate])

  if (!orderId) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">بيانات الدفع غير مكتملة</h1>
        <Alert tone="error">لم يتم العثور على معرّف الطلب للتحقق من عملية الدفع.</Alert>
        <Button asChild>
          <Link to="/cart">العودة إلى السلة</Link>
        </Button>
      </div>
    )
  }

  if (isLoading || data?.order_status === 'pending') {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-6">
        <div className="mx-auto size-12 animate-spin rounded-full border-4 border-border border-t-primary" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">جارٍ تأكيد عملية الدفع…</h1>
          <p className="text-sm text-muted-foreground">
            يرجى الانتظار بينما نتحقق من استلام الدفعة وتأكيد طلبك مع المصرف.
          </p>
        </div>
      </div>
    )
  }

  if (isError || data?.order_status === 'failed' || data?.order_status === 'cancelled') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-6">
        <h1 className="text-2xl font-bold text-destructive">تعذّر تأكيد عملية الدفع</h1>
        <Alert tone="error">
          {data?.message || 'لم تكتمل عملية الدفع أو تم إلغاؤها من قبل المستخدم.'}
        </Alert>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link to="/cart">العودة إلى السلة</Link>
          </Button>
          <Button asChild>
            <Link to={`/checkout/${orderId}`}>إعادة المحاولة</Link>
          </Button>
        </div>
      </div>
    )
  }

  return null
}
