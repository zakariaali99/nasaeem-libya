'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { DeliveryMethodCode, DeliveryMethodConfiguration } from '@/modules/delivery/types/deliveryTypes';
import { Card, CardHeader, CardContent, CardFooter, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { z } from 'zod';
import { useFormik } from 'formik';
import { toast } from 'sonner';
import { ChevronRight, Trash2 } from 'lucide-react';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';

const VanexConfigSchema = z.object({
  name: z.string().min(1, 'الاسم مطلوب'),
  isActive: z.boolean(),
  configuration: z.object({
    email: z.string().email('بريد إلكتروني غير صالح'),
    password: z.string().min(1, 'كلمة السر مطلوبة'),
    branchSubCityId: z.string().min(1, 'معرف منطقة الفرع مطلوب'),
  }),
});

enum Mode { CREATE = 'create', EDIT = 'edit' }

export default function VanexDeliveryConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(Mode.CREATE);
  const [configId, setConfigId] = useState<string | undefined>();
  const [showDelete, setShowDelete] = useState(false);
  // two-step creation state: step 1=credentials, 2=select branchSubCityId
  const [step, setStep] = useState<number>(mode === Mode.EDIT ? 2 : 1);
  const [cities, setCities] = useState<{ id: string; name: string }[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');

  // fetch existing configs for edit
  const { data: configs, isLoading } = useQuery<DeliveryMethodConfiguration[]>({
    queryKey: ['admin-delivery-methods'],
    queryFn: async () => {
      const res = await fetch('/api/delivery');
      if (!res.ok) throw new Error('فشل في جلب طرق التوصيل');
      const json = await res.json();
      return json.data as DeliveryMethodConfiguration[];
    },
  });

  const vanexConfig = configs?.find(c => c.code === DeliveryMethodCode.VANEX);
  // preload editing mode
  useEffect(() => {
    if (vanexConfig) {
      setMode(Mode.EDIT);
      setConfigId(vanexConfig.id);
      formik.setValues({ name: vanexConfig.name, isActive: vanexConfig.isActive, configuration: vanexConfig.configuration as any });
      setStep(2);
      loadAllCitiesAndRegions(vanexConfig.configuration.branchSubCityId as string);
    }
  }, [vanexConfig]);

  const formik = useFormik({
    initialValues: { name: '', isActive: false, configuration: { email: '', password: '', branchSubCityId: '' } },
    enableReinitialize: true,
    validate: values => {
      const result = VanexConfigSchema.safeParse(values);
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
        const body = { name: values.name, isActive: values.isActive, configuration: values.configuration };
        let res;
        if (mode === Mode.EDIT && configId) {
          res = await fetch(`/api/delivery/${configId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } else {
          res = await fetch('/api/delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: DeliveryMethodCode.VANEX, name: values.name, configuration: values.configuration }) });
        }
        if (!res.ok) throw new Error((await res.json()).message || 'فشل في الحفظ');
        toast.success('تم الحفظ بنجاح');
        queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] });
        router.push('/admin/delivery');
      } catch (err: any) {
        toast.error(err.message || 'حدث خطأ');
      }
    },
  });
  // nested config errors
  const configErrors = (formik.errors.configuration ?? {}) as Record<string, string>;

  // load all cities and regions for edit
  async function loadAllCitiesAndRegions(regionId: string) {
    const citiesList = await fetchCities();
    setCities(citiesList);
    for (const city of citiesList) {
      const regs = await fetchRegions(city.id);
      if (regs.find(r => r.id === regionId)) {
        setSelectedCity(city.id);
        setRegions(regs);
        break;
      }
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!configId) return;
      const res = await fetch(`/api/delivery/${configId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('فشل في الحذف');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] });
      router.push('/admin/delivery');
    }
  });

  // backend API loaders
  async function fetchCities() {
    const res = await fetch('/api/delivery/cities');
    if (!res.ok) throw new Error('فشل في جلب المدن');
    const json = await res.json();
    return json.data as Array<{ id: string; name: string }>;
  }
  async function fetchRegions(cityId: string) {
    const res = await fetch(`/api/delivery/cities/${cityId}/regions`);
    if (!res.ok) throw new Error('فشل في جلب المناطق');
    const json = await res.json();
    return json.data as Array<{ id: string; name: string }>;
  }

  // Step 1: CREATION MODE credentials saved via backend
  if (!vanexConfig && step === 1) {
    return (
      <div className="container p-6 mx-auto" dir="rtl">
        <h1 className="text-2xl font-bold mb-4">إعدادات ڤانيكس - الخطوة 1</h1>
        <div className="space-y-4">
          <div>
            <Label htmlFor="configuration.email">البريد الإلكتروني</Label>
            <Input id="configuration.email" name="configuration.email" type="email" value={formik.values.configuration.email} onChange={formik.handleChange} />
            {configErrors.email && <p className="text-red-600 text-sm">{configErrors.email}</p>}
          </div>
          <div>
            <Label htmlFor="configuration.password">كلمة السر</Label>
            <Input id="configuration.password" name="configuration.password" type="password" value={formik.values.configuration.password} onChange={formik.handleChange} />
            {configErrors.password && <p className="text-red-600 text-sm">{configErrors.password}</p>}
          </div>
          <Button onClick={async () => {
            try {
              // save credentials config
              const res = await fetch('/api/delivery', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: DeliveryMethodCode.VANEX, name: 'ڤانيكس', configuration: { email: formik.values.configuration.email, password: formik.values.configuration.password } })
              });
              if (!res.ok) throw new Error('فشل في حفظ الإعدادات');
              const json = await res.json();
              setConfigId(json.data.id);
              setMode(Mode.EDIT);
              queryClient.invalidateQueries({ queryKey: ['admin-delivery-methods'] });
              // load cities
              const cityList = await fetchCities();
              setCities(cityList);
              setStep(2);
            } catch (err: any) { toast.error(err.message);}  
          }}>التالي</Button>
        </div>
      </div>
    );
  }

  // Step 2: CREATION MODE branch selection & full form
  if (!vanexConfig && step === 2) {
    return (
      <div dir="rtl" className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center mb-4">
          <Link href="/admin/delivery" className="flex items-center text-primary hover:underline">
            <ChevronRight className="w-4 h-4 ml-1" /> العودة
          </Link>
          <h1 className="text-3xl font-semibold text-gray-800 mr-2">إعدادات ڤانيكس</h1>
        </div>
        <form onSubmit={formik.handleSubmit} className="space-y-8">
          <Card>
            <CardHeader><CardTitle>البيانات العامة</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* الاسم and مفعل fields */}
              <div>
                <Label htmlFor="name">الاسم</Label>
                <Input id="name" name="name" value={formik.values.name} onChange={formik.handleChange} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">مفعل</Label>
                <Switch id="isActive" checked={formik.values.isActive} onCheckedChange={val => formik.setFieldValue('isActive', val)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>تحديد الفرع</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* المدينة and المنطقة fields */}
              <div>
                <Label>المدينة</Label>
                <Select value={selectedCity} onValueChange={async (val) => {
                  setSelectedCity(val);
                  const regList = await fetchRegions(val);
                  setRegions(regList);
                  formik.setFieldValue('configuration.branchSubCityId', '');
                }}>
                  <SelectTrigger><SelectValue placeholder="اختر المدينة"/></SelectTrigger>
                  <SelectContent>
                    {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المنطقة</Label>
                <Select value={formik.values.configuration.branchSubCityId||''} onValueChange={val => formik.setFieldValue('configuration.branchSubCityId', val)}>
                  <SelectTrigger><SelectValue placeholder="اختر المنطقة"/></SelectTrigger>
                  <SelectContent>
                    {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {configErrors.branchSubCityId && <p className="text-red-600 text-sm">{configErrors.branchSubCityId}</p>}
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-end items-center gap-4">
              {vanexConfig && <Button variant="destructive" className="w-full sm:w-auto" onClick={() => setShowDelete(true)}>حذف</Button>}
              <Button type="submit" className="w-full sm:w-auto">حفظ</Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    );
  }

  // EDIT mode
  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center mb-6">
        <Link href="/admin/delivery" className="flex items-center text-primary hover:underline">
          <ChevronRight className="w-4 h-4 ml-1" /> العودة
        </Link>
        <h1 className="text-3xl font-semibold text-gray-800 mr-2">إعدادات ڤانيكس</h1>
      </div>
      {!vanexConfig && (
        <Alert className="mb-4">
          <AlertDescription>لا توجد إعدادات. يمكنك الإنشاء الآن.</AlertDescription>
        </Alert>
      )}
      <form onSubmit={formik.handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">البيانات العامة</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">الاسم</Label>
              <Input id="name" name="name" value={formik.values.name} onChange={formik.handleChange} />
              {formik.errors.name && <p className="text-red-600 text-sm">{formik.errors.name}</p>}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">مفعل</Label>
              <Switch id="isActive" checked={formik.values.isActive} onCheckedChange={val => formik.setFieldValue('isActive', val)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">تحديد الفرع</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label>المدينة</Label>
              <Select value={selectedCity} onValueChange={async val => {
                setSelectedCity(val);
                const regs = await fetchRegions(val);
                setRegions(regs);
              }}>
                <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                <SelectContent>
                  {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>المنطقة</Label>
              <Select value={formik.values.configuration.branchSubCityId || ''} onValueChange={val => formik.setFieldValue('configuration.branchSubCityId', val)}>
                <SelectTrigger><SelectValue placeholder="اختر المنطقة" /></SelectTrigger>
                <SelectContent>
                  {regions.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {configErrors.branchSubCityId && <p className="text-red-600 text-sm">{configErrors.branchSubCityId}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button type="submit">حفظ التغييرات</Button>
          </CardFooter>
        </Card>
      </form>
      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <p className="mb-4">هل أنت متأكد من حذف إعدادات ڤانيكس؟</p>
            <div className="flex justify-end gap-4">
              <Button variant="outline" onClick={() => setShowDelete(false)}>إلغاء</Button>
              <Button variant="destructive" onClick={() => deleteMutation.mutate()}>حذف</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
