'use client';

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ChevronRight, Save, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormik } from "formik";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ManualPaymentConfigSchema = z.object({
  displayName: z.string({ required_error: "اسم العرض مطلوب" }),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean(),
  sortOrder: z.number().nullable().default(2),
  configData: z.object({
    instructionsAr: z.string({ required_error: "تعليمات الدفع باللغة العربية مطلوبة" }),
    instructionsEn: z.string().optional(),
  }),
});

export default function ManualPaymentConfigPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get payment method configuration
  const { data: paymentMethod, isLoading, error } = useQuery({
    queryKey: ['payment-method', PaymentMethodCode.MANUAL_PAYMENT],
    queryFn: async () => {
      const response = await fetch(`/api/payment_methods/${PaymentMethodCode.MANUAL_PAYMENT}`);
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
      sortOrder: 2,
      configData: {
        instructionsAr: '',
        instructionsEn: '',
      },
    },
    validate: (values) => {
      const result = ManualPaymentConfigSchema.safeParse(values);
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
        const response = await fetch(`/api/payment_methods/${PaymentMethodCode.MANUAL_PAYMENT}`, {
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

        queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.MANUAL_PAYMENT] });
        queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      } catch (error: any) {
        toast.error(error.message || "فشل في تحديث طريقة الدفع");
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/payment_methods/${PaymentMethodCode.MANUAL_PAYMENT}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'فشل في حذف طريقة الدفع');
      }
      toast("تم حذف طريقة الدفع بنجاح");
      queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.MANUAL_PAYMENT] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      router.push('/admin/payment_methods');
    } catch (error: any) {
      toast.error(error.message || "فشل في حذف طريقة الدفع");
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

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
        sortOrder: paymentMethod.sortOrder || 2,
        configData: {
          instructionsAr: configData.instructionsAr || '',
          instructionsEn: configData.instructionsEn || '',
        },
      });
    }
  }, [paymentMethod]);

  let showCreateAlert = false;
  if (error && error.message && error.message.includes('طريقة الدفع غير موجودة')) {
    showCreateAlert = true;
  }
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">جاري تحميل إعدادات الدفع اليدوي...</h2>
        </div>
      </div>
    );
  }
  if (error && !showCreateAlert) {
    return (
      <div className="container p-6 mx-auto" dir="rtl">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            حدث خطأ أثناء تحميل إعدادات الدفع اليدوي. يرجى المحاولة مرة أخرى.
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
            🚀 مرحباً بك! لا توجد إعدادات مُكونة حالياً لطريقة الدفع هذه. املأ النموذج أدناه لإنشاء إعدادات جديدة وتفعيل الدفع اليدوي لمتجرك.
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
            {showCreateAlert ? 'إنشاء إعدادات الدفع اليدوي' : 'تعديل إعدادات الدفع اليدوي'}
          </h1>
          {showCreateAlert && (
            <p className="text-sm text-muted-foreground mt-1">
              قم بتكوين إعدادات الدفع اليدوي لتمكين عملائك من الدفع عبر التحويل البنكي أو الدفع النقدي
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
            <p className="mb-4">هل أنت متأكد أنك تريد حذف إعدادات الدفع اليدوي؟ لا يمكن التراجع عن هذا الإجراء.</p>
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
            <CardTitle>تعليمات الدفع</CardTitle>
            <CardDescription>
              تعليمات الدفع التي ستظهر للعملاء عند اختيار هذه الطريقة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="configData.instructionsAr">
                تعليمات الدفع (العربية) <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="configData.instructionsAr"
                name="configData.instructionsAr"
                rows={5}
                value={formik.values.configData.instructionsAr}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.configData?.instructionsAr && (formik.errors.configData as any)?.instructionsAr && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).instructionsAr}</p>
              )}
              <p className="text-sm text-muted-foreground">
                أدخل تعليمات مفصلة عن كيفية إجراء الدفع، مثل تفاصيل الحساب البنكي أو طرق الدفع المقبولة.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="configData.instructionsEn">
                تعليمات الدفع (الإنجليزية) - اختياري
              </Label>
              <Textarea
                id="configData.instructionsEn"
                name="configData.instructionsEn"
                rows={5}
                value={formik.values.configData.instructionsEn}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              <p className="text-sm text-muted-foreground">
                أدخل تعليمات الدفع باللغة الإنجليزية للعملاء غير الناطقين بالعربية.
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
