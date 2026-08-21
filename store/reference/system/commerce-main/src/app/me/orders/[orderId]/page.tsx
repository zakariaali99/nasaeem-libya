"use client";

import React from 'react';
import { useParams } from 'next/navigation';
import { useOrder } from '@/hooks/use-orders';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/utils';
import Image from 'next/image';
import { ShoppingCart, Truck, CreditCard, ArrowLeft, Package } from 'lucide-react';
import { PaymentMethodCode } from '@/modules/payments/types/paymentTypes';

export default function OrderPage() {
  const { orderId } = useParams();
  const { data: order, isLoading, error } = useOrder(orderId as string);

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
  // badge variant
  const statusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'default';
      case 'pending': return 'secondary';
      case 'processing': return 'outline';
      case 'canceled': return 'destructive';
      default: return 'default';
    }
  };

  // Mapping for payment method icons
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
    [PaymentMethodCode.BANK_CARDS_ON_DELIVERY]: '/bank_cards.svg',
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
  // Badge variant for payment status
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

  if (isLoading) return <p className="text-right">جاري التحميل...</p>;
  if (error) return <p className="text-right text-destructive">خطأ في جلب تفاصيل الطلب</p>;
  if (!order) return <p className="text-right">لا يوجد طلب</p>;

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5 text-right">
        <div className="rounded-3xl bg-white/80 backdrop-blur shadow-lg border border-slate-200 p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">رقم الطلب</p>
            <h1 className="text-2xl font-bold text-slate-900">#{order.orderNumber}</h1>
            <p className="text-xs text-slate-500 mt-1">{new Date(order.createdAt).toLocaleDateString('ar-LY')}</p>
          </div>
          <Badge variant={statusVariant(order.status)} className="text-sm px-3 py-1">
            {translateStatus(order.status)}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 space-y-1">
              <p className="text-xs text-slate-500">إجمالي الطلب</p>
              <p className="text-2xl font-bold text-slate-900">
                {Math.round(parseFloat(order.total)).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0, minimumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">شامل كل المنتجات</p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-slate-500">حالة الدفع</p>
                {order.payment ? (
                  <Badge variant={paymentStatusVariant(order.payment.status)}>
                    {translatePaymentStatus(order.payment.status)}
                  </Badge>
                ) : (
                  <span className="text-sm text-slate-600">لم يتم الدفع بعد</span>
                )}
              </div>
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden">
                {order.payment ? (
                  <img
                    src={paymentIcons[order.payment.paymentMethod as PaymentMethodCode] || '/payment.svg'}
                    alt="طريقة الدفع"
                    className="h-8 w-8"
                  />
                ) : (
                  <CreditCard className="h-5 w-5 text-slate-600" />
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">التفاصيل اللوجستية</p>
              <p className="text-lg font-semibold text-slate-900">التتبع</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Truck className="h-5 w-5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">

            {order.trackingNumber && (
              <div className="flex items-center justify-between bg-white border border-slate-100 rounded-xl px-4 py-3 text-sm">
                <div className="text-right">
                  <p className="text-xs text-slate-500">رقم التتبع</p>
                  {order.trackingUrl ? (
                    <Link href={order.trackingUrl} target="_blank" className="text-primary font-semibold hover:underline">
                      {order.trackingNumber}
                    </Link>
                  ) : (
                    <span className="font-semibold text-slate-800">{order.trackingNumber}</span>
                  )}
                </div>
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
                  <ArrowLeft className="h-5 w-5 text-slate-600" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600">تفاصيل المنتجات</p>
              <p className="text-lg font-semibold text-slate-900">محتوى الطلب</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Package className="h-5 w-5 text-slate-600" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.items.map(item => (
              <div key={item.id} className="flex flex-wrap items-center gap-4 bg-white border border-slate-100 p-4 rounded-xl shadow-[0_4px_14px_-10px_rgba(0,0,0,0.25)]">
                <div className="relative h-20 w-20 rounded-lg overflow-hidden bg-slate-50 flex-shrink-0">
                  {item.imageUrl ? (
                    <Image src={item.imageUrl} alt={(item as any).name || (item as any).productName || 'منتج'} fill className="object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-[180px] text-right">
                  <p className="font-semibold text-slate-900">{(item as any).name || (item as any).productName || '—'}</p>
                  <p className="text-xs text-slate-500">الكمية: {item.quantity}</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {Math.round(parseFloat(item.price)).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-left font-bold text-slate-900">
                  {Math.round(parseFloat(item.price) * item.quantity).toLocaleString('ar-LY', { style: 'currency', currency: 'LYD', maximumFractionDigits: 0, minimumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="bg-slate-50 border-t border-slate-100 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
            {order.trackingUrl && (
              <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                <Link href={order.trackingUrl} target="_blank">تتبع الشحنة</Link>
              </Button>
            )}
            <Button asChild variant="default" size="sm" className="w-full sm:w-auto">
              <Link href="/me">العودة إلى حسابي</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}