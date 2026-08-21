'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useCart } from '@/hooks/use-cart';
import { cartClient } from '@/modules/cart/client/cartClient';
import { PaymentMethodCode } from '@/modules/payments/types/paymentTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect } from 'react';
import { useRef } from 'react';
import { LoaderIcon } from 'lucide-react';
import { trackEvent } from '@/modules/analytics/client/analyticsClient';

// Type declaration for Moamalat Lightbox
declare global {
  interface Window {
    Lightbox?: {
      Checkout: {
        configure: any;
        showLightbox: () => void;
        closeLightbox: () => void;
      };
    };
  }
}

// تعريف نوع البيانات لإرجاع طرق الدفع العامة
interface PaymentMethodOption {
  methodCode: string;
  displayName: string;
  description?: string;
  userInputFields?: { name: string; label: string; type: string }[];
  metadata?: {
    scriptUrl?: string;
    sandboxMode?: boolean;
    [key: string]: any;
  };
}

// خريطة الأيقونات لكل طريقة دفع
const iconMap: Record<string, string> = {
  binance_pay: '/binance.svg',
  manual_payment: '/manual.svg',
  sadad_pay: '/sadad.png',
  moamalat: '/moamalat.svg',
  vanex: '/vanex.svg',
  plutu_sadad: '/sadad.png',
  plutu_edfali: '/Edfali.png',
  plutu_mpgs: '/mastercard.svg',
  plutu_tlync: '/t-lync.png',
  plutu_local_cards: '/moamalat.svg',
  bank_cards_on_delivery: '/bank_cards.svg',
};

const plutuOtpCodes = [PaymentMethodCode.PLUTU_SADAD, PaymentMethodCode.PLUTU_EDFALI];
const plutuTlyncCodes = [PaymentMethodCode.PLUTU_TLYNC];

