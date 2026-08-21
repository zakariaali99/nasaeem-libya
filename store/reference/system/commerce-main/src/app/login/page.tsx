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
} from '@/components/ui/input-otp';
import React from 'react';
import { trackEvent } from '@/modules/analytics/client/analyticsClient';

// Validation schema using Zod (Arabic messages)
const loginSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, 'يجب أن يحتوي رقم الهاتف على 10 أرقام على الأقل')
    .regex(/^\+?[0-9]+$/, 'يمكن لرقم الهاتف أن يحتوي على أرقام فقط'),
  step: z.number().default(1),
  otp: z.string().optional(),
}).refine((data) => data.step !== 2 || (data.otp && data.otp.length === 6), {
  message: "الرمز يجب أن يكون 6 أرقام",
  path: ["otp"]
});

// Error translation utility
const translateAuthError = (error: string): string => {
  const errorTranslations: Record<string, string> = {
    // Email related errors
    'Email already in use': 'البريد الإلكتروني مستخدم بالفعل',
    'Invalid email': 'البريد الإلكتروني غير صالح',

    // Password related errors
    'Password too short': 'كلمة المرور قصيرة جدًا',
    'Password too weak': 'كلمة المرور ضعيفة جدًا',
    'Incorrect password': 'كلمة المرور غير صحيحة',

    // Phone number related errors
    'Phone number already in use': 'رقم الهاتف مستخدم بالفعل',
    'Invalid phone number': 'رقم الهاتف غير صالح',

    // OTP related errors
    'Invalid verification code': 'رمز التحقق غير صالح',
    'Verification code expired': 'انتهت صلاحية رمز التحقق',
    'Too many attempts': 'محاولات كثيرة جدًا، يرجى المحاولة لاحقًا',

    // Login related errors
    'Invalid credentials': 'بيانات الاعتماد غير صالحة',
    'Account locked': 'تم قفل الحساب، يرجى الاتصال بالدعم',
    'Account not verified': 'لم يتم التحقق من الحساب بعد',

    // General errors
    'An error occurred': 'حدث خطأ، يرجى المحاولة مرة أخرى',
    'User not found': 'هذا الرقم غير مسجل لدينا، يرجى إنشاء حساب جديد.',
    'User already exists': 'المستخدم موجود بالفعل',
    'Authentication failed': 'فشل المصادقة، يرجى المحاولة مرة أخرى',
    'Server error': 'خطأ في الخادم، يرجى المحاولة لاحقًا',
    'Invalid phone number or password': 'رقم الهاتف او كلمة السر خطأ',
  };

  // Return the translation or the original error if no translation exists
  return errorTranslations[error] || error;
};

export default function LoginPage() {
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // New OTP login states
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [currentPhone, setCurrentPhone] = useState<string>("");
  const [canResendCode, setCanResendCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [registrationData, setRegistrationData] = useState<{ requestId: string; resendToken: string; phoneNumber: string } | null>(null);

  // إعادة التحميل تتم على صفحة الرئيسية عبر Query Param

  // Form for login
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      phoneNumber: '',
      otp: '',
      step: 1,
    },
  });

  // Countdown for resend
  const startResendCountdown = () => {
    setCanResendCode(false);
    setResendCountdown(60);
    const timer = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResendCode(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Step 1: send OTP
  const handleSendOtp = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    setLoginError(null);
    try {
      const otpResult = await authClient.marsol.initiatePhoneVerification({
        phoneNumber: values.phoneNumber,
        authType: 'login'
      });
      if (otpResult.error) {
        setLoginError(translateAuthError(otpResult.error.message ?? '') || 'فشل في إرسال رمز التحقق');
      } else {
        const otpData = otpResult.data as Record<string, unknown>;
        const requestId = (otpData.requestId ?? otpData.request_id) as string | undefined;
        const resendToken = (otpData.resendToken ?? otpData.resend_token) as string | undefined;

        if (!requestId || !resendToken) {
          setLoginError('استجابة غير صالحة من خدمة التحقق');
          return;
        }

        setRegistrationData({ requestId, resendToken, phoneNumber: values.phoneNumber });
        setCurrentPhone(values.phoneNumber);
        loginForm.setValue('step', 2);
        setShowOtpForm(true);
        startResendCountdown();
        trackEvent('login_otp_sent', { phoneNumber: values.phoneNumber });
      }
    } catch (e) {
      setLoginError('فشل في إرسال رمز التحقق');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: verify OTP and complete login
  const handleVerifyOtp = async (values: z.infer<typeof loginSchema>) => {
    if (!registrationData) return;
    setIsLoading(true);
    setLoginError(null);
    try {
      const verifyResult = await authClient.marsol.verifyPhoneNumberRequest({
        code: values.otp ?? '',
        requestId: registrationData.requestId,
        authType: 'login'
      });
      if (verifyResult.error) {
        setLoginError(translateAuthError(verifyResult.error.message ?? '') || 'فشل في التحقق من الرمز');
        trackEvent('login_failed', { phoneNumber: currentPhone, reason: verifyResult.error.message });
      } else {
        // Force a session refresh to ensure the client state is updated
        console.log('Verification successful, refreshing session...');
        await authClient.getSession();
        trackEvent('login_success', { phoneNumber: currentPhone });

        // Wait a tick to ensure cookie propagation before redirect
        await new Promise(resolve => setTimeout(resolve, 100));

        // Redirect to home
        router.push('/');
      }
    } catch (e) {
      console.error('Login verification error:', e);
      setLoginError('فشل في التحقق من الرمز');
      trackEvent('login_failed', { phoneNumber: currentPhone, reason: 'exception' });
    } finally {
      setIsLoading(false);
    }
  };

  // Resend OTP
  const handleResendCode = async () => {
    if (!registrationData || !canResendCode) return;

    const { requestId, resendToken } = registrationData;
    if (!requestId || !resendToken) {
      setLoginError('بيانات إعادة الإرسال غير مكتملة');
      return;
    }
    setIsLoading(true);
    setLoginError(null);
    try {
      const retryResult = await authClient.marsol.retryVerification({
        requestId,
        resendToken
      });
      if (retryResult.error) {
        setLoginError(translateAuthError(retryResult.error.message ?? '') || 'فشل في إعادة إرسال الرمز');
      } else {
        const retryData = retryResult.data as Record<string, unknown>;
        const nextResendToken = (retryData.resendToken ?? retryData.resend_token) as string | undefined;

        if (!nextResendToken) {
          setLoginError('استجابة غير صالحة من خدمة إعادة الإرسال');
          return;
        }

        setRegistrationData(prev => prev ? { ...prev, resendToken: nextResendToken } : prev);
        startResendCountdown();
      }
    } catch (e) {
      setLoginError('فشل في إعادة إرسال الرمز');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-2 sm:p-4 md:p-6" dir="rtl">
      <Card className="w-full max-w-[95%] sm:max-w-md shadow-sm border-slate-200">
        <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6 pb-0">
          <div className="mb-3 sm:mb-4 text-center">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">مرحباً بك مجدداً</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">تسجيل الدخول إلى حسابك</p>
          </div>

          {loginError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}

          {!showOtpForm ? (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleSendOtp)} className="space-y-4">
                <FormField
                  control={loginForm.control}
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
                  className="w-full h-11 sm:h-12 text-sm sm:text-base"
                  disabled={isLoading || !loginForm.formState.isValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    'إرسال رمز التحقق'
                  )}
                </Button>
              </form>
            </Form>
          ) : (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleVerifyOtp)} className="space-y-4">
                <FormField
                  control={loginForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="space-y-2">
                      <FormLabel className="text-sm">رمز التحقق</FormLabel>
                      <FormControl>
                        <div dir="ltr">
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
                        لقد أرسلنا رمز التحقق إلى {currentPhone}
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
                  className="w-full h-11 sm:h-12 text-sm sm:text-base"
                  disabled={isLoading || !loginForm.formState.isValid}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    'تسجيل الدخول'
                  )}
                </Button>
              </form>
            </Form>
          )}

          <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 pb-3 sm:pb-4 text-center border-t text-xs text-slate-500">
            ليس لديك حساب؟{' '}
            <Link href="/register" className="font-medium text-primary hover:underline">
              إنشاء حساب جديد
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
