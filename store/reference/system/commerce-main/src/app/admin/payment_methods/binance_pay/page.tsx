'use client';

import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Save, Loader2, ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormik } from "formik";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";

const BinancePayConfigSchema = z.object({
  displayName: z.string({ required_error: "اسم العرض مطلوب" }),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean(),
  sortOrder: z.number().nullable().default(1),
  configData: z.object({
    apiKey: z.string({ required_error: "مفتاح API مطلوب" }),
    apiSecret: z.string({ required_error: "كلمة سر API مطلوبة" }),
    merchantId: z.string({ required_error: "رقم التاجر مطلوب" }),
    multiplier: z.number().min(0.0001).default(1),
  }),
});

export default function BinancePayConfigPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get payment method configuration
  const { data: paymentMethod, isLoading, error } = useQuery({
    queryKey: ['payment-method', PaymentMethodCode.BINANCE_PAY],
    queryFn: async () => {
      const response = await fetch(`/api/payment_methods/${PaymentMethodCode.BINANCE_PAY}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل في جلب تفاصيل طريقة الدفع');
      }
      return response.json();
    },
  });

  // Configure the form
  const formik = useFormik({
    initialValues: {
      displayName: '',
      description: '',
      isEnabled: false,
      sortOrder: 1,
      configData: {
        apiKey: '',
        apiSecret: '',
        merchantId: '',
        multiplier: 1,
      },
    },
    validate: (values) => {
      const result = BinancePayConfigSchema.safeParse(values);
      if (result.success) return {};
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        errors[path] = issue.message;
      }
      return errors;
    },
    onSubmit: async (values) => {
      setIsSubmitting(true);
      try {
        const response = await fetch(`/api/payment_methods/${PaymentMethodCode.BINANCE_PAY}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(values),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'فشل في تحديث طريقة الدفع');
        }

        toast("تم " + (showCreateAlert ? "إنشاء" : "تحديث") + " الإعدادات بنجاح");

        queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.BINANCE_PAY] });
        queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      } catch (error: any) {
        toast.error(error.message || "فشل في تحديث طريقة الدفع");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (paymentMethod) {
      const configData = typeof paymentMethod.configData === 'string' 
        ? JSON.parse(paymentMethod.configData) 
        : paymentMethod.configData;
      
      formik.setValues({
        displayName: paymentMethod.displayName,
        description: paymentMethod.description || '',
        isEnabled: paymentMethod.isEnabled,
        sortOrder: paymentMethod.sortOrder || 1,
        configData: {
          apiKey: configData.apiKey || '',
          apiSecret: configData.apiSecret || '',
          merchantId: configData.merchantId || '',
          multiplier: configData.multiplier || 1,
        },
      });
    }
  }, [paymentMethod]);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/payment_methods/${PaymentMethodCode.BINANCE_PAY}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل في حذف طريقة الدفع');
      }
      toast("تم حذف طريقة الدفع بنجاح");
      queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.BINANCE_PAY] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      router.push('/admin/payment_methods');
    } catch (error: any) {
      toast.error(error.message || "فشل في حذف طريقة الدفع");
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  let showCreateAlert = false;
  if (error && error.message && error.message.includes('طريقة الدفع غير موجودة')) {
    showCreateAlert = true;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">جاري تحميل إعدادات Binance Pay...</h2>
        </div>
      </div>
    );
  }
  if (error && !showCreateAlert) {
    return (
      <div className="container p-6 mx-auto" dir="rtl">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            حدث خطأ أثناء تحميل إعدادات Binance Pay. يرجى المحاولة مرة أخرى.
          </AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => router.push('/admin/payment_methods')}>
          العودة إلى طرق الدفع
        </Button>
      </div>
    );
  }
  return (
    <div className="container p-6 mx-auto" dir="rtl">
      {showCreateAlert && (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            🚀 مرحباً بك! لا توجد إعدادات مُكونة حالياً لطريقة الدفع هذه. املأ النموذج أدناه لإنشاء إعدادات جديدة وتفعيل بينانس باي لمتجرك.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex items-center mb-6">
        <Button variant="ghost" asChild className="ml-2">
          <Link href="/admin/payment_methods">
            <ChevronRight className="h-4 w-4 ml-2" />
            العودة إلى طرق الدفع
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {showCreateAlert ? 'إنشاء إعدادات بينانس باي (Binance Pay)' : 'تعديل إعدادات بينانس باي (Binance Pay)'}
          </h1>
          {showCreateAlert && (
            <p className="text-sm text-muted-foreground mt-1">
              قم بتكوين إعدادات بينانس باي لتمكين عملائك من الدفع بالعملات الرقمية بسهولة وأمان
            </p>
          )}
        </div>
        {/* Only show delete button if paymentMethod exists and not in create mode */}
        {paymentMethod && !showCreateAlert && (
          <Button
            variant="destructive"
            className="mr-auto px-3 py-2"
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isSubmitting}
          >
            <Trash2 className="h-4 w-4 ml-1" /> حذف
          </Button>
        )}
      </div>
      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-background rounded-lg shadow-lg p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-bold mb-2">تأكيد الحذف</h2>
            <p className="mb-4">هل أنت متأكد أنك تريد حذف إعدادات بينانس باي؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isSubmitting}>
                إلغاء
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Trash2 className="ml-2 h-4 w-4" />} حذف نهائي
              </Button>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>توثيق بينانس باي</CardTitle>
            <CardDescription>
              روابط مفيدة للتوثيق الرسمي لبينانس باي
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-2">
              <Link href="https://developers.binance.com/docs/binance-pay/introduction" target="_blank" className="flex items-center text-primary">
                <ExternalLink className="h-4 w-4 ml-2" />
                مقدمة إلى Binance Pay API
              </Link>
              <Link href="https://developers.binance.com/docs/binance-pay/api-order-create" target="_blank" className="flex items-center text-primary">
                <ExternalLink className="h-4 w-4 ml-2" />
                توثيق إنشاء طلب الدفع
              </Link>
              <Link href="https://developers.binance.com/docs/binance-pay/webhook" target="_blank" className="flex items-center text-primary">
                <ExternalLink className="h-4 w-4 ml-2" />
                إعداد Webhook لإشعارات الدفع
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      <form onSubmit={formik.handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>المعلومات الأساسية</CardTitle>
            <CardDescription>
              المعلومات العامة لطريقة الدفع
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">اسم العرض (يظهر للعملاء)</Label>
              <Input
                id="displayName"
                name="displayName"
                value={formik.values.displayName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.displayName && formik.errors.displayName && (
                <p className="text-sm text-red-500">{formik.errors.displayName as string}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">وصف طريقة الدفع (اختياري)</Label>
              <Input
                id="description"
                name="description"
                value={formik.values.description || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">ترتيب العرض</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                value={formik.values.sortOrder || 0}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
            </div>

            <div className="flex items-center space-x-2 justify-end">
              <Switch
                id="isEnabled"
                name="isEnabled"
                checked={formik.values.isEnabled}
                onCheckedChange={(checked) => formik.setFieldValue('isEnabled', checked)}
              />
              <Label htmlFor="isEnabled" className="mr-2">تفعيل طريقة الدفع</Label>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>إعدادات API</CardTitle>
            <CardDescription>
              بيانات الاتصال المطلوبة لتكوين Binance Pay
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="configData.apiKey">
                مفتاح API <span className="text-red-500">*</span>
              </Label>
              <Input
                id="configData.apiKey"
                name="configData.apiKey"
                value={formik.values.configData.apiKey}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                autoComplete="off"
              />
              {formik.touched.configData?.apiKey && (formik.errors.configData as any)?.apiKey && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).apiKey}</p>
              )}
            </div>
            <div className="space-y-2 relative">
              <Label htmlFor="configData.apiSecret">
                كلمة سر API <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center">
                <Input
                  id="configData.apiSecret"
                  name="configData.apiSecret"
                  type={showApiSecret ? "text" : "password"}
                  value={formik.values.configData.apiSecret}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  autoComplete="off"
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
                  onClick={() => setShowApiSecret((v) => !v)}
                  aria-label={showApiSecret ? "إخفاء كلمة السر" : "إظهار كلمة السر"}
                >
                  {showApiSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {formik.touched.configData?.apiSecret && (formik.errors.configData as any)?.apiSecret && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).apiSecret}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="configData.merchantId">
                رقم التاجر <span className="text-red-500">*</span>
              </Label>
              <Input
                id="configData.merchantId"
                name="configData.merchantId"
                value={formik.values.configData.merchantId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.configData?.merchantId && (formik.errors.configData as any)?.merchantId && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).merchantId}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="configData.multiplier">
                معدل التحويل (LYD إلى USDT) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="configData.multiplier"
                name="configData.multiplier"
                type="number"
                step="0.0001"
                value={formik.values.configData.multiplier}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.configData?.multiplier && (formik.errors.configData as any)?.multiplier && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).multiplier}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>معلومات Webhook</CardTitle>
            <CardDescription>
              عنوان Webhook لاستلام إشعارات الدفع من بينانس باي
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-md">
              <p className="font-mono text-sm break-all">
                {`${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/api/binance_pay/webhook`}
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                استخدم عنوان URL هذا في لوحة تحكم مطوري بينانس باي لتلقي تحديثات حالة الدفع.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" type="button" onClick={() => router.push('/admin/payment_methods')}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="ml-2 h-4 w-4" />
                  {showCreateAlert ? 'إنشاء الإعدادات' : 'حفظ التغييرات'}
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
