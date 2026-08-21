import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { getOrderById } from '@/modules/orders/services/orderService';
import { Order, OrderStatus } from '@/modules/orders/types/orderTypes';
import { PaymentMethodCode, PaymentStatus } from '@/modules/payments/types/paymentTypes';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { OrderStatusManager } from '../components/OrderStatusManager';
import { PaymentStatusManager } from '../components/PaymentStatusManager';
import { ShippingStatusManager } from '../components/ShippingStatusManager';
import { ArrowRight, User, MapPin, CreditCard, Truck, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Arabic localized payment method code names
const methodCodeNames: Record<string, string> = {
  [PaymentMethodCode.BINANCE_PAY]: "بينانس باي",
  [PaymentMethodCode.MANUAL_PAYMENT]: "الدفع اليدوي",
  [PaymentMethodCode.SADAD_PAY]: "سداد باي",
  [PaymentMethodCode.MOAMALAT]: "معاملات (Moamalat)",
  [PaymentMethodCode.PLUTU]: "بلوتو",
  [PaymentMethodCode.PLUTU_SADAD]: "سداد (بلوتو)",
  [PaymentMethodCode.PLUTU_EDFALI]: "إدفعلي (بلوتو)",
  [PaymentMethodCode.PLUTU_MPGS]: "MPGS (بلوتو)",
  [PaymentMethodCode.PLUTU_TLYNC]: "Tlync (بلوتو)",
  [PaymentMethodCode.PLUTU_LOCAL_CARDS]: "بطاقات محلية (بلوتو)",
  [PaymentMethodCode.BANK_CARDS_ON_DELIVERY]: "بطاقة مصرفية عند الاستلام",
  'cash_on_delivery': "الدفع عند الاستلام",
};

// Icon map for Plutu subchannels (paired with base Plutu icon)
const PLUTU_CHANNEL_ICONS: Partial<Record<string, string>> = {
  [PaymentMethodCode.PLUTU_SADAD]: "/sadad.png",
  [PaymentMethodCode.PLUTU_EDFALI]: "/Edfali.png",
  [PaymentMethodCode.PLUTU_MPGS]: "/mastercard.svg",
  [PaymentMethodCode.PLUTU_TLYNC]: "/t-lync.png",
  [PaymentMethodCode.PLUTU_LOCAL_CARDS]: "/moamalat.svg",
};

// Payment status labels
const paymentStatusLabels: Record<string, string> = {
  [PaymentStatus.PENDING]: 'معلق',
  [PaymentStatus.COMPLETED]: 'مكتمل',
  [PaymentStatus.FAILED]: 'فاشل',
  [PaymentStatus.CANCELLED]: 'ملغي',
  [PaymentStatus.REFUNDED]: 'تم استرداد',
  [PaymentStatus.WAITING_FOR_VERIFICATION]: 'في انتظار التحقق',
  'unpaid': 'غير مدفوع',
  'paid': 'مدفوع'
};

// Simple icon map (fallback for non-Plutu)
const METHOD_ICONS: Record<string, string> = {
  [PaymentMethodCode.BINANCE_PAY]: "/binance.svg",
  [PaymentMethodCode.MANUAL_PAYMENT]: "/manual.svg",
  [PaymentMethodCode.SADAD_PAY]: "/sadad.png",
  [PaymentMethodCode.MOAMALAT]: "/moamalat.svg",
  [PaymentMethodCode.PLUTU]: "/plutu.svg",
  [PaymentMethodCode.BANK_CARDS_ON_DELIVERY]: "/bank_cards.svg",
};

function renderPaymentIcon(methodCode: string) {
  const isPlutuChannel = Boolean(PLUTU_CHANNEL_ICONS[methodCode]);

  if (isPlutuChannel) {
    const channelIcon = PLUTU_CHANNEL_ICONS[methodCode] as string;
    return (
      <span className="flex items-center gap-1" title={methodCodeNames[methodCode] || methodCode}>
        <img src="/plutu.svg" alt="Plutu" className="h-6 w-6 object-contain" />
        <img src={channelIcon} alt="قناة بلوتو" className="h-6 w-6 object-contain" />
      </span>
    );
  }

  const icon = METHOD_ICONS[methodCode];

  if (icon) {
    return <img src={icon} alt={methodCodeNames[methodCode] || methodCode} className="h-6 w-6 object-contain" />;
  }

  if (methodCode?.startsWith('plutu_')) {
    return <img src="/plutu.svg" alt="Plutu" className="h-6 w-6 object-contain" />;
  }

  return <span>{methodCodeNames[methodCode] || methodCode}</span>;
}

interface PageProps {
  params: Promise<{ orderIdOrNumber: string }>;
}

export default async function Page({ params }: PageProps) {
  const { orderIdOrNumber } = await params;
  const order: Order | undefined = await getOrderById(orderIdOrNumber);

  if (!order) {
    return (
      <div dir="rtl" className="p-8 flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">الطلب غير موجود</h1>
        <Button asChild>
          <Link href="/admin/orders">
            <ArrowRight className="ml-2 h-4 w-4" />
            رجوع إلى قائمة الطلبات
          </Link>
        </Button>
      </div>
    );
  }

  // Mapping of order statuses
  const statusMap = {
    [OrderStatus.Pending]: { label: 'قيد الانتظار', variant: 'secondary' },
    [OrderStatus.Processing]: { label: 'جاري المعالجة', variant: 'default' },
    [OrderStatus.Shipped]: { label: 'تم الشحن', variant: 'secondary' },
    [OrderStatus.Delivered]: { label: 'تم التسليم', variant: 'default' },
    [OrderStatus.Cancelled]: { label: 'ملغي', variant: 'destructive' },
  } as const;

  return (
    <div dir="rtl" className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link href="/admin/orders">
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">الطلب #{order.orderNumber}</h1>
            <p className="text-muted-foreground text-sm">
              تم الإنشاء في {new Date(order.createdAt).toLocaleString('ar-LY')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <OrderStatusManager orderId={order.id} currentStatus={order.status} />
          {order.trackingUrl && (
            <Button variant="outline" asChild>
              <Link href={order.trackingUrl} target="_blank">تتبع الشحنة</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>عناصر الطلب</CardTitle>
              <CardDescription>عدد العناصر: {order.items.length}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">المنتج</TableHead>
                    <TableHead>التفاصيل</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-left">السعر</TableHead>
                    <TableHead className="text-left">المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="relative w-12 h-12 rounded-md overflow-hidden border bg-muted">
                          {item.imageUrl ? (
                            <Image
                              src={item.imageUrl}
                              alt={item.productName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-xs text-muted-foreground">
                              لا توجد صورة
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item.productName}</div>
                        {item.variantTitle && (
                          <div className="text-sm text-muted-foreground">{item.variantTitle}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-left">{parseFloat(item.price).toFixed(2)} د.ل</TableCell>
                      <TableCell className="text-left font-medium">
                        {(parseFloat(item.price) * item.quantity).toFixed(2)} د.ل
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Separator className="my-4" />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المجموع الفرعي</span>
                  <span>{order.total} د.ل</span>
                </div>
                {parseFloat(order.walletAmountUsed || "0") > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>مدفوع من المحفظة</span>
                    <span>-{parseFloat(order.walletAmountUsed!).toFixed(2)} د.ل</span>
                  </div>
                )}
                {/* Here we could add shipping/discount rows if available in data */}
                <div className="flex justify-between pt-2 font-bold text-lg">
                  <span>الإجمالي المطلوب من العميل</span>
                  <span>{(parseFloat(order.total) - parseFloat(order.walletAmountUsed || "0")).toFixed(2)} د.ل</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                معلومات الدفع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">طريقة الدفع:</span>
                  <div className="flex items-center gap-2 font-medium">
                    {renderPaymentIcon(order.payment?.paymentMethod || 'unknown')}
                    <span className="text-sm">
                      {methodCodeNames[order.payment?.paymentMethod || ''] || (order.payment?.paymentMethod === 'cash_on_delivery' ? 'الدفع عند الاستلام' : order.payment?.paymentMethod || 'غير محدد')}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">حالة الدفع:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant={order.payment?.status === PaymentStatus.COMPLETED ? 'default' : 'secondary'}>
                      {paymentStatusLabels[order.payment?.status || ''] || order.payment?.status || 'غير مدفوع'}
                    </Badge>
                    {order.payment?.status && (
                      <PaymentStatusManager orderId={order.id} currentStatus={order.payment.status} />
                    )}
                  </div>
                </div>
                {order.payment?.transactionId && (
                  <div className="col-span-2">
                    <span className="text-sm text-muted-foreground block mb-1">رقم المعاملة:</span>
                    <span className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block" dir="ltr">
                      {order.payment.transactionId}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">حالة الطلب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الحالة الحالية</span>
                <Badge variant={statusMap[order.status]?.variant as any}>
                  {statusMap[order.status]?.label}
                </Badge>
              </div>
              <OrderStatusManager orderId={order.id} currentStatus={order.status} />
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-4 w-4" />
                العميل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Link href={`/admin/users/${order.userId}`} className="font-medium text-primary hover:underline block">
                  {order.userName ?? 'مستخدم غير معروف'}
                </Link>
                <span className="text-xs text-muted-foreground">{order.userId}</span>
              </div>
              <Separator />
              {/* Shipping Address placeholder - assuming it might be in order object but typed loosely or waiting for schema update.
                   For now, showing what we have or static if needed. The schema has shippingAddress text field.
               */}
              {/* <div className="space-y-1">
                   <div className="flex items-center gap-2 text-sm text-muted-foreground">
                       <MapPin className="h-3 w-3" />
                       عنوان التوصيل
                   </div>
                   <p className="text-sm leading-relaxed">
                       {/* Render shipping address if available, currently just schema check implied it exists as text *}
                       {/*order.shippingAddress || 'لا يوجد عنوان مسجل'}
                   </p>
               </div> */}
            </CardContent>
          </Card>

          {/* Delivery Info */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-4 w-4" />
                التوصيل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground block mb-1">حالة التوصيل</span>
                  <Badge variant={order.shippingStatus === OrderStatus.Delivered ? 'default' : 'secondary'}>
                    {statusMap[order.shippingStatus as OrderStatus]?.label || order.shippingStatus || 'غير محدد'}
                  </Badge>
                </div>
                <ShippingStatusManager orderId={order.id} currentStatus={order.shippingStatus || OrderStatus.Pending} />
              </div>
              <div>
                <span className="text-sm text-muted-foreground block">رقم التتبع</span>
                {order.trackingUrl ? (
                  <Link
                    href={order.trackingUrl}
                    target="_blank"
                    className="font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    {order.trackingNumber}
                    <ArrowRight className="h-3 w-3 -rotate-45" />
                  </Link>
                ) : (
                  <span className="font-medium">{order.trackingNumber ?? 'غير متوفر'}</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}