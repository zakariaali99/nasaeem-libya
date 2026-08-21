"use client";

import React, { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useAppSession } from "@/components/providers/SessionProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUserOrders } from "@/hooks/use-orders";
import Link from "next/link";
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { ShoppingCart, Phone, LogOut, User2, RefreshCw } from 'lucide-react';
import { PaymentMethodCode } from '@/modules/payments/types/paymentTypes';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useRouter, usePathname } from 'next/navigation';
import UserWallet from './UserWallet';

const paymentIcons: Partial<Record<PaymentMethodCode, string>> = {
  [PaymentMethodCode.BINANCE_PAY]: '/binance.svg',
  [PaymentMethodCode.MANUAL_PAYMENT]: '/manual.svg',
  [PaymentMethodCode.SADAD_PAY]: '/sadad.png',
  [PaymentMethodCode.MOAMALAT]: '/moamalat.svg',
  [PaymentMethodCode.PLUTU]: '/plutu.png',
  [PaymentMethodCode.PLUTU_SADAD]: '/sadad.png',
  [PaymentMethodCode.PLUTU_EDFALI]: '/Edfali.png',
  [PaymentMethodCode.PLUTU_MPGS]: '/mastercard.png',
  [PaymentMethodCode.PLUTU_TLYNC]: '/t-lync.png',
  [PaymentMethodCode.PLUTU_LOCAL_CARDS]: '/moamalat.svg',
};

