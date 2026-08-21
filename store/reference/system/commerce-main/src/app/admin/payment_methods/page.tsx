'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PaymentMethodCode, PaymentMethodConfiguration, PaymentStatus } from "@/modules/payments/types/paymentTypes";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, BadgeAlert, Settings, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

// Arabic localized payment method code names
const methodCodeNames: Record<PaymentMethodCode, string> = {
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
  [PaymentMethodCode.WALLET]: "محفظة",
};

// Icon map for Plutu subchannels (paired with base Plutu icon)
const PLUTU_CHANNEL_ICONS: Partial<Record<PaymentMethodCode, string>> = {
  [PaymentMethodCode.PLUTU_SADAD]: "/sadad.png",
  [PaymentMethodCode.PLUTU_EDFALI]: "/Edfali.png",
  [PaymentMethodCode.PLUTU_MPGS]: "/mastercard.svg",
  [PaymentMethodCode.PLUTU_TLYNC]: "/t-lync.png",
  [PaymentMethodCode.PLUTU_LOCAL_CARDS]: "/moamalat.svg",
};

// All supported payment methods
const SUPPORTED_PAYMENT_METHODS: Array<{
  methodCode: PaymentMethodCode;
  displayName: string;
  description?: string;
  icon: string; // path to official icon
  showTile?: boolean;
}> = [
    {
      methodCode: PaymentMethodCode.BINANCE_PAY,
      displayName: "بينانس باي",
      description: "دفع عبر Binance Pay",
      icon: "/binance.svg"
    },
    {
      methodCode: PaymentMethodCode.MANUAL_PAYMENT,
      displayName: "الدفع اليدوي",
      description: "دفع يدوي (تحويل مصرفي أو نقدي)",
      icon: "/manual.svg"
    },
    {
      methodCode: PaymentMethodCode.BANK_CARDS_ON_DELIVERY,
      displayName: "بطاقة مصرفية عند الاستلام",
      description: "دفع ببطاقة محلية عند التوصيل (نظام POS)",
      icon: "/bank_cards.svg"
    },
    {
      methodCode: PaymentMethodCode.SADAD_PAY,
      displayName: "سداد باي",
      description: "دفع عبر سداد باي",
      icon: "/sadad.png"
    },
    {
      methodCode: PaymentMethodCode.MOAMALAT,
      displayName: "معاملات (Moamalat)",
      description: "الدفع عبر شبكة معاملات",
      icon: "/moamalat.svg"
    },
    {
      methodCode: PaymentMethodCode.PLUTU,
      displayName: "بلوتو",
      description: "بوابة دفع بلوتو متعددة القنوات",
      icon: "/plutu.svg"
    },
    // Subchannels are listed so icon lookup works for reports/filters
    {
      methodCode: PaymentMethodCode.PLUTU_SADAD,
      displayName: "سداد (بلوتو)",
      description: "دفع عبر سداد API مع بلوتو",
      icon: "/plutu.svg",
      showTile: false
    },
    {
      methodCode: PaymentMethodCode.PLUTU_EDFALI,
      displayName: "إدفعلي (بلوتو)",
      description: "دفع عبر إدفعلي مع بلوتو",
      icon: "/plutu.svg",
      showTile: false
    },
    {
      methodCode: PaymentMethodCode.PLUTU_MPGS,
      displayName: "MPGS (بلوتو)",
      description: "بوابة ماستركارد عبر بلوتو",
      icon: "/plutu.svg",
      showTile: false
    },
    {
      methodCode: PaymentMethodCode.PLUTU_TLYNC,
      displayName: "Tlync (بلوتو)",
      description: "دفع عبر Tlync مع بلوتو",
      icon: "/plutu.svg",
      showTile: false
    },
    {
      methodCode: PaymentMethodCode.PLUTU_LOCAL_CARDS,
      displayName: "بطاقات محلية (بلوتو)",
      description: "بطاقات محلية عبر بلوتو",
      icon: "/plutu.svg",
      showTile: false
    },
  ];

// Define status labels mapping
const statusLabels: Record<PaymentStatus, string> = {
  pending: 'معلق', completed: 'مكتمل', failed: 'فاشل', cancelled: 'ملغي', refunded: 'تم استرداد', waiting_for_verification: 'في انتظار التحقق'
};

export default function PaymentMethodsPage() {
  const queryClient = useQueryClient();

  // State for payments table
  const [search, setSearch] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all');
  const [filterMethod, setFilterMethod] = useState<PaymentMethodCode | 'all'>('all');
  const [page, setPage] = useState<number>(1);
  const perPage = 10;
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Fetch payments data
  const { data: paymentsData, isLoading: paymentsLoading } = useQuery<{ data: Array<{ id: string; orderId: string; orderNumber: string; amount: string; currency: string; status: PaymentStatus; paymentMethod: PaymentMethodCode; createdAt: string; }>; total: number; page: number; perPage: number }>({
    queryKey: ['payments', search, filterStatus, filterMethod, page, sortBy, sortOrder],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('perPage', String(perPage));
      if (search) params.set('search', search);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterMethod !== 'all') params.set('methodCode', filterMethod);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortOrder);
      const res = await fetch(`/api/payments?${params.toString()}`);
      if (!res.ok) throw new Error('فشل في جلب سجلات الدفع');
      return res.json();
    }
  });

  // Fetch payment methods
  const { data: paymentMethods, isLoading } = useQuery<PaymentMethodConfiguration[]>({
    queryKey: ['admin-payment-methods'],
    queryFn: async () => {
      const response = await fetch('/api/payment_methods?admin=true');
      if (!response.ok) {
        throw new Error('فشل في جلب طرق الدفع');
      }
      return response.json();
    }
  });

  // Merge supported methods with DB data
  const mergedMethods = SUPPORTED_PAYMENT_METHODS.map((supported) => {
    const dbMethod = paymentMethods?.find((m) => m.methodCode === supported.methodCode);
    return {
      ...supported,
      ...dbMethod,
      // fallback to supported defaults if DB data missing
      displayName: supported.displayName,
      description: dbMethod?.description || supported.description,
      isEnabled: dbMethod?.isEnabled ?? false,
    };
  }).filter(m => m.showTile !== false); // Exclude subchannels from main list

  // Helper to render payment method icon (Plutu channels show dual icons)
  const renderPaymentIcon = (paymentMethod: PaymentMethodCode) => {
    const isPlutuChannel = Boolean(PLUTU_CHANNEL_ICONS[paymentMethod]);

    if (isPlutuChannel) {
      const channelIcon = PLUTU_CHANNEL_ICONS[paymentMethod] as string;
      return (
        <span className="flex items-center gap-1" aria-label={methodCodeNames[paymentMethod] || paymentMethod}>
          <img src="/plutu.svg" alt="Plutu" className="h-6 w-6 object-contain" />
          <img src={channelIcon} alt="قناة بلوتو" className="h-6 w-6 object-contain" />
        </span>
      );
    }

    const icon = SUPPORTED_PAYMENT_METHODS.find(m => m.methodCode === paymentMethod)?.icon;
    return icon ? (
      <img src={icon} alt={methodCodeNames[paymentMethod] || paymentMethod} className="h-6 w-6 object-contain" />
    ) : (
      <span>{methodCodeNames[paymentMethod] || paymentMethod}</span>
    );
  };

  // Mutation for toggling payment method status
  const toggleMethodMutation = useMutation({
    mutationFn: async ({ methodCode, isEnabled }: { methodCode: PaymentMethodCode, isEnabled: boolean }) => {
      const method = paymentMethods?.find(m => m.methodCode === methodCode);
      if (!method) throw new Error('طريقة الدفع غير موجودة');

      const response = await fetch(`/api/payment_methods/${methodCode}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...method,
          isEnabled,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل في تحديث طريقة الدفع');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      toast(
        "تم تحديث طريقة الدفع بنجاح",
      );
    },
    onError: (error) => {
      toast.error(
        "حدث خطأ",
      );
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">جاري تحميل طرق الدفع...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container p-6 mx-auto" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">إدارة طرق الدفع</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {mergedMethods.map((method) => (
          <Card key={method.methodCode}>
            <CardHeader>
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <img src={method.icon} alt={method.displayName + ' icon'} className="h-7 w-7 object-contain" />
                  <CardTitle className="text-xl">{method.displayName}</CardTitle>
                </div>
                {method.isEnabled ? (
                  <BadgeCheck className="text-green-500 h-6 w-6" />
                ) : (
                  <BadgeAlert className="text-amber-500 h-6 w-6" />
                )}
              </div>
              <CardDescription>
                {method.description || `إعدادات ${methodCodeNames[method.methodCode as PaymentMethodCode] || method.methodCode}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor={`enable-${method.methodCode}`} className="font-medium">
                    {method.isEnabled ? "مفعّل" : "معطّل"}
                  </Label>
                  <Switch
                    id={`enable-${method.methodCode}`}
                    checked={method.isEnabled}
                    onCheckedChange={(checked) =>
                      toggleMethodMutation.mutate({
                        methodCode: method.methodCode as PaymentMethodCode,
                        isEnabled: checked
                      })
                    }
                  />
                </div>

                {method.methodCode === PaymentMethodCode.BINANCE_PAY && (
                  <Link
                    href="/admin/payment_methods/binance_pay"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات {methodCodeNames[method.methodCode as PaymentMethodCode]}
                    </Button>
                  </Link>
                )}

                {method.methodCode === PaymentMethodCode.MANUAL_PAYMENT && (
                  <Link
                    href="/admin/payment_methods/manual_payment"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات {methodCodeNames[method.methodCode as PaymentMethodCode]}
                    </Button>
                  </Link>
                )}

                {method.methodCode === PaymentMethodCode.BANK_CARDS_ON_DELIVERY && (
                  <Link
                    href="/admin/payment_methods/bank_cards_on_delivery"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات {methodCodeNames[method.methodCode as PaymentMethodCode]}
                    </Button>
                  </Link>
                )}

                {method.methodCode === PaymentMethodCode.SADAD_PAY && (
                  <Link
                    href="/admin/payment_methods/sadad_pay"
                    className="w-full"
                  >
                  </Link>
                )}

                {method.methodCode === PaymentMethodCode.MOAMALAT && (
                  <Link
                    href="/admin/payment_methods/moamalat"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات
                    </Button>
                  </Link>
                )}

                {method.methodCode === PaymentMethodCode.PLUTU && (
                  <Link
                    href="/admin/payment_methods/plutu"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      <Settings className="ml-2 h-4 w-4" />
                      إعدادات {methodCodeNames[method.methodCode as PaymentMethodCode]}
                    </Button>
                  </Link>
                )}

                {/* Add documentation link for the payment method if available */}
                {method.methodCode === PaymentMethodCode.BINANCE_PAY && (
                  <Link
                    href="https://developers.binance.com/docs/binance-pay/introduction"
                    target="_blank"
                    className="w-full"
                  >
                    <Button variant="outline" className="w-full">
                      <ExternalLink className="ml-2 h-4 w-4" />
                      توثيق Binance Pay
                    </Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payments Table */}
      <div className="mt-10">
        <h2 className="text-2xl font-semibold mb-4">سجل المدفوعات</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
          <Input placeholder="بحث..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          <Select value={filterStatus} onValueChange={value => { setFilterStatus(value as PaymentStatus); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value={PaymentStatus.PENDING}>معلق</SelectItem>
              <SelectItem value={PaymentStatus.COMPLETED}>مكتمل</SelectItem>
              <SelectItem value={PaymentStatus.FAILED}>فاشل</SelectItem>
              <SelectItem value={PaymentStatus.CANCELLED}>ملغي</SelectItem>
              <SelectItem value={PaymentStatus.REFUNDED}>تم استرداد</SelectItem>
              <SelectItem value={PaymentStatus.WAITING_FOR_VERIFICATION}>في انتظار التحقق</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterMethod} onValueChange={value => { setFilterMethod(value as PaymentMethodCode); setPage(1); }}>
            <SelectTrigger><SelectValue placeholder="طريقة الدفع" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {SUPPORTED_PAYMENT_METHODS.map(m => (
                <SelectItem key={m.methodCode} value={m.methodCode}>{m.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الدفع</TableHead>
                <TableHead>الطلب</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>العملة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>طريقة الدفع</TableHead>
                <TableHead>تاريخ الإنشاء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paymentsLoading ? (
                <TableRow><TableCell colSpan={7}>جاري التحميل...</TableCell></TableRow>
              ) : paymentsData?.data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.id}</TableCell>
                  <TableCell>
                    <Link href={`/admin/orders/${p.orderId}`} className="text-blue-600 hover:underline">
                      {p.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{p.amount}</TableCell>
                  <TableCell>{p.currency}</TableCell>
                  <TableCell>{statusLabels[p.status]}</TableCell>
                  <TableCell>{renderPaymentIcon(p.paymentMethod as PaymentMethodCode)}</TableCell>
                  <TableCell>{new Date(p.createdAt).toLocaleString('ar-EG')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Pagination */}
        <div className="flex justify-end items-center mt-4 space-x-2">
          <Button disabled={page <= 1} onClick={() => setPage(page - 1)}>السابق</Button>
          <span>صفحة {page} من {paymentsData ? Math.ceil(paymentsData.total / perPage) : 1}</span>
          <Button disabled={paymentsData ? page >= Math.ceil(paymentsData.total / perPage) : true} onClick={() => setPage(page + 1)}>التالي</Button>
        </div>
      </div>
    </div>
  );
}