'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

// shadcn components
import { Card, CardContent } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { trackEvent } from '@/modules/analytics/client/analyticsClient';

// Validation schema using Zod (Arabic messages)
const signupSchema = z.object({
  name: z.string().nonempty('يجب إدخال الاسم'),
  phoneNumber: z
    .string()
    .min(10, 'يجب أن يحتوي رقم الهاتف على 10 أرقام على الأقل')
    .regex(/^\+?[0-9]+$/, 'يمكن لرقم الهاتف أن يحتوي على أرقام فقط'),
  step: z.number().default(1),
  otp: z.string().optional(),
}).refine((data) => data.step !== 2 || (data.otp && data.otp.length === 6), {
  message: "الرمز مطلوب",
  path: ["otp"]
});

// Add this translation utility
const translateAuthError = (error: string): string => {
  const errorTranslations: Record<string, string> = {
    // Email related errors
    'Email already in use': 'البريد الإلكتروني مستخدم بالفعل',
    'Invalid email': 'البريد الإلكتروني غير صالح',

    // Password related errors
    'Password too short': 'كلمة المرور قصيرة جدًا',
    'Password too weak': 'كلمة المرور ضعيفة جدًا',

    // Phone number related errors
    'Phone number already in use': 'رقم الهاتف مستخدم بالفعل',
    'Invalid phone number': 'رقم الهاتف غير صالح',

    // OTP related errors
    'Invalid verification code': 'رمز التحقق غير صالح',
    'Verification code expired': 'انتهت صلاحية رمز التحقق',
    'Too many attempts': 'محاولات كثيرة جدًا، يرجى المحاولة لاحقًا',

    // General errors
    'An error occurred': 'حدث خطأ، يرجى المحاولة مرة أخرى',
    'User not found': 'المستخدم غير موجود',
    'User already exists': 'المستخدم موجود بالفعل',
    'OTP not found': 'رمز التحقق غير موجود',
    'Invalid OTP': 'رمز التحقق غير صالح',
    'Phone number already exists': 'رقم الهاتف موجود بالفعل'
  };

  // Return the translation or the original error if no translation exists
  return errorTranslations[error] || error;
};

