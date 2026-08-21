'use client';

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { PaymentMethodCode } from "@/modules/payments/types/paymentTypes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronRight, ExternalLink, Eye, EyeOff, Loader2, Save, Trash2 } from "lucide-react";

const PLUTU_CHANNEL_ICONS: Record<string, string> = {
  "configData.enableSadadApi": "/sadad.png",
  "configData.enableEdFali": "/Edfali.png",
  "configData.enableMpgs": "/mastercard.svg",
  "configData.enableTlync": "/t-lync.png",
  "configData.enableLocalCards": "/moamalat.svg",
};

const PlutuConfigSchema = z.object({
  displayName: z.string({ required_error: "اسم العرض مطلوب" }),
  description: z.string().nullable().optional(),
  isEnabled: z.boolean(),
  sortOrder: z.number().nullable().default(5),
  configData: z.object({
    apiKey: z.string({ required_error: "مفتاح API مطلوب" }),
    accessToken: z.string({ required_error: "رمز الوصول مطلوب" }),
    secretKey: z.string({ required_error: "المفتاح السري مطلوب" }),
    apiSecret: z.string().optional(),
    sandboxMode: z.boolean().default(true),
    enableSadadApi: z.boolean().default(false),
    enableEdFali: z.boolean().default(false),
    enableMpgs: z.boolean().default(false),
    enableTlync: z.boolean().default(false),
    enableLocalCards: z.boolean().default(false),
  }),
});