export default function Page() {
  const { session } = useAppSession();
  const { data: orders, isLoading, error } = useUserOrders();
  const orderList = orders?.data ?? [];
  const router = useRouter();
  const pathname = usePathname();
  let defaultTab = 'settings';
  if (pathname?.endsWith('/orders')) defaultTab = 'orders';
  if (pathname?.endsWith('/wallet')) defaultTab = 'wallet';

  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const totalSpent = orderList.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const completedOrders = orderList.filter(order => order.status === 'completed').length;
  // translate status to Arabic
  const translateStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'processing': return 'قيد المعالجة';
      case 'completed': return 'مكتمل';
      case 'canceled': return 'ملغي';
      default: return status;
    }
  };
  // badge variants per status
  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'processing': return 'outline';
      case 'canceled': return 'destructive';
      default: return 'default';
    }
  };
  // Translate payment status to Arabic
  const translatePaymentStatus = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الدفع';
      case 'completed': return 'مدفوع';
      case 'failed': return 'فشل الدفع';
      case 'cancelled': return 'ملغي';
      case 'refunded': return 'مُسترد';
      case 'waiting_for_verification': return 'في انتظار التحقق';
      default: return status;
    }
  };
  // Determine badge variant for payment status
  const paymentStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'failed': return 'destructive';
      case 'cancelled': return 'outline';
      case 'refunded': return 'destructive';
      case 'waiting_for_verification': return 'outline';
      default: return 'default';
    }
  };

  const [newName, setNewName] = useState(session?.user?.name || '');
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [canResendCode, setCanResendCode] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  React.useEffect(() => {
    if (session?.user?.name) setNewName(session.user.name);
  }, [session?.user?.name]);

  React.useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // Name update
  const handleNameConfirm = async () => {
    try {
      await authClient.updateUser({ name: newName });
      setIsNameDialogOpen(false);
      alert('تم تحديث الاسم بنجاح');
    } catch (err) {
      console.error(err);
      alert('فشل في تحديث الاسم');
    }
  };

  // Phone update: send OTP and open dialog
  const startResendCountdown = () => {
    setCanResendCode(false);
    setResendCountdown(60);
    const timer = setInterval(() => {
      setResendCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); setCanResendCode(true); return 0; }
        return prev - 1;
      });
    }, 1000);
  };
  const handlePhoneContinue = async () => {
    try {
      const res = await authClient.phoneNumber.sendOtp({ phoneNumber: newPhone });
      if (res.error) throw new Error(res.error.message);
      startResendCountdown();
      setPhoneError(null);
      setIsPhoneDialogOpen(true);
    } catch (err) {
      setPhoneError((err as Error).message);
    }
  };
  const handleOtpConfirm = async () => {
    try {
      const res = await authClient.phoneNumber.verify({ phoneNumber: newPhone, code: otpCode, updatePhoneNumber: true });
      if (res.error) throw new Error(res.error.message);
      setIsPhoneDialogOpen(false);
      alert('تم تحديث رقم الهاتف بنجاح');
    } catch (err) {
      setPhoneError((err as Error).message);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push('/login');
    } catch (err) {
      console.error(err);
      alert('فشل تسجيل الخروج');
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded-3xl bg-white/80 backdrop-blur shadow-lg border border-slate-200 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-full bg-slate-900 text-white flex items-center justify-center text-lg font-semibold flex-shrink-0">
                {session?.user?.name ? session.user.name.slice(0, 1) : 'م'}
              </div>
              <div className="text-right min-w-0">
                <p className="text-sm text-slate-500">حسابي</p>
                <p className="text-xl font-semibold text-slate-900 truncate">
                  {session?.user?.name || 'عميلنا العزيز'}
                </p>
                <div className="mt-1 flex items-center gap-2 text-sm text-slate-500" dir="ltr">
                  <Phone className="h-4 w-4" />
                  <span className="truncate">{session?.user?.phoneNumber || 'رقم غير مسجل'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="grid grid-cols-3 rounded-full bg-slate-100 p-1">
            <TabsTrigger value="settings" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
              الإعدادات
            </TabsTrigger>
            <TabsTrigger value="orders" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm">
              الطلبات
            </TabsTrigger>
            <TabsTrigger value="wallet" className="rounded-full data-[state=active]:bg-white data-[state=active]:shadow-sm flex items-center gap-1">
              المحفظة والقسائم
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-sm text-slate-500">الملف الشخصي</p>
                    <p className="text-lg font-semibold text-slate-900">تحديث بيانات حسابك</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <User2 className="h-5 w-5 text-slate-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">الاسم</p>
                      <p className="text-xs text-slate-500">يظهر في تفاصيل الطلبات والفواتير</p>
                    </div>
                  </div>
                  <Input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="أدخل الاسم"
                    className="w-full bg-white"
                  />
                  <Dialog open={isNameDialogOpen} onOpenChange={setIsNameDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="default" size="sm" className="w-full">حفظ الاسم</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader className="text-right">
                        <DialogTitle>تأكيد تغيير الاسم</DialogTitle>
                        <DialogDescription>هل تريد حفظ الاسم الجديد: {newName || '—'}؟</DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="flex gap-2 sm:justify-end">
                        <DialogClose asChild>
                          <Button variant="outline" size="sm">إلغاء</Button>
                        </DialogClose>
                        <Button variant="default" size="sm" onClick={handleNameConfirm}>تأكيد</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
                  <div className="text-right space-y-1">
                    <p className="text-sm font-semibold text-slate-900">رقم الهاتف</p>
                    <p className="text-xs text-slate-500" dir="ltr">
                      الرقم الحالي: {session?.user?.phoneNumber || 'غير مسجل'}
                    </p>
                  </div>
                  <Input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="أدخل رقم الهاتف الجديد"
                    className="w-full bg-white"
                  />
                  {phoneError && <p className="text-destructive text-sm">{phoneError}</p>}
                  <Button variant="secondary" size="sm" className="w-full" onClick={handlePhoneContinue}>
                    إرسال رمز التحقق
                  </Button>
                  <p className="text-xs text-slate-500 text-right">سيتم إرسال رمز تحقق لتأكيد التغيير.</p>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t border-slate-100 px-5 py-4">
                <Button variant="destructive" className="w-full" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 ml-2" />
                  تسجيل الخروج
                </Button>
              </CardFooter>
            </Card>

            <Dialog open={isPhoneDialogOpen} onOpenChange={setIsPhoneDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader className="text-right space-y-2">
                  <DialogTitle>رمز التحقق</DialogTitle>
                  <DialogDescription dir="ltr" className="text-sm text-slate-600">
                    الرجاء إدخال رمز التحقق المرسل إلى {newPhone}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center mt-2" dir="ltr">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode} containerClassName="flex gap-2">
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <InputOTPSlot key={idx} index={idx} className="w-10 h-12 text-lg" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <Button variant="ghost" size="sm" disabled={!canResendCode} onClick={handlePhoneContinue}>
                    {resendCountdown > 0 ? (
                      <span className="flex items-center gap-1">
                        <RefreshCw className="h-4 w-4" />
                        إعادة الإرسال بعد {resendCountdown}s
                      </span>
                    ) : (
                      'إعادة إرسال الرمز'
                    )}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleOtpConfirm}>تأكيد</Button>
                </div>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="orders" className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4 text-right space-y-1">
                  <p className="text-xs text-slate-500">إجمالي الطلبات</p>
                  <p className="text-2xl font-bold text-slate-900">{orderList.length}</p>
                  <p className="text-xs text-slate-500">كل طلباتك منذ التسجيل</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4 text-right space-y-1">
                  <p className="text-xs text-slate-500">الطلبات المكتملة</p>
                  <p className="text-2xl font-bold text-emerald-600">{completedOrders}</p>
                  <p className="text-xs text-slate-500">تم التوصيل أو الاستلام</p>
                </CardContent>
              </Card>
              <Card className="bg-white border-slate-200 shadow-sm">
                <CardContent className="p-4 text-right space-y-1">
                  <p className="text-xs text-slate-500">إجمالي المدفوع</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {Math.round(totalSpent).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500">يشمل كل الطلبات</p>
                </CardContent>
              </Card>
            </div>

            {isLoading ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6 text-right">جاري التحميل...</CardContent>
              </Card>
            ) : error ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6 text-right text-destructive">خطأ في جلب الطلبات</CardContent>
              </Card>
            ) : orderList.length === 0 ? (
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-6 text-right">لا توجد طلبات حتى الآن</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orderList.map(order => (
                  <Card key={order.id} className="border-slate-200 shadow-sm">
                    <CardContent className="p-5 space-y-4 text-right">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">طلب رقم #{order.orderNumber}</p>
                          <p className="text-xs text-slate-500 mt-1">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
                        </div>
                        <Badge variant={statusVariant(order.status)} className="px-3 py-1">
                          {translateStatus(order.status)}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                          <p className="text-xs text-slate-500">الإجمالي</p>
                          <p className="text-lg font-semibold text-slate-900 mt-1">
                            {Math.round(parseFloat(order.total)).toLocaleString('ar-LY', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {order.payment ? (
                              <img
                                src={paymentIcons[order.payment.paymentMethod as PaymentMethodCode] || '/payment.svg'}
                                alt=""
                                className="h-7 w-7 rounded"
                              />
                            ) : (
                              <div className="h-7 w-7 rounded bg-white border border-slate-200" />
                            )}
                            <div className="text-right min-w-0">
                              <p className="text-xs text-slate-500">الدفع</p>
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {order.payment ? 'تم تسجيل الدفع' : 'غير مدفوع'}
                              </p>
                            </div>
                          </div>
                          {order.payment && (
                            <Badge variant={paymentStatusVariant(order.payment.status)}>
                              {translatePaymentStatus(order.payment.status)}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {order.trackingNumber && (
                        <div className="rounded-2xl bg-white border border-slate-100 p-4">
                          <p className="text-xs text-slate-500">رقم التتبع</p>
                          <div className="mt-1">
                            {order.trackingUrl ? (
                              <Link href={order.trackingUrl} target="_blank" className="text-primary font-semibold hover:underline">
                                {order.trackingNumber}
                              </Link>
                            ) : (
                              <span className="font-semibold text-slate-800">{order.trackingNumber}</span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700">المنتجات</p>
                        <div className="flex gap-3 overflow-x-auto pb-1">
                          {order.items.slice(0, 6).map(item => (
                            <div key={item.id} className="relative flex-shrink-0 w-20 h-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden">
                              {item.imageUrl ? (
                                <Image src={item.imageUrl} alt={(item as any).name || (item as any).productName || 'منتج'} fill className="object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <ShoppingCart className="h-5 w-5 text-slate-400" />
                                </div>
                              )}
                              <div className="absolute top-2 left-2">
                                <Badge className="text-[11px] px-2">x{item.quantity}</Badge>
                              </div>
                            </div>
                          ))}
                          {order.items.length > 6 && (
                            <div className="flex items-center justify-center px-4 border border-dashed border-slate-200 rounded-2xl text-sm text-slate-500">
                              +{order.items.length - 6}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2 bg-slate-50 border-t border-slate-100 px-5 py-4">
                      {order.trackingUrl && (
                        <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                          <Link href={order.trackingUrl} target="_blank">تتبع الشحنة</Link>
                        </Button>
                      )}
                      <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
                        <Link href={`/me/orders/${order.id}`}>عرض التفاصيل</Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* WALLET TAB */}
          <TabsContent value="wallet" className="space-y-5">
            <UserWallet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}