'use client';

import { PaymentMethodCode } from '@/modules/payments/types/paymentTypes';
import { useFormik } from 'formik';
import { ChevronRight, Eye, EyeOff, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

// Zod schema for Moamalat configuration
const MoamalatConfigSchema = z.object({
  displayName: z.string({ required_error: 'اسم العرض مطلوب' }),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean(),
  sortOrder: z.number().nullable().default(4),
  configData: z.object({
    merchantId: z.string({ required_error: 'معرف التاجر مطلوب' }),
    terminalId: z.string({ required_error: 'معرف الجهاز مطلوب' }),
    secureKey: z.string({ required_error: 'المفتاح السري مطلوب' }),
    sandboxMode: z.boolean().default(true),
  }),
});

export default function MoamalatConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSecureKey, setShowSecureKey] = useState(false);

  // Fetch existing config
  const { data: paymentMethod, isLoading, error } = useQuery({
    queryKey: ['payment-method', PaymentMethodCode.MOAMALAT],
    queryFn: async () => {
      const res = await fetch(`/api/payment_methods/${PaymentMethodCode.MOAMALAT}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل في جلب تفاصيل طريقة الدفع');
      }
      return res.json();
    },
  });

  // Initialize formik
  const formik = useFormik({
    initialValues: {
      displayName: '',
      description: '',
      isEnabled: false,
      sortOrder: 4,
      configData: {
        merchantId: '',
        terminalId: '',
        secureKey: '',
        sandboxMode: true,
      },
    },
    validate: values => {
      const result = MoamalatConfigSchema.safeParse(values);
      if (result.success) return {};
      const errs: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const path = issue.path.join('.');
        errs[path] = issue.message;
      });
      return errs;
    },
    onSubmit: async values => {
      setIsSubmitting(true);
      try {
        const res = await fetch(`/api/payment_methods/${PaymentMethodCode.MOAMALAT}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'فشل في تحديث طريقة الدفع');
        }
        toast('تم ' + (showCreateAlert ? 'إنشاء' : 'تحديث') + ' الإعدادات بنجاح');
        queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.MOAMALAT] });
        queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      } catch (e: any) {
        toast.error(e.message || 'فشل في تحديث طريقة الدفع');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // Delete handler
  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/payment_methods/${PaymentMethodCode.MOAMALAT}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'فشل في حذف طريقة الدفع');
      }
      toast('تم حذف طريقة الدفع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.MOAMALAT] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      router.push('/admin/payment_methods');
    } catch (e: any) {
      toast.error(e.message || 'فشل في حذف طريقة الدفع');
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Populate form when data loads
  useEffect(() => {
    if (paymentMethod) {
      const cfg = typeof paymentMethod.configData === 'string'
        ? JSON.parse(paymentMethod.configData)
        : paymentMethod.configData;
      formik.setValues({
        displayName: paymentMethod.displayName,
        description: paymentMethod.description || '',
        isEnabled: paymentMethod.isEnabled,
        sortOrder: paymentMethod.sortOrder || 4,
        configData: {
          merchantId: cfg.merchantId || '',
          terminalId: cfg.terminalId || '',
          secureKey: cfg.secureKey || '',
          sandboxMode: cfg.sandboxMode ?? true,
        },
      });
    }
  }, [paymentMethod]);

  const showCreateAlert = error?.message?.includes('غير موجودة');

  if (isLoading) return (
    <div className="flex items-center justify-center h-full p-8">
      <h2 className="text-xl font-semibold">جاري تحميل إعدادات معاملات...</h2>
    </div>
  );

  if (error && !showCreateAlert) return (
    <div className="container p-6 mx-auto" dir="rtl">
      <Alert variant="destructive" className="mb-4">
        <AlertDescription>حدث خطأ أثناء تحميل إعدادات معاملات. يرجى المحاولة مرة أخرى.</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={() => router.push('/admin/payment_methods')}>العودة إلى طرق الدفع</Button>
    </div>
  );

  return (
    <div className="container p-6 mx-auto" dir="rtl">
      {showCreateAlert && (
        <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            🚀 مرحباً بك! لا توجد إعدادات مُكونة حالياً لطريقة الدفع هذه. املأ النموذج أدناه لإنشاء إعدادات جديدة وتفعيل معاملات لمتجرك.
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
            {showCreateAlert ? 'إنشاء إعدادات معاملات (Moamalat)' : 'تعديل إعدادات معاملات (Moamalat)'}
          </h1>
          {showCreateAlert && (
            <p className="text-sm text-muted-foreground mt-1">
              قم بتكوين إعدادات معاملات لتمكين عملائك من الدفع بسهولة وأمان
            </p>
          )}
        </div>
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white dark:bg-background rounded-lg shadow-lg p-6 w-full max-w-sm text-center">
            <h2 className="text-lg font-bold mb-2">تأكيد الحذف</h2>
            <p className="mb-4">هل أنت متأكد أنك تريد حذف إعدادات معاملات؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={isSubmitting}>
                إلغاء
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? 'جاري الحذف...' : 'حذف'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={formik.handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>الإعدادات العامة</CardTitle>
            <CardDescription>إدارة الإعدادات العامة لطريقة الدفع.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-md">
              <Label htmlFor="isEnabled" className="font-semibold">تفعيل الطريقة</Label>
              <Switch
                id="isEnabled"
                name="isEnabled"
                checked={formik.values.isEnabled}
                onCheckedChange={(checked) => formik.setFieldValue('isEnabled', checked)}
              />
            </div>
            {formik.errors.isEnabled && <p className="text-red-500 text-sm">{formik.errors.isEnabled}</p>}

            <div>
              <Label htmlFor="displayName">اسم العرض</Label>
              <Input
                id="displayName"
                name="displayName"
                value={formik.values.displayName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.displayName && formik.errors.displayName && <p className="text-red-500 text-sm">{formik.errors.displayName}</p>}
            </div>

            <div>
              <Label htmlFor="description">الوصف</Label>
              <Textarea
                id="description"
                name="description"
                value={formik.values.description || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.description && formik.errors.description && <p className="text-red-500 text-sm">{formik.errors.description}</p>}
            </div>

            <div>
              <Label htmlFor="sortOrder">ترتيب العرض</Label>
              <Input
                id="sortOrder"
                name="sortOrder"
                type="number"
                value={formik.values.sortOrder || ''}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.sortOrder && formik.errors.sortOrder && <p className="text-red-500 text-sm">{formik.errors.sortOrder}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>بيانات الاعتماد</CardTitle>
            <CardDescription>إدخال بيانات اعتماد معاملات الخاصة بك. يمكنك الحصول عليها من لوحة تحكم معاملات.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="merchantId">معرف التاجر (Merchant ID)</Label>
              <Input
                id="merchantId"
                name="configData.merchantId"
                value={formik.values.configData.merchantId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.configData?.merchantId && formik.errors.configData?.merchantId && <p className="text-red-500 text-sm">{formik.errors.configData.merchantId}</p>}
            </div>

            <div>
              <Label htmlFor="terminalId">معرف الجهاز (Terminal ID)</Label>
              <Input
                id="terminalId"
                name="configData.terminalId"
                value={formik.values.configData.terminalId}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.configData?.terminalId && formik.errors.configData?.terminalId && <p className="text-red-500 text-sm">{formik.errors.configData.terminalId}</p>}
            </div>

            <div className="relative">
              <Label htmlFor="secureKey">المفتاح السري (Secure Key)</Label>
              <div className="relative">
                <Input
                  id="secureKey"
                  name="configData.secureKey"
                  type={showSecureKey ? 'text' : 'password'}
                  value={formik.values.configData.secureKey}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowSecureKey(!showSecureKey)}
                  className="absolute inset-y-0 left-0 flex items-center px-3 text-gray-500"
                >
                  {showSecureKey ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {formik.touched.configData?.secureKey && formik.errors.configData?.secureKey && <p className="text-red-500 text-sm">{formik.errors.configData.secureKey}</p>}
            </div>

            <div className="flex items-center justify-between p-4 border rounded-md">
              <Label htmlFor="sandboxMode" className="font-semibold">تفعيل وضع الاختبار (Sandbox)</Label>
              <Switch
                id="sandboxMode"
                name="configData.sandboxMode"
                checked={formik.values.configData.sandboxMode}
                onCheckedChange={(checked) => formik.setFieldValue('configData.sandboxMode', checked)}
              />
            </div>
            {formik.touched.configData?.sandboxMode && formik.errors.configData?.sandboxMode && <p className="text-red-500 text-sm">{formik.errors.configData.sandboxMode}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardFooter className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'جاري الحفظ...' : (showCreateAlert ? 'إنشاء الإعدادات' : 'حفظ التغييرات')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
