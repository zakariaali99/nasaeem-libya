'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useCart } from '@/hooks/use-cart';
import { cartClient } from '@/modules/cart/client/cartClient';
import { CheckIcon, XCircleIcon, LoaderIcon } from 'lucide-react';
import { trackEvent, trackCheckoutRecovery } from '@/modules/analytics/client/analyticsClient';
import CheckoutCompleteClient from './CheckoutCompleteClient';

export default function CheckoutCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-16 text-center" dir="rtl">
          <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">جاري تحميل الصفحة</h1>
          <p className="text-gray-600">يرجى الانتظار لحظات...</p>
        </div>
      }
    >
      <CheckoutCompleteClient />
    </Suspense>
  );
}

// function CheckoutCompleteInner() {
//   const searchParams = useSearchParams();
//   const router = useRouter();
//   const cart = useCart();
  
//   const paymentId = searchParams.get('paymentId');
//   const [orderDetails, setOrderDetails] = useState<{
//     orderId?: string;
//     orderNumber?: string;
//   }>({});
  
//   const verifyMutation = useMutation({
//     mutationFn: async () => {
//       if (!paymentId) throw new Error('معرف الدفع غير موجود');

//       // مرّر جميع بارامترات العودة من مزود الدفع للتحقق (approved, transaction_id, hashed, إلخ)
//       const verificationPayload: Record<string, any> = {};
//       let rawQuery = '';
//       const entries: Record<string, string> = {};
//       searchParams.forEach((value, key) => {
//         entries[key] = value;
//       });
//       // احتفظ بالترتيب الأصلي للسلسلة لضمان تطابق HMAC
//       rawQuery = window.location.search.startsWith('?') ? window.location.search.slice(1) : window.location.search;

//       verificationPayload.__rawQuery = rawQuery;
//       Object.assign(verificationPayload, entries);
//       verificationPayload.paymentId = paymentId;

//       const response = await fetch(`/api/checkout/verify?paymentId=${paymentId}`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(verificationPayload),
//       });
      
//       if (!response.ok) {
//         const error = await response.json();
//         throw new Error(error.error || 'فشل التحقق من الدفع');
//       }
      
//       return response.json();
//     },
//     onSuccess: (data) => {
//       setOrderDetails({
//         orderId: data.orderId,
//         orderNumber: data.orderNumber,
//       });
//       trackEvent('payment_verified', { paymentId, orderId: data.orderId, orderNumber: data.orderNumber });
      
//       // Manually clear cart and refresh cart state
//       cartClient.clearCart().then(() => {
//         cartClient.fetchCart(); // Refresh the cart state to notify all listeners
//         console.log('Payment verified successfully, cart cleared');
//       });
//     },
//   });
  
//   useEffect(() => {
//     if (paymentId) {
//       verifyMutation.mutate();
//     }
//   }, [paymentId]);

//   useEffect(() => {
//     if (verifyMutation.isError && paymentId) {
//       trackCheckoutRecovery('verify_failed', { paymentId, message: verifyMutation.error instanceof Error ? verifyMutation.error.message : 'unknown' });
//     }
//   }, [verifyMutation.isError, verifyMutation.error, paymentId]);
  
//   // Handle different states
//   if (!paymentId) {
//     return (
//       <div className="container mx-auto px-4 py-8 text-center" dir="rtl">
//         <Alert variant="destructive" className="mb-4">
//           <AlertTitle className="text-xl font-bold">خطأ في الدفع</AlertTitle>
//           <AlertDescription>
//             لم يتم العثور على معلومات الدفع. يرجى المحاولة مرة أخرى.
//           </AlertDescription>
//         </Alert>
//         <Button onClick={() => router.push('/cart')} className="mt-4">
//           العودة إلى سلة التسوق
//         </Button>
//       </div>
//     );
//   }
  