export default function PlutuConfigPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: paymentMethod, isLoading, error } = useQuery({
    queryKey: ['payment-method', PaymentMethodCode.PLUTU],
    queryFn: async () => {
      const response = await fetch(`/api/payment_methods/${PaymentMethodCode.PLUTU}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'فشل في جلب تفاصيل طريقة الدفع');
      }
      return response.json();
    },
  });

  const formik = useFormik({
    initialValues: {
      displayName: '',
      description: '',
      isEnabled: false,
      sortOrder: 5,
      configData: {
        apiKey: '',
        accessToken: '',
        secretKey: '',
        apiSecret: '',
        sandboxMode: true,
        enableSadadApi: false,
        enableEdFali: false,
        enableMpgs: false,
        enableTlync: false,
        enableLocalCards: false,
      },
    },
    validate: (values) => {
      const result = PlutuConfigSchema.safeParse(values);
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
        const response = await fetch(`/api/payment_methods/${PaymentMethodCode.PLUTU}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'فشل في تحديث طريقة الدفع');
        }
        toast(showCreateAlert ? 'تم إنشاء الإعدادات بنجاح' : 'تم تحديث الإعدادات بنجاح');
        queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.PLUTU] });
        queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      } catch (err: any) {
        toast.error(err.message || 'فشل في تحديث طريقة الدفع');
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (paymentMethod) {
      const configData = typeof paymentMethod.configData === 'string' ? JSON.parse(paymentMethod.configData) : paymentMethod.configData;
      formik.setValues({
        displayName: paymentMethod.displayName,
        description: paymentMethod.description || '',
        isEnabled: paymentMethod.isEnabled,
        sortOrder: paymentMethod.sortOrder || 5,
        configData: {
          apiKey: configData.apiKey || '',
          accessToken: configData.accessToken || '',
          secretKey: configData.secretKey || '',
          apiSecret: configData.apiSecret || '',
          sandboxMode: configData.sandboxMode !== undefined ? !!configData.sandboxMode : true,
          enableSadadApi: !!configData.enableSadadApi,
          enableEdFali: !!configData.enableEdFali,
          enableMpgs: !!configData.enableMpgs,
          enableTlync: !!configData.enableTlync,
          enableLocalCards: !!configData.enableLocalCards,
        },
      });
    }
  }, [paymentMethod]);

  const handleDelete = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/payment_methods/${PaymentMethodCode.PLUTU}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'فشل في حذف طريقة الدفع');
      }
      toast('تم حذف طريقة الدفع بنجاح');
      queryClient.invalidateQueries({ queryKey: ['payment-method', PaymentMethodCode.PLUTU] });
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      router.push('/admin/payment_methods');
    } catch (err: any) {
      toast.error(err.message || 'فشل في حذف طريقة الدفع');
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
          <h2 className="text-xl font-semibold mb-2">جاري تحميل إعدادات بلوتو...</h2>
        </div>
      </div>
    );
  }

  if (error && !showCreateAlert) {
    return (
      <div className="container p-6 mx-auto" dir="rtl">
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>
            حدث خطأ أثناء تحميل إعدادات بلوتو. يرجى المحاولة مرة أخرى.
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
            🚀 مرحباً بك! لا توجد إعدادات مُكونة حالياً لطريقة الدفع هذه. املأ النموذج أدناه لإنشاء إعدادات جديدة لبوابة بلوتو.
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
            {showCreateAlert ? 'إنشاء إعدادات بلوتو (Pluto)' : 'تعديل إعدادات بلوتو (Pluto)'}
          </h1>
          {showCreateAlert && (
            <p className="text-sm text-muted-foreground mt-1">
              قم بتكوين بيانات الاتصال وتفعيل القنوات المتاحة من بلوتو مثل سداد، إدفعلي، MPGS، Tlync والبطاقات المحلية.
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
            <p className="mb-4">هل أنت متأكد أنك تريد حذف إعدادات بلوتو؟ لا يمكن التراجع عن هذا الإجراء.</p>
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

      <form onSubmit={formik.handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>المعلومات الأساسية</CardTitle>
            <CardDescription>البيانات العامة لعرض بلوتو للعملاء</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">اسم العرض (يظهر للعملاء)</Label>
              <Input id="displayName" name="displayName" value={formik.values.displayName} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              {formik.touched.displayName && formik.errors.displayName && (
                <p className="text-sm text-red-500">{formik.errors.displayName as string}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">وصف طريقة الدفع (اختياري)</Label>
              <Input id="description" name="description" value={formik.values.description || ''} onChange={formik.handleChange} onBlur={formik.handleBlur} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">ترتيب العرض</Label>
              <Input id="sortOrder" name="sortOrder" type="number" value={formik.values.sortOrder || 0} onChange={formik.handleChange} onBlur={formik.handleBlur} />
            </div>

            <div className="flex items-center space-x-2 justify-end">
              <Switch id="isEnabled" name="isEnabled" checked={formik.values.isEnabled} onCheckedChange={(checked) => formik.setFieldValue('isEnabled', checked)} />
              <Label htmlFor="isEnabled" className="mr-2">تفعيل طريقة الدفع</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>بيانات API</CardTitle>
            <CardDescription>الاعتمادات العامة الموحدة لكل قنوات بلوتو</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="configData.apiKey">مفتاح API <span className="text-red-500">*</span></Label>
              <Input id="configData.apiKey" name="configData.apiKey" value={formik.values.configData.apiKey} onChange={formik.handleChange} onBlur={formik.handleBlur} />
              {formik.touched.configData?.apiKey && (formik.errors.configData as any)?.apiKey && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).apiKey}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="configData.accessToken">Access Token <span className="text-red-500">*</span></Label>
              <Input
                id="configData.accessToken"
                name="configData.accessToken"
                type={showSecret ? 'text' : 'password'}
                value={formik.values.configData.accessToken}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
              />
              {formik.touched.configData?.accessToken && (formik.errors.configData as any)?.accessToken && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).accessToken}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="configData.secretKey">المفتاح السري <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Input
                  id="configData.secretKey"
                  name="configData.secretKey"
                  type={showSecret ? 'text' : 'password'}
                  value={formik.values.configData.secretKey}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute inset-y-0 left-2 my-auto h-8 w-8"
                  onClick={() => setShowSecret((prev) => !prev)}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {formik.touched.configData?.secretKey && (formik.errors.configData as any)?.secretKey && (
                <p className="text-sm text-red-500">{(formik.errors.configData as any).secretKey}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="configData.apiSecret">API Secret (اختياري للقنوات الدولية)</Label>
              <Input
                id="configData.apiSecret"
                name="configData.apiSecret"
                type={showSecret ? 'text' : 'password'}
                value={formik.values.configData.apiSecret}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                placeholder="مطلوب فقط لـ MPGS / Tlync / البطاقات المحلية"
              />
              <p className="text-xs text-muted-foreground">استخدمه فقط إذا وفّرته بلوتو لهذه القنوات.</p>
            </div>

            <div className="flex items-center justify-end space-x-2">
              <Switch
                id="configData.sandboxMode"
                name="configData.sandboxMode"
                checked={formik.values.configData.sandboxMode}
                onCheckedChange={(checked) => formik.setFieldValue('configData.sandboxMode', checked)}
              />
              <Label htmlFor="configData.sandboxMode" className="mr-2">تفعيل وضع الاختبار</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>القنوات المتاحة داخل بلوتو</CardTitle>
            <CardDescription>قم بتفعيل قنوات الدفع التي ترغب في إتاحتها</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ToggleRow
              id="configData.enableSadadApi"
              label="تفعيل سداد API"
              iconSrc={PLUTU_CHANNEL_ICONS["configData.enableSadadApi"]}
              checked={formik.values.configData.enableSadadApi}
              onCheckedChange={(checked) => formik.setFieldValue('configData.enableSadadApi', checked)}
            />
            <ToggleRow
              id="configData.enableEdFali"
              label="تفعيل إدفعلي"
              iconSrc={PLUTU_CHANNEL_ICONS["configData.enableEdFali"]}
              checked={formik.values.configData.enableEdFali}
              onCheckedChange={(checked) => formik.setFieldValue('configData.enableEdFali', checked)}
            />
            <ToggleRow
              id="configData.enableMpgs"
              label="تفعيل MPGS"
              iconSrc={PLUTU_CHANNEL_ICONS["configData.enableMpgs"]}
              checked={formik.values.configData.enableMpgs}
              onCheckedChange={(checked) => formik.setFieldValue('configData.enableMpgs', checked)}
            />
            <ToggleRow
              id="configData.enableTlync"
              label="تفعيل Tlync"
              iconSrc={PLUTU_CHANNEL_ICONS["configData.enableTlync"]}
              checked={formik.values.configData.enableTlync}
              onCheckedChange={(checked) => formik.setFieldValue('configData.enableTlync', checked)}
            />
            <ToggleRow
              id="configData.enableLocalCards"
              label="تفعيل البطاقات المحلية"
              iconSrc={PLUTU_CHANNEL_ICONS["configData.enableLocalCards"]}
              checked={formik.values.configData.enableLocalCards}
              onCheckedChange={(checked) => formik.setFieldValue('configData.enableLocalCards', checked)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>روابط التوثيق</CardTitle>
            <CardDescription>اطلع على توثيق Plutu الرسمي للتكامل التفصيلي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="https://plutopay.co" target="_blank" className="flex items-center text-primary">
              <ExternalLink className="h-4 w-4 ml-2" />
              موقع Plutu الرسمي
            </Link>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
            حفظ الإعدادات
          </Button>
        </div>
      </form>
    </div>
  );
}

function ToggleRow({ id, label, checked, onCheckedChange, iconSrc }: { id: string; label: string; checked: boolean; onCheckedChange: (v: boolean) => void; iconSrc?: string; }) {
  return (
    <div className="flex items-center justify-between border rounded-lg p-3">
      <div className="flex items-center gap-2">
        {iconSrc ? (
          <img src={iconSrc} alt="أيقونة القناة" className="h-6 w-6 object-contain" aria-hidden="true" />
        ) : null}
        <Label htmlFor={id} className="font-medium">{label}</Label>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
