'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoaderIcon } from 'lucide-react';
import { trackCheckoutRecovery } from '@/modules/analytics/client/analyticsClient';

// This is a simple redirect page that catches users returning from payment providers
// and sends them to the checkout complete page with their paymentId
export default function PaymentRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Extract paymentId from URL or query parameters
    // Different payment gateways might return different parameters
    const url = new URL(window.location.href);
    const paymentId = url.searchParams.get('paymentId') || 
                      url.searchParams.get('payment_id') || 
                      url.searchParams.get('pid');
    
    if (paymentId) {
      // Redirect to checkout complete page with the paymentId
      trackCheckoutRecovery('redirect_landing', { paymentId });
      router.push(`/checkout/complete?paymentId=${paymentId}`);
    } else {
      // If no paymentId found, redirect to cart page
      trackCheckoutRecovery('redirect_missing_payment', {});
      router.push('/cart');
    }
  }, [router]);
  
  return (
    <div className="container mx-auto py-16 text-center" dir="rtl">
      <LoaderIcon className="mx-auto h-12 w-12 animate-spin text-primary mb-4" />
      <h1 className="text-2xl font-bold mb-2">جاري التحقق من عملية الدفع</h1>
      <p className="text-gray-600">يرجى الانتظار، سيتم توجيهك خلال لحظات...</p>
    </div>
  );
}
