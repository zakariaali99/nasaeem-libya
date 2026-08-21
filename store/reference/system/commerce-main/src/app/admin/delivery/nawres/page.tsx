'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useFormik } from 'formik';
import * as z from 'zod';
import Link from 'next/link';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronRight, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { DeliveryMethodCode, DeliveryMethodConfiguration } from '@/modules/delivery/types/deliveryTypes';

const NawresConfigSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  isActive: z.boolean(),
  configuration: z.object({
    authentication_key: z.string().min(1, 'مفتاح المصادقة مطلوب'),
    main_client_code: z.string().min(1, 'كود المتجر الرئيسي مطلوب'),
  }),
});

enum Mode { CREATE = 'create', EDIT = 'edit' }

export default function NawresDeliveryConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(Mode.CREATE);
  const [configId, setConfigId] = useState<string | undefined>();
  const [showDelete, setShowDelete] = useState(false);

  // Fetch existing configs
  const { data: configs, isLoading } = useQuery<DeliveryMethodConfiguration[]>({
    queryKey: ['admin-delivery-methods'],
    queryFn: async () => {
      const res = await fetch('/api/delivery');
      if (!res.ok) throw new Error('فشل في جلب طرق التوصيل');
      const json = await res.json();
      return json.data as DeliveryMethodConfiguration[];
    },
  });

  const nawresConfig = configs?.find(c => c.code === DeliveryMethodCode.NAWRES);

  // Set mode and preload data for editing
  useEffect(() => {
    if (nawresConfig) {
      setMode(Mode.EDIT);
      setConfigId(nawresConfig.id);
      formik.setValues({
        name: nawresConfig.name,
        isActive: nawresConfig.isActive,
        configuration: nawresConfig.configuration as any
      });
    }
  }, [nawresConfig]);

  const formik = useFormik({
    initialValues: {
      name: '',
      isActive: false,
      configuration: {
        authentication_key: '',
        main_client_code: ''
      }
    },
    enableReinitialize: true,
    validate: values => {
      const result = NawresConfigSchema.safeParse(values);
      if (result.success) return {};
      
      const errors: any = {};
      result.error.issues.forEach(issue => {
        if (issue.path.length > 1) {
          const [first, ...rest] = issue.path;
          errors[first] = errors[first] || {};
          let nested: any = errors[first];
          rest.forEach((seg, idx) => {
            if (idx === rest.length - 1) {
              nested[seg] = issue.message;
            } else {
              nested[seg] = nested[seg] || {};
              nested = nested[seg];
            }
          });
        } else {
          errors[issue.path[0]] = issue.message;
        }
      });
      return errors;
    },
    onSubmit: async values => {
      try {
        const body = {
          name: values.name,
          isActive: values.isActive,
          configuration: values.configuration
        };

        let res;
        if (mode === Mode.EDIT && configId) {
          res = await fetch(`/api/delivery/${configId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
        } else {
          res = await fetch('/api/delivery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: DeliveryMethodCode.NAWRES,
              name: values.name,
              configuration: values.configuration
            })
          });
        }

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'فشل في الحفظ');
        }

        toast.success('تم الحفظ بنجاح');
        queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] });
        router.push('/admin/delivery');
      } catch (err: any) {
        toast.error(err.message || 'حدث خطأ');
      }
    },
  });

  // Get nested configuration errors
  const configErrors = (formik.errors.configuration ?? {}) as Record<string, string>;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!configId) return;
      const res = await fetch(`/api/delivery/${configId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل في الحذف');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] });
      router.push('/admin/delivery');
      toast.success('تم الحذف بنجاح');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء الحذف');
    }
  });

  // Step 2: Full configuration form
  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center mb-6">
        <Link href="/admin/delivery" className="flex items-center text-primary hover:underline">
          <ChevronRight className="w-4 h-4 ml-1" /> العودة
        </Link>
        <h1 className="text-3xl font-semibold text-gray-800 mr-2">إعدادات نوارس</h1>
      </div>

      {!nawresConfig && (
        <Alert className="mb-4">
          <AlertDescription>لا توجد إعدادات. يمكنك الإنشاء الآن.</AlertDescription>
        </Alert>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <img src="/nawres.svg" alt="نوارس" className="h-6 w-6" />
              الإعدادات العامة
            </CardTitle>
            <CardDescription>إعدادات طريقة التوصيل عبر نوارس</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">اسم طريقة التوصيل</Label>
              <Input
                id="name"
                name="name"
                value={formik.values.name}
                onChange={formik.handleChange}
                placeholder="مثال: توصيل نوارس"
              />
              {formik.errors.name && (
                <p className="text-red-500 text-sm mt-1">{formik.errors.name}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formik.values.isActive}
                onCheckedChange={(checked) => formik.setFieldValue('isActive', checked)}
              />
              <Label htmlFor="isActive">مفعل</Label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إعدادات الاتصال</CardTitle>
            <CardDescription>بيانات الاتصال مع خدمة نوارس</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6">
            <div>
              <Label htmlFor="configuration.authentication_key">مفتاح المصادقة</Label>
              <Input
                id="configuration.authentication_key"
                name="configuration.authentication_key"
                type="text"
                value={formik.values.configuration.authentication_key}
                onChange={formik.handleChange}
                placeholder="أدخل مفتاح المصادقة"
              />
              {configErrors.authentication_key && (
                <p className="text-red-500 text-sm mt-1">{configErrors.authentication_key}</p>
              )}
            </div>
            <div>
              <Label htmlFor="configuration.main_client_code">كود المتجر الرئيسي</Label>
              <Input
                id="configuration.main_client_code"
                name="configuration.main_client_code"
                type="text"
                value={formik.values.configuration.main_client_code}
                onChange={formik.handleChange}
                placeholder="أدخل كود المتجر الرئيسي"
              />
              {configErrors.main_client_code && (
                <p className="text-red-500 text-sm mt-1">{configErrors.main_client_code}</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <div className="flex gap-4">
            <Button type="submit" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/admin/delivery')}
            >
              إلغاء
            </Button>
          </div>
          {mode === Mode.EDIT && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="w-4 h-4 ml-2" />
              حذف
            </Button>
          )}
        </div>
      </form>

      {/* Delete confirmation modal */}
      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">تأكيد الحذف</h2>
            <p className="text-gray-600 mb-6">
              هل أنت متأكد من حذف إعدادات نوارس؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-4 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDelete(false)}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate();
                  setShowDelete(false);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'جاري الحذف...' : 'حذف'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