export default function SignupPage() {
  const router = useRouter();
  const [signupError, setSignupError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [registrationData, setRegistrationData] = useState<{ name: string; phoneNumber: string; requestId: string; resendToken: string; } | null>(null);
  const [canResendCode, setCanResendCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Function to start resend countdown timer
  const startResendCountdown = () => {
    setCanResendCode(false);
    setResendCountdown(60); // 60 second countdown

    const timer = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResendCode(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Form for registration
  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      phoneNumber: '',
      otp: '',
      step: 1,
    },
  });

  const handleSignup = async (values: z.infer<typeof signupSchema>) => {
    setIsLoading(true);
    setSignupError(null);

    try {
      // Send OTP via Marsol initiatePhoneVerification
      const otpResult = await authClient.marsol.initiatePhoneVerification({
        phoneNumber: values.phoneNumber,
        authType: 'register'
      });

      if (otpResult.error) {
        setSignupError(translateAuthError(otpResult.error.message ?? '') || 'فشل في إرسال رمز التحقق، حاول مرة أخرى.');
        setIsLoading(false);
        return;
      }

      const otpData = otpResult.data as Record<string, unknown>;
      const requestId = (otpData.requestId ?? otpData.request_id) as string | undefined;
      const resendToken = (otpData.resendToken ?? otpData.resend_token) as string | undefined;

      if (!requestId || !resendToken) {
        setSignupError('استجابة غير صالحة من خدمة التحقق، حاول مرة أخرى.');
        setIsLoading(false);
        return;
      }

      // Persist fields for later OTP verification and retry
      setRegistrationData({
        name: values.name,
        phoneNumber: values.phoneNumber,
        requestId,
        resendToken,
      });

      // Show OTP form
      signupForm.setValue('step', 2);
      setShowOtpForm(true);
      startResendCountdown();
      trackEvent('signup_otp_sent', { phoneNumber: values.phoneNumber });
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError(
        error instanceof Error
          ? translateAuthError(error.message)
          : 'فشل في إرسال رمز التحقق، حاول مرة أخرى.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (values: z.infer<typeof signupSchema>) => {
    if (!registrationData) return;

    setIsLoading(true);
    setSignupError(null);

    try {
      // Verify OTP via Marsol verifyPhoneNumberRequest endpoint
      const verifyResult = await authClient.marsol.verifyPhoneNumberRequest({
        code: values.otp ?? '',
        requestId: registrationData.requestId,
        name: registrationData.name,
        operation: 'register'
      });

      if (verifyResult.error) {
        setSignupError(translateAuthError(verifyResult.error.message ?? '') || 'فشل في التحقق من الرمز، يرجى التأكد والمحاولة مرة أخرى.');
        setIsLoading(false);
        return;
      }

      // Force a session refresh to ensure the client state is updated
      console.log('Registration verification successful, refreshing session...');
      await authClient.getSession();
      console.log('Session refreshed after registration');

      setIsSuccess(true);
      trackEvent('signup_success', { phoneNumber: registrationData.phoneNumber });

      // Redirect to login page after successful signup (with a delay)
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (error) {
      console.error('OTP verification error:', error);
      setSignupError(
        error instanceof Error
          ? translateAuthError(error.message)
          : 'فشل في التحقق من الرمز، يرجى التأكد والمحاولة مرة أخرى.'
      );
      trackEvent('signup_failed', { phoneNumber: registrationData?.phoneNumber, reason: error instanceof Error ? error.message : 'unknown' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!registrationData || !canResendCode) return;

    const { requestId, resendToken } = registrationData;
    if (!requestId || !resendToken) {
      setSignupError('بيانات إعادة الإرسال غير مكتملة');
      return;
    }

    setIsLoading(true);
    setSignupError(null);

    try {
      // Resend OTP via Marsol retry endpoint
      const retryResult = await authClient.marsol.retryVerification({
        requestId,
        resendToken,
      });

      if (retryResult.error) {
        setSignupError(translateAuthError(retryResult.error.message ?? '') || 'فشل في إعادة إرسال رمز التحقق، حاول مرة أخرى.');
        return;
      }

      const retryData = retryResult.data as Record<string, unknown>;
      const nextResendToken = (retryData.resendToken ?? retryData.resend_token) as string | undefined;

      if (!nextResendToken) {
        setSignupError('استجابة غير صالحة من خدمة إعادة الإرسال');
        return;
      }

      // Update resendToken for subsequent retries
      setRegistrationData((prev) => prev ? { ...prev, resendToken: nextResendToken } : prev);
      startResendCountdown();
      trackEvent('signup_otp_resent', { phoneNumber: registrationData.phoneNumber });
    } catch (error) {
      console.error('Resend code error:', error);
      setSignupError(
        error instanceof Error
          ? translateAuthError(error.message)
          : 'فشل في إعادة إرسال رمز التحقق، حاول مرة أخرى.'
      );
      trackEvent('signup_failed', { phoneNumber: registrationData?.phoneNumber, reason: error instanceof Error ? error.message : 'resend_error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-2 sm:p-4 md:p-6" dir="rtl">
      <Card className="w-full max-w-[95%] sm:max-w-md shadow-sm border-slate-200">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-0">
          <div className="mb-3 sm:mb-4 text-center">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">إنشاء حساب</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">انضم إلى مجتمع التسوق</p>
          </div>

          {signupError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{signupError}</AlertDescription>
            </Alert>
          )}

          {isSuccess && (
            <Alert variant="default" className="bg-green-50 text-green-700 border border-green-200 mb-4">
              <AlertDescription>تم إنشاء الحساب بنجاح! جاري إعادة التوجيه للدخول...</AlertDescription>
            </Alert>
          )}

          {!showOtpForm ? (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">

                <FormField
                  control={signupForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">الاسم</FormLabel>
                      <FormControl>
                        <Input {...field} className="text-right" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signupForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm">رقم الهاتف</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="text-right"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !signupForm.formState.isValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري إرسال الرمز...
                    </>
                  ) : (
                    'طلب رمز التحقق'
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
                <FormField
                  control={signupForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm">رمز التحقق</FormLabel>
                      <FormControl>
                        <div dir='ltr'>
                          <InputOTP
                            maxLength={6}
                            onChange={(value) => field.onChange(value)}
                            onComplete={(value) => field.onChange(value)}
                            containerClassName="flex justify-center gap-0.5 sm:gap-1"
                          >
                            <InputOTPGroup>
                              {Array.from({ length: 6 }).map((_, i) => (
                                <FormControl key={i}>
                                  <InputOTPSlot index={i} className="w-8 h-10 sm:w-10 sm:h-12" />
                                </FormControl>
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </FormControl>
                      <p className="text-xs text-slate-500 text-center">
                        لقد أرسلنا رمز التحقق إلى {registrationData?.phoneNumber}
                      </p>
                      <div className="flex justify-center mt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                          disabled={!canResendCode || isLoading}
                          onClick={handleResendCode}
                        >
                          {resendCountdown > 0
                            ? `إعادة الإرسال بعد ${resendCountdown} ثانية`
                            : 'إعادة إرسال الرمز'}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !signupForm.formState.isValid}
                  size="sm"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    'إنشاء الحساب'
                  )}
                </Button>
              </form>
            </Form>
          )}

          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 pb-3 sm:pb-4 text-center border-t text-xs text-slate-500">
            هل لديك حساب بالفعل؟{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              تسجيل الدخول
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