export default function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const router = useRouter();
  const cart = useCart();
  const [selected, setSelected] = useState<string | null>(null);
  const [userInputs, setUserInputs] = useState<Record<string, any>>({});
  const [resolvedOrderId, setResolvedOrderId] = useState<string | null>(null);
  const [lightboxLoaded, setLightboxLoaded] = useState(false);
  const [pendingLightboxConfig, setPendingLightboxConfig] = useState<any>(null);

  // Add loading states
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Plutu (سداد/إدفعلي) modal flow
  const [plutuModalOpen, setPlutuModalOpen] = useState(false);
  const [plutuStep, setPlutuStep] = useState<'info' | 'otp' | 'tlync'>('info');
  const [plutuInputs, setPlutuInputs] = useState<{ mobile_number?: string; birth_year?: string; otp?: string; processId?: string; email?: string }>({});
  const [plutuPaymentId, setPlutuPaymentId] = useState<string | null>(null);
  const isPlutuOtpSelected = selected ? plutuOtpCodes.includes(selected as PaymentMethodCode) : false;
  const isPlutuTlyncSelected = selected ? plutuTlyncCodes.includes(selected as PaymentMethodCode) : false;

  // Add a ref to track verification timeout
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Add a ref to track if verification was already completed successfully
  const verificationCompletedRef = useRef<boolean>(false);

  const {
    data: methods,
    isLoading,
    error: methodsError,
  } = useQuery<PaymentMethodOption[], Error>({
    queryKey: ['paymentMethods'],
    queryFn: async () => {
      const res = await fetch('/api/payment_methods');
      if (!res.ok) throw new Error('فشل في جلب طرق الدفع');
      return res.json();
    }
  });

  useEffect(() => {
    params.then((p) => setResolvedOrderId(p.orderId)).catch(() => setResolvedOrderId(null));
  }, [params]);

  const initiateMutation = useMutation({
    mutationFn: async () => {
      const { orderId } = await params;
      if (!selected) throw new Error('يرجى اختيار طريقة دفع');
      if (!orderId) throw new Error('معرف الطلب مفقود');

      // Tlync يتطلب رقم هاتف
      if (plutuTlyncCodes.includes(selected as PaymentMethodCode)) {
        if (!userInputs.mobile_number) throw new Error('يرجى إدخال رقم الهاتف لقناة Tlync');
      }

      setIsProcessingPayment(true);
      return cartClient.initiatePayment(orderId, selected, userInputs);
    },
    onSuccess: (data) => {
      console.log('Payment initiation response:', data);
      trackEvent('payment_initiated', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected });

      // Handle Moamalat Lightbox flow
      if (selected === PaymentMethodCode.MOAMALAT) {
        const selectedMethod = methods?.find(m => m.methodCode === PaymentMethodCode.MOAMALAT);
        const environment = selectedMethod?.metadata?.sandboxMode ? 'اختبار' : 'إنتاج';
        console.log(`Handling Moamalat lightbox with config (${environment} environment):`, data.lightboxConfig);
        // Store lightbox config for handling by the effect/handler
        handleLightbox(data.lightboxConfig);
        // DO NOT navigate away - let the lightbox complete callback handle navigation
        return;
      }

      // Plutu OTP channels: إذا كنا في خطوة OTP وأُعيدت نتيجة نجاح
      if (selected && plutuOtpCodes.includes(selected as PaymentMethodCode)) {
        setIsProcessingPayment(false);
        setPlutuModalOpen(false);
        trackEvent('payment_success', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected, mode: 'plutu_otp' });
        router.push(`/checkout/complete?paymentId=${data.paymentId}`);
        return;
      }

      // Handle redirect-based payment methods
      if (data.redirectUrl) {
        // للطرق التي تعيد رابط إعادة توجيه (Redirect)
        setIsProcessingPayment(false);
        trackEvent('payment_redirect', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected });
        window.location.href = data.redirectUrl;
      } else {
        // للطرق الأخرى (كالدفع اليدوي)
        setIsProcessingPayment(false);
        trackEvent('payment_success', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected });
        router.push(`/checkout/complete?paymentId=${data.paymentId}`);
      }
    },
    onError: (error) => {
      setIsProcessingPayment(false);
      console.error('Payment error:', error);
      trackEvent('payment_failed', { orderId: resolvedOrderId, paymentMethod: selected, reason: error instanceof Error ? error.message : 'unknown' });
    }
  });

  // إرسال OTP لبلوتو (سداد/إدفعلي)
  const sendPlutuOtp = useMutation({
    mutationFn: async () => {
      const { orderId } = await params;
      if (!selected || !plutuOtpCodes.includes(selected as PaymentMethodCode)) throw new Error('طريقة بلوتو غير صالحة');
      if (!plutuInputs.mobile_number || !plutuInputs.birth_year) throw new Error('يرجى إدخال رقم الهاتف وسنة الميلاد');
      setIsProcessingPayment(true);
      return cartClient.initiatePayment(orderId, selected, {
        mobile_number: plutuInputs.mobile_number,
        birth_year: plutuInputs.birth_year,
      });
    },
    onSuccess: (data) => {
      setIsProcessingPayment(false);
      const processId = data?.data?.processId || data?.data?.process_id;
      setPlutuPaymentId(data?.paymentId || null);
      setPlutuInputs(prev => ({ ...prev, processId, otp: '' }));
      setPlutuStep('otp');
      trackEvent('payment_otp_sent', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected });
    },
    onError: (error: any) => {
      setIsProcessingPayment(false);
      alert(error?.message || 'فشل إرسال رمز التحقق');
      trackEvent('payment_failed', { orderId: resolvedOrderId, paymentMethod: selected, reason: error?.message || 'otp_send_failed' });
    }
  });

  const confirmPlutuOtp = useMutation({
    mutationFn: async () => {
      const { orderId } = await params;
      if (!selected || !plutuOtpCodes.includes(selected as PaymentMethodCode)) throw new Error('طريقة بلوتو غير صالحة');
      if (!plutuInputs.otp) throw new Error('يرجى إدخال رمز التحقق');
      if (!plutuInputs.processId) throw new Error('معرّف العملية مفقود. يرجى طلب رمز جديد.');
      setIsProcessingPayment(true);
      // Always call API with orderId; paymentId is only for redirect after success
      return cartClient.initiatePayment(orderId, selected, {
        mobile_number: plutuInputs.mobile_number,
        birth_year: plutuInputs.birth_year,
        otp: plutuInputs.otp,
        processId: plutuInputs.processId,
      });
    },
    onSuccess: (data) => {
      setIsProcessingPayment(false);
      setPlutuModalOpen(false);
      const paymentQueryId = data?.paymentId || plutuPaymentId || resolvedOrderId || '';
      trackEvent('payment_success', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected, mode: 'plutu_otp_confirm' });
      router.push(`/checkout/complete?paymentId=${paymentQueryId}`);
    },
    onError: (error: any) => {
      setIsProcessingPayment(false);
      alert(error?.message || 'فشل تأكيد رمز التحقق');
      trackEvent('payment_failed', { orderId: resolvedOrderId, paymentMethod: selected, reason: error?.message || 'otp_confirm_failed' });
    }
  });

  // بدء Tlync بعد جمع رقم الهاتف
  const startPlutuTlync = useMutation({
    mutationFn: async () => {
      const { orderId } = await params;
      if (!selected || !plutuTlyncCodes.includes(selected as PaymentMethodCode)) throw new Error('طريقة بلوتو غير صالحة');
      if (!plutuInputs.mobile_number) throw new Error('يرجى إدخال رقم الهاتف');
      setIsProcessingPayment(true);
      return cartClient.initiatePayment(orderId, selected, {
        ...userInputs,
        mobile_number: plutuInputs.mobile_number,
        email: plutuInputs.email,
      });
    },
    onSuccess: (data) => {
      setIsProcessingPayment(false);
      setPlutuModalOpen(false);
      if (data.redirectUrl) {
        trackEvent('payment_redirect', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected, mode: 'tlync' });
        window.location.href = data.redirectUrl;
        return;
      }
      trackEvent('payment_success', { orderId: resolvedOrderId || data.orderId || null, paymentMethod: selected, mode: 'tlync' });
      router.push(`/checkout/complete?paymentId=${data.paymentId}`);
    },
    onError: (error: any) => {
      setIsProcessingPayment(false);
      alert(error?.message || 'فشل بدء الدفع عبر Tlync');
      trackEvent('payment_failed', { orderId: resolvedOrderId, paymentMethod: selected, reason: error?.message || 'tlync_failed' });
    }
  });

  // Reset Plutu modal state when switching away
  useEffect(() => {
    if (!isPlutuOtpSelected && !isPlutuTlyncSelected) {
      setPlutuModalOpen(false);
      setPlutuStep('info');
      setPlutuInputs({});
      setPlutuPaymentId(null);
    }
  }, [isPlutuOtpSelected, isPlutuTlyncSelected]);

  // Load Moamalat Lightbox script
  useEffect(() => {
    if (selected === PaymentMethodCode.MOAMALAT && !lightboxLoaded) {
      console.log('Loading Moamalat lightbox script...');

      // Check if script is already loaded
      const existingScript = document.querySelector('script[src*="lightbox.js"]');
      if (existingScript) {
        console.log('Script already exists, checking if window.Lightbox is available');
        if (window.Lightbox?.Checkout) {
          setLightboxLoaded(true);
          if (pendingLightboxConfig) {
            handleLightbox(pendingLightboxConfig);
            setPendingLightboxConfig(null);
          }
        }
        return;
      }

      // Get the script URL from the method metadata
      const selectedMethod = methods?.find(m => m.methodCode === PaymentMethodCode.MOAMALAT);
      const scriptSrc = selectedMethod?.metadata?.scriptUrl || 'https://tnpg.moamalat.net:6006/js/lightbox.js'; // Fallback to test environment

      console.log('Using Moamalat script URL:', scriptSrc);
      console.log('Sandbox mode:', selectedMethod?.metadata?.sandboxMode);

      const script = document.createElement('script');
      script.src = scriptSrc;
      script.async = true;
      script.onload = () => {
        console.log('Lightbox script loaded successfully');
        setLightboxLoaded(true);
        if (pendingLightboxConfig) {
          console.log('Processing pending lightbox config');
          handleLightbox(pendingLightboxConfig);
          setPendingLightboxConfig(null);
        }
      };
      script.onerror = () => {
        console.error('فشل في تحميل سكربت بوابة Moamalat');
        setIsProcessingPayment(false);
        alert('فشل في تحميل بوابة الدفع. يرجى المحاولة مرة أخرى.');
      };
      document.head.appendChild(script);

      return () => {
        // Only remove if we added it
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [selected, pendingLightboxConfig, methods]);

  // Cleanup effect to close any open lightboxes when component unmounts
  useEffect(() => {
    return () => {
      // Close lightbox if component unmounts while it's open
      if (window.Lightbox?.Checkout?.closeLightbox) {
        window.Lightbox.Checkout.closeLightbox();
      }

      // Clear any pending verification timeout
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
        verificationTimeoutRef.current = null;
      }

      // Reset verification completed flag
      verificationCompletedRef.current = false;
    };
  }, []);

  const handleLightbox = (config: any) => {
    console.log('handleLightbox called with config:', config);
    console.log('lightboxLoaded:', lightboxLoaded, 'window.Lightbox:', window.Lightbox);

    if (!lightboxLoaded || !window.Lightbox?.Checkout) {
      console.log('Lightbox not ready, storing config for later');
      setPendingLightboxConfig(config);
      return;
    }

    try {
      console.log('Configuring and showing lightbox...');

      // Configure the lightbox with the provided configuration
      console.log('Configuring Lightbox with:', config);
      window.Lightbox.Checkout.configure = {
        MID: config.MID,
        TID: config.TID,
        AmountTrxn: config.AmountTrxn,
        MerchantReference: config.MerchantReference,
        TrxDateTime: config.TrxDateTime,
        SecureHash: config.SecureHash,
        paymentMethodFromLightBox: config.paymentMethodFromLightBox || 'card',
        OrderID: config.OrderID, // Fixed: Use OrderID (capital D)
        completeCallback: (paymentInfo: any) => {
          console.log('Moamalat payment completed:', paymentInfo);

          // Prevent multiple calls by immediately closing the lightbox
          if (window.Lightbox?.Checkout?.closeLightbox) {
            window.Lightbox.Checkout.closeLightbox();
          }

          // Check if verification was already completed successfully
          if (verificationCompletedRef.current) {
            console.log('Payment verification already completed successfully, ignoring duplicate callback');
            return;
          }

          // Check if verification is already in progress
          if (isVerifyingPayment) {
            console.log('Payment verification already in progress, ignoring duplicate callback');
            return;
          }

          setIsVerifyingPayment(true);

          // Generate a unique verification ID for tracking
          const verificationId = `verify_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log(`Starting payment verification with ID: ${verificationId}`);

          // Clear any existing timeout
          if (verificationTimeoutRef.current) {
            clearTimeout(verificationTimeoutRef.current);
          }

          // Set a timeout to handle cases where verification might hang
          verificationTimeoutRef.current = setTimeout(() => {
            console.warn(`Payment verification timeout reached for ID: ${verificationId}`);
            setIsProcessingPayment(false);
            setIsVerifyingPayment(false);
            alert('انتهت مهلة التحقق من الدفع. يرجى المحاولة مرة أخرى أو الاتصال بالدعم الفني.');
          }, 30000); // 30 seconds timeout

          // Send verification to the payment verification endpoint
          const verificationData = {
            methodCode: PaymentMethodCode.MOAMALAT,
            verificationData: paymentInfo,
            verificationId: verificationId // Include for tracking
          };

          // Call the payment verification endpoint to verify and create payment record
          fetch(`/api/payments/${config.OrderID}/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(verificationData),
          })
            .then(response => response.json())
            .then(data => {
              // Clear timeout on successful response
              if (verificationTimeoutRef.current) {
                clearTimeout(verificationTimeoutRef.current);
                verificationTimeoutRef.current = null;
              }

              console.log(`Verification response received for ID ${verificationId}:`, data);

              if (data.success) {
                // Mark verification as completed successfully
                verificationCompletedRef.current = true;

                if (data.alreadyVerified) {
                  console.log(`Payment was already verified (ID: ${verificationId}), redirecting to complete page`);
                } else {
                  console.log(`Payment verified and recorded successfully (ID: ${verificationId}), redirecting to complete page`);
                }

                setIsProcessingPayment(false);
                setIsVerifyingPayment(false);
                router.push(`/checkout/complete?paymentId=${data.paymentId || config.OrderID}`);
              } else {
                setIsProcessingPayment(false);
                setIsVerifyingPayment(false);
                console.error(`Moamalat verification error (ID: ${verificationId}):`, data);
                alert('فشل في التحقق من عملية الدفع. يرجى المحاولة مرة أخرى.');
              }
            })
            .catch(error => {
              // Clear timeout on error
              if (verificationTimeoutRef.current) {
                clearTimeout(verificationTimeoutRef.current);
                verificationTimeoutRef.current = null;
              }

              setIsProcessingPayment(false);
              setIsVerifyingPayment(false);
              console.error(`Error verifying Moamalat payment (ID: ${verificationId}):`, error);
              alert('حدث خطأ أثناء التحقق من عملية الدفع. يرجى المحاولة مرة أخرى.');
            });
        },
        errorCallback: (error: any) => {
          // Close lightbox on error as well
          if (window.Lightbox?.Checkout?.closeLightbox) {
            window.Lightbox.Checkout.closeLightbox();
          }

          setIsProcessingPayment(false);
          setIsVerifyingPayment(false);
          console.error('Moamalat Error:', error);

          // Check if this is an "Order Not Found" error
          if (error.error && error.error.includes('Order')) {
            console.error('Order Not Found Error Details:', {
              error: error.error,
              amount: error.Amount,
              merchantReference: error.MerchantReferenece || error.MerchantReference,
              dateTime: error.DateTimeLocalTrxn,
              secureHash: error.SecureHash
            });
            alert('خطأ: لم يتم العثور على الطلب في نظام معاملات. يرجى التحقق من صحة البيانات أو الاتصال بالدعم الفني.');
          } else {
            alert('حدث خطأ أثناء عملية الدفع. يرجى المحاولة مرة أخرى.');
          }
        },
        cancelCallback: () => {
          setIsProcessingPayment(false);
          setIsVerifyingPayment(false);
          console.log('Payment cancelled by user');
          // Note: The lightbox automatically closes on cancel according to the script
        }
      };

      // Show the lightbox
      console.log('Calling showLightbox...');
      window.Lightbox.Checkout.showLightbox();
    } catch (error) {
      console.error('Error configuring lightbox:', error);
      setIsProcessingPayment(false);
      alert('حدث خطأ في تكوين بوابة الدفع. يرجى المحاولة مرة أخرى.');
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setUserInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePlutuInputChange = (field: keyof typeof plutuInputs, value: string) => {
    setPlutuInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePayClick = () => {
    if (!selected) return;
    if (isPlutuOtpSelected) {
      setPlutuModalOpen(true);
      setPlutuStep(plutuInputs.processId ? 'otp' : 'info');
      return;
    }
    if (isPlutuTlyncSelected) {
      setPlutuModalOpen(true);
      setPlutuStep('tlync');
      return;
    }
    initiateMutation.mutate();
  };

  // UI helpers
  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8" dir="rtl">
        <Alert className="mb-6">
          <AlertTitle>سلة التسوق فارغة</AlertTitle>
          <AlertDescription>
            يرجى إضافة منتجات إلى السلة قبل متابعة عملية الدفع.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')}>العودة للتسوق</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 text-center" dir="rtl">
        <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
        <p>جاري تحميل طرق الدفع...</p>
      </div>
    );
  }

  if (methodsError) {
    return (
      <div className="container mx-auto px-4 py-8" dir="rtl">
        <Alert variant="destructive">
          <AlertTitle>خطأ</AlertTitle>
          <AlertDescription>
            فشل في تحميل طرق الدفع. يرجى المحاولة مرة أخرى.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/cart')} className="mt-4">
          العودة إلى سلة التسوق
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-[-280px] h-[360px] bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.14),_transparent_45%)]" />
        <div className="pointer-events-none absolute inset-x-10 top-10 h-40 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 opacity-5 blur-3xl" />
      </div>

      {/* Show processing overlay for Moamalat when lightbox is being prepared or payment is being verified */}
      {(isProcessingPayment || isVerifyingPayment) && selected === PaymentMethodCode.MOAMALAT && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {isVerifyingPayment
                ? 'جاري التحقق من الدفع...'
                : !lightboxLoaded
                  ? 'جاري تحميل بوابة الدفع...'
                  : 'جاري تحضير بوابة الدفع'}
            </h3>
            <p className="text-gray-600">
              {isVerifyingPayment
                ? 'يرجى الانتظار بينما نقوم بالتحقق من عملية الدفع وتأكيدها...'
                : !lightboxLoaded
                  ? (() => {
                    const selectedMethod = methods?.find(m => m.methodCode === PaymentMethodCode.MOAMALAT);
                    const environment = selectedMethod?.metadata?.sandboxMode ? 'اختبار' : 'إنتاج';
                    return `يرجى الانتظار بينما نقوم بتحميل بوابة معاملات للدفع (بيئة ${environment})...`;
                  })()
                  : 'يرجى الانتظار بينما نقوم بتحضير بوابة معاملات للدفع...'}
            </p>
          </div>
        </div>
      )}

      {plutuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg" dir="rtl">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">تأكيد الدفع عبر بلوتو</h3>
              <p className="text-sm text-gray-600">
                {plutuStep === 'tlync'
                  ? 'أدخل رقم هاتفك وسيتم توجيهك لإكمال الدفع عبر Tlync.'
                  : 'أدخل البيانات لإرسال رمز التحقق ثم تأكيد الدفع.'}
              </p>
            </div>

            {plutuStep === 'info' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="plutu-mobile" className="mb-1 block">رقم الهاتف</Label>
                  <Input
                    id="plutu-mobile"
                    type="tel"
                    placeholder="مثال: 0912345678"
                    value={plutuInputs.mobile_number || ''}
                    onChange={(e) => handlePlutuInputChange('mobile_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="plutu-birth" className="mb-1 block">سنة الميلاد</Label>
                  <Input
                    id="plutu-birth"
                    type="text"
                    placeholder="مثال: 1990"
                    value={plutuInputs.birth_year || ''}
                    onChange={(e) => handlePlutuInputChange('birth_year', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setPlutuModalOpen(false);
                      setPlutuStep('info');
                    }}
                    disabled={sendPlutuOtp.isPending || confirmPlutuOtp.isPending}
                  >
                    إلغاء
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => sendPlutuOtp.mutate()}
                    disabled={
                      !plutuInputs.mobile_number || !plutuInputs.birth_year ||
                      sendPlutuOtp.isPending || isProcessingPayment
                    }
                  >
                    {sendPlutuOtp.isPending || isProcessingPayment ? (
                      <>
                        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        جاري الإرسال...
                      </>
                    ) : (
                      'إرسال رمز التحقق'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {plutuStep === 'tlync' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tlync-mobile" className="mb-1 block">رقم الهاتف</Label>
                  <Input
                    id="tlync-mobile"
                    type="tel"
                    placeholder="مثال: 0912345678"
                    value={plutuInputs.mobile_number || ''}
                    onChange={(e) => handlePlutuInputChange('mobile_number', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tlync-email" className="mb-1 block">البريد الإلكتروني (اختياري)</Label>
                  <Input
                    id="tlync-email"
                    type="email"
                    placeholder="مثال: name@example.com"
                    value={plutuInputs.email || ''}
                    onChange={(e) => handlePlutuInputChange('email', e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setPlutuModalOpen(false);
                      setPlutuStep('info');
                    }}
                    disabled={startPlutuTlync.isPending || isProcessingPayment}
                  >
                    إلغاء
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => startPlutuTlync.mutate()}
                    disabled={!plutuInputs.mobile_number || startPlutuTlync.isPending || isProcessingPayment}
                  >
                    {startPlutuTlync.isPending || isProcessingPayment ? (
                      <>
                        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        جاري البدء...
                      </>
                    ) : (
                      'متابعة إلى الدفع'
                    )}
                  </Button>
                </div>
              </div>
            )}

            {plutuStep === 'otp' && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="plutu-otp" className="mb-1 block">رمز التحقق</Label>
                  <Input
                    id="plutu-otp"
                    type="text"
                    placeholder="الرمز المرسل إلى هاتفك"
                    value={plutuInputs.otp || ''}
                    onChange={(e) => handlePlutuInputChange('otp', e.target.value)}
                  />
                  <p className="mt-1 text-xs text-gray-600">تم إرسال الرمز إلى {plutuInputs.mobile_number || 'رقم الهاتف المدخل'}.</p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setPlutuStep('info')}
                      disabled={confirmPlutuOtp.isPending || isProcessingPayment}
                    >
                      تعديل البيانات
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => confirmPlutuOtp.mutate()}
                      disabled={!plutuInputs.otp || confirmPlutuOtp.isPending || isProcessingPayment}
                    >
                      {confirmPlutuOtp.isPending || isProcessingPayment ? (
                        <>
                          <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                          جاري التأكيد...
                        </>
                      ) : (
                        'تأكيد الدفع'
                      )}
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setPlutuStep('info');
                      sendPlutuOtp.mutate();
                    }}
                    disabled={sendPlutuOtp.isPending || isProcessingPayment}
                  >
                    {sendPlutuOtp.isPending || isProcessingPayment ? 'جاري إعادة الإرسال...' : 'إعادة إرسال الرمز'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container relative z-10 mx-auto px-4 pb-10 pt-8 lg:pt-12">
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-md">
                <span className="text-sm font-semibold">✔</span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">تجربة دفع آمنة</p>
                <h1 className="text-2xl font-semibold text-slate-900">أكمل طلبك بثقة</h1>
                <p className="text-sm text-slate-600">
                  دفع آمن ومشفر بمعايير عالية. لا نقوم بحفظ بيانات بطاقتك، ويتم إتمام العملية عبر مزودي دفع معتمدين.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {resolvedOrderId && (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>معرّف الطلب: {resolvedOrderId}</span>
                </div>
              )}
              <Button variant="outline" className="hidden sm:inline-flex" onClick={() => router.push('/cart')}>
                العودة إلى السلة
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-0 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg sm:text-xl">اختر طريقة الدفع</CardTitle>
                      <CardDescription className="text-sm text-slate-500">طرق دفع موثوقة مع دعم فوري في حال احتجت مساعدة.</CardDescription>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span>اتصال مشفر</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <RadioGroup value={selected || ''} onValueChange={setSelected} className="space-y-3">
                    {methods && methods.map((method) => {
                      const isActive = selected === method.methodCode;
                      const isMoamalat = method.methodCode === PaymentMethodCode.MOAMALAT;
                      return (
                        <label
                          key={method.methodCode}
                          htmlFor={method.methodCode}
                          className={`group flex cursor-pointer flex-row-reverse items-center gap-4 rounded-2xl border bg-white/70 p-4 text-right transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md ${isActive ? 'border-slate-900 shadow-lg' : 'border-slate-200'}`}
                        >
                          <RadioGroupItem value={method.methodCode} id={method.methodCode} className="mt-0.5" />
                          <div className="flex flex-1 flex-row-reverse items-center justify-between gap-4">
                            <div className="flex flex-row-reverse items-center gap-4">
                              {iconMap[method.methodCode] && (
                                <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${isActive ? 'border-slate-900/50 bg-slate-900/5' : 'border-slate-200 bg-white'}`}>
                                  <img
                                    src={iconMap[method.methodCode]}
                                    alt={method.displayName}
                                    className="max-h-full max-w-full object-contain"
                                  />
                                </div>
                              )}
                              <div className="flex flex-col items-end text-right">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-slate-900">{method.displayName}</span>
                                  {isMoamalat && (
                                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">الأكثر استخداماً</span>
                                  )}
                                </div>
                                {method.description && (
                                  <p className="text-sm text-slate-500">{method.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {/* <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              <span>متاح الآن</span> */}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>

                  {/* Input fields for selected payment method */}
                  {selected && methods?.find(m => m.methodCode === selected)?.userInputFields && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between pb-2">
                        <h3 className="text-base font-semibold text-slate-900">معلومات إضافية</h3>
                        <span className="text-xs text-slate-500">نستخدم البيانات لتحسين نجاح الدفع</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {methods.find(m => m.methodCode === selected)?.userInputFields?.map(field => (
                          <div className="col-span-1" key={field.name}>
                            <Label htmlFor={field.name} className="mb-2 block text-sm font-medium text-slate-800">
                              {field.label}
                            </Label>
                            {field.type === 'textarea' ? (
                              <Textarea
                                id={field.name}
                                value={userInputs[field.name] || ''}
                                onChange={(e) => handleInputChange(field.name, e.target.value)}
                                className="w-full"
                              />
                            ) : (
                              <Input
                                type={field.type}
                                id={field.name}
                                value={userInputs[field.name] || ''}
                                onChange={(e) => handleInputChange(field.name, e.target.value)}
                                className="w-full"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t bg-slate-50/50">
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm">🔒</span>
                      <span>الدفع مشفر ويحترم خصوصيتك.</span>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:w-auto">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => router.push('/cart')}>
                        العودة إلى السلة
                      </Button>
                      <Button
                        className="w-full sm:w-auto"
                        onClick={handlePayClick}
                        disabled={!selected || isProcessingPayment || isVerifyingPayment || initiateMutation.isPending || sendPlutuOtp.isPending || confirmPlutuOtp.isPending || startPlutuTlync.isPending}
                      >
                        {isProcessingPayment || isVerifyingPayment || initiateMutation.isPending || sendPlutuOtp.isPending || confirmPlutuOtp.isPending || startPlutuTlync.isPending ? (
                          <>
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                            {isVerifyingPayment
                              ? 'جاري التحقق من الدفع...'
                              : isPlutuOtpSelected
                                ? (plutuStep === 'otp' ? 'جاري تأكيد الدفع...' : 'جاري إرسال رمز التحقق...')
                                : isPlutuTlyncSelected
                                  ? 'جاري البدء عبر Tlync...'
                                  : selected === PaymentMethodCode.MOAMALAT
                                    ? 'جاري تحضير بوابة الدفع...'
                                    : 'جاري المعالجة...'}
                          </>
                        ) : (
                          'ادفع الآن'
                        )}
                      </Button>
                    </div>
                  </div>
                </CardFooter>
              </Card>
            </div>

            {/* Order Summary */}
            <div className="space-y-4 lg:sticky lg:top-8">
              <Card className="border-0 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold text-slate-900">ملخص الطلب</CardTitle>
                  <CardDescription className="text-sm text-slate-500">راجع تفاصيل طلبك قبل الدفع.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cart?.items.map((item) => (
                    <div key={item.variantId || item.productId} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">{item.productName}</p>
                        {item.variantTitle && <p className="text-xs text-slate-500">{item.variantTitle}</p>}
                        <p className="text-xs text-slate-600">{item.quantity} × {item.price} د.ل</p>
                      </div>
                      <p className="font-semibold text-slate-900">{item.lineItemTotal} د.ل</p>
                    </div>
                  ))}

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-inner">
                    <div className="flex justify-between text-sm text-slate-700">
                      <p>المجموع الفرعي</p>
                      <p>{cart.subtotal} د.ل</p>
                    </div>
                    {cart.discountTotal > 0 && (
                      <div className="mt-2 flex justify-between text-sm text-emerald-600">
                        <p>الخصم</p>
                        <p>- {cart.discountTotal} د.ل</p>
                      </div>
                    )}
                    <div className="mt-2 flex justify-between text-sm text-slate-700">
                      <p>رسوم التوصيل</p>
                      <p>{cart.deliveryFee} د.ل</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
                      <p className="text-sm">الإجمالي</p>
                      <p className="text-xl font-semibold">{cart.total} د.ل</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