//   if (verifyMutation.isPending) {
//     return (
//       <div className="container mx-auto px-4 py-16 text-center" dir="rtl">
//         <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
//         <h1 className="text-2xl font-bold mb-2">جاري التحقق من الدفع</h1>
//         <p className="text-gray-600">يرجى الانتظار بينما نتحقق من حالة طلبك...</p>
//       </div>
//     );
//   }
  
//   if (verifyMutation.isError) {
//     return (
//       <div className="container mx-auto px-4 py-8 text-center" dir="rtl">
//         <div className="mb-6">
//           <XCircleIcon className="mx-auto h-16 w-16 text-red-500" />
//         </div>
//         <Alert variant="destructive" className="mb-4">
//           <AlertTitle className="text-xl font-bold">فشل الدفع</AlertTitle>
//           <AlertDescription>
//             {verifyMutation.error instanceof Error 
//               ? verifyMutation.error.message 
//               : 'حدث خطأ أثناء التحقق من الدفع'}
//           </AlertDescription>
//         </Alert>
//           {verifyMutation.error instanceof Error && (
//             <p className="text-sm text-gray-500 mb-4">تم تسجيل محاولة فاشلة للمرجع: {paymentId}</p>
//           )}
//         <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
//           <Button 
//             variant="outline" 
//             onClick={() => verifyMutation.mutate()}
//               onMouseDown={() => trackCheckoutRecovery('retry_verify', { paymentId })}
//           >
//             إعادة المحاولة
//           </Button>
//           <Button 
//             onClick={() => router.push('/cart')}
//           >
//             العودة إلى سلة التسوق
//           </Button>
//         </div>
//       </div>
//     );
//   }
  
//   if (verifyMutation.isSuccess) {
//     // Payment successful
//     return (
//       <div className="container mx-auto px-4 py-8 text-center" dir="rtl">
//         <div className="mb-6">
//           <div className="mx-auto h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
//             <CheckIcon className="h-10 w-10 text-green-600" />
//           </div>
//         </div>
//         <h1 className="text-3xl font-bold mb-2">تم تأكيد طلبك!</h1>
//         <p className="text-xl mb-6">شكرًا لك على الشراء</p>
        
//         <div className="bg-gray-50 rounded-lg p-6 mb-6 max-w-md mx-auto">
//           <div className="flex justify-between mb-2">
//             <span className="font-medium">رقم الطلب:</span>
//             <span>{orderDetails.orderNumber}</span>
//           </div>
//           <div className="border-t border-gray-200 my-4"></div>
//           <p className="text-gray-600 mb-4">
//             سيتم إرسال تفاصيل الطلب إليك قريبًا.
//           </p>
//           {(!cart || cart.items.length === 0) && (
//             <div className="bg-green-50 border border-green-200 rounded p-3 mt-4">
//               <p className="text-green-800 text-sm">
//                 ✓ تم إفراغ سلة التسوق بعد تأكيد الطلب
//               </p>
//             </div>
//           )}
//         </div>
        
//         <div className="flex flex-col sm:flex-row justify-center gap-4">
//           <Button 
//             variant="outline" 
//             onClick={() => router.push('/')}
//           >
//             {(!cart || cart.items.length === 0) ? 'ابدأ بالتسوق' : 'مواصلة التسوق'}
//           </Button>
//           <Button 
//             onClick={() => router.push(`/me/orders/${orderDetails.orderId}`)}
//           >
//             عرض تفاصيل الطلب
//           </Button>
//         </div>
//       </div>
//     );
//   }
  
//   // Fallback
//   return (
//     <div className="container mx-auto px-4 py-8 text-center" dir="rtl">
//       <Alert className="mb-4">
//         <AlertTitle>جاري التحقق من حالة الطلب</AlertTitle>
//         <AlertDescription>
//           يرجى الانتظار بينما نتأكد من حالة طلبك...
//         </AlertDescription>
//       </Alert>
//       <Button onClick={() => router.push('/cart')} className="mt-4">
//         العودة إلى سلة التسوق
//       </Button>
//     </div>
//   );
// }
