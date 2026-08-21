"use client";

import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormik } from "formik";
import * as z from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeliveryMethodCode, DeliveryMethodConfiguration } from "@/modules/delivery/types/deliveryTypes";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";

const DarbSabeelSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  isActive: z.boolean(),
  configuration: z.object({
    apiKey: z.string().min(1, "مفتاح الـ API مطلوب"),
    accountId: z.string().min(1, "معرف الحساب مطلوب"),
    serviceId: z.string().optional(),
    apiVersion: z.string().min(1, "إصدار الـ API مطلوب"),
    webhookSecret: z.string().min(1, "سر الويب هوك مطلوب"),
    baseUrl: z.string().optional(),
    defaultCurrency: z.string().optional(),
  }),
});

enum Mode {
  CREATE = "create",
  EDIT = "edit",
}

export default function DarbSabeelDeliveryConfigPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>(Mode.CREATE);
  const [configId, setConfigId] = useState<string | undefined>();
  const [showDelete, setShowDelete] = useState(false);

  const { data: configs } = useQuery<DeliveryMethodConfiguration[]>({
    queryKey: ["admin-delivery-methods"],
    queryFn: async () => {
      const res = await fetch("/api/delivery");
      if (!res.ok) throw new Error("فشل في جلب طرق التوصيل");
      const json = await res.json();
      return json.data as DeliveryMethodConfiguration[];
    },
  });

  const existing = configs?.find((c) => c.code === DeliveryMethodCode.DARB_SABEEL);

  const formik = useFormik({
    initialValues: {
      name: "درب السبيل",
      isActive: false,
      configuration: {
        apiKey: "",
        accountId: "",
        serviceId: "",
        apiVersion: "1.0.0",
        baseUrl: "https://v2.sabil.ly",
        defaultCurrency: "LYD",
        webhookSecret: "",
      },
    },
    enableReinitialize: true,
    validate: (values) => {
      const parsed = DarbSabeelSchema.safeParse(values);
      if (parsed.success) return {};
      const errors: any = {};
      parsed.error.issues.forEach((issue) => {
        if (issue.path.length > 1) {
          const [first, ...rest] = issue.path;
          errors[first] = errors[first] || {};
          let ref: any = errors[first];
          rest.forEach((seg, idx) => {
            if (idx === rest.length - 1) {
              ref[seg] = issue.message;
            } else {
              ref[seg] = ref[seg] || {};
              ref = ref[seg];
            }
          });
        } else {
          errors[issue.path[0]] = issue.message;
        }
      });
      return errors;
    },
    onSubmit: async (values) => {
      try {
        const body = {
          name: values.name,
          isActive: values.isActive,
          configuration: values.configuration,
        };

        let res: Response;
        if (mode === Mode.EDIT && configId) {
          res = await fetch(`/api/delivery/${configId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        } else {
          res = await fetch("/api/delivery", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              code: DeliveryMethodCode.DARB_SABEEL,
              name: values.name,
              configuration: values.configuration,
              isActive: values.isActive,
            }),
          });
        }

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || "فشل في الحفظ");
        }

        toast.success("تم الحفظ بنجاح");
        queryClient.invalidateQueries({ queryKey: ["admin-delivery-methods"] });
        router.push("/admin/delivery");
      } catch (error: any) {
        toast.error(error.message || "حدث خطأ غير متوقع");
      }
    },
  });

  const configErrors = (formik.errors.configuration ?? {}) as Record<string, string>;

  useEffect(() => {
    if (existing) {
      setMode(Mode.EDIT);
      setConfigId(existing.id);
      formik.setValues({
        name: existing.name,
        isActive: existing.isActive,
        configuration: {
          apiKey: (existing.configuration as any)?.apiKey ?? "",
          accountId: (existing.configuration as any)?.accountId ?? "",
          serviceId: (existing.configuration as any)?.serviceId ?? "",
          apiVersion: (existing.configuration as any)?.apiVersion ?? "1.0.0",
          baseUrl: (existing.configuration as any)?.baseUrl ?? "https://v2.sabil.ly",
          defaultCurrency: (existing.configuration as any)?.defaultCurrency ?? "LYD",
          webhookSecret: (existing.configuration as any)?.webhookSecret ?? "",
        },
      });
    }
  }, [existing]);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!configId) return;
      const res = await fetch(`/api/delivery/${configId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("فشل في الحذف");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-delivery-methods"] });
      router.push("/admin/delivery");
      toast.success("تم الحذف بنجاح");
    },
    onError: () => toast.error("حدث خطأ أثناء الحذف"),
  });

  return (
    <div dir="rtl" className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center mb-6">
        <Link href="/admin/delivery" className="flex items-center text-primary hover:underline">
          <ChevronRight className="w-4 h-4 ml-1" /> العودة
        </Link>
        <h1 className="text-3xl font-semibold text-gray-800 mr-2">إعدادات درب السبيل</h1>
      </div>

      {!existing && (
        <Alert className="mb-4">
          <AlertDescription>لا توجد إعدادات. يمكنك الإنشاء الآن.</AlertDescription>
        </Alert>
      )}

      <form onSubmit={formik.handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">البيانات العامة</CardTitle>
            <CardDescription>إدارة الاسم وتفعيل مزود درب السبيل</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name">اسم طريقة التوصيل</Label>
              <Input id="name" name="name" value={formik.values.name} onChange={formik.handleChange} />
              {formik.errors.name && <p className="text-red-500 text-sm mt-1">{formik.errors.name}</p>}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">مفعل</Label>
              <Switch
                id="isActive"
                checked={formik.values.isActive}
                onCheckedChange={(checked) => formik.setFieldValue("isActive", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>إعدادات الاتصال</CardTitle>
            <CardDescription>مفاتيح الربط مع درب السبيل</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="configuration.apiKey">مفتاح الـ API</Label>
              <Input
                id="configuration.apiKey"
                name="configuration.apiKey"
                type="text"
                value={formik.values.configuration.apiKey}
                onChange={formik.handleChange}
                placeholder="أدخل المفتاح"
              />
              {configErrors.apiKey && <p className="text-red-500 text-sm mt-1">{configErrors.apiKey}</p>}
            </div>
            <div>
              <Label htmlFor="configuration.accountId">معرف الحساب</Label>
              <Input
                id="configuration.accountId"
                name="configuration.accountId"
                type="text"
                value={formik.values.configuration.accountId}
                onChange={formik.handleChange}
                placeholder="مثال: 12345"
              />
              {configErrors.accountId && <p className="text-red-500 text-sm mt-1">{configErrors.accountId}</p>}
            </div>
            <div>
              <Label htmlFor="configuration.serviceId">معرف الخدمة</Label>
              <Input
                id="configuration.serviceId"
                name="configuration.serviceId"
                type="text"
                value={formik.values.configuration.serviceId}
                onChange={formik.handleChange}
                placeholder="أدخل معرف الخدمة"
              />
              {configErrors.serviceId && <p className="text-red-500 text-sm mt-1">{configErrors.serviceId}</p>}
            </div>
            <div>
              <Label htmlFor="configuration.apiVersion">إصدار الـ API</Label>
              <Input
                id="configuration.apiVersion"
                name="configuration.apiVersion"
                type="text"
                value={formik.values.configuration.apiVersion}
                onChange={formik.handleChange}
                placeholder="مثال: 1.0.0"
              />
              {configErrors.apiVersion && <p className="text-red-500 text-sm mt-1">{configErrors.apiVersion}</p>}
            </div>
            <div>
              <Label htmlFor="configuration.webhookSecret">سر الويب هوك</Label>
              <Input
                id="configuration.webhookSecret"
                name="configuration.webhookSecret"
                type="password"
                value={formik.values.configuration.webhookSecret}
                onChange={formik.handleChange}
                placeholder="أدخل السر للتحقق من التوقيع"
              />
              {configErrors.webhookSecret && <p className="text-red-500 text-sm mt-1">{configErrors.webhookSecret}</p>}
            </div>
            <div>
              <Label htmlFor="configuration.baseUrl">الرابط الأساسي</Label>
              <Input
                id="configuration.baseUrl"
                name="configuration.baseUrl"
                type="text"
                value={formik.values.configuration.baseUrl}
                onChange={formik.handleChange}
                placeholder="https://v2.sabil.ly"
              />
              {configErrors.baseUrl && <p className="text-red-500 text-sm mt-1">{configErrors.baseUrl}</p>}
            </div>
            <div>
              <Label htmlFor="configuration.defaultCurrency">العملة الافتراضية</Label>
              <Input
                id="configuration.defaultCurrency"
                name="configuration.defaultCurrency"
                type="text"
                value={formik.values.configuration.defaultCurrency}
                onChange={formik.handleChange}
                placeholder="LYD"
              />
              {configErrors.defaultCurrency && <p className="text-red-500 text-sm mt-1">{configErrors.defaultCurrency}</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <div className="flex gap-3">
            <Button type="submit" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? "جاري الحفظ..." : "حفظ"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/admin/delivery")}>إلغاء</Button>
          </div>
          {mode === Mode.EDIT && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> حذف
            </Button>
          )}
        </div>
      </form>

      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">تأكيد الحذف</h2>
            <p className="text-gray-600 mb-6">هل أنت متأكد من حذف إعدادات درب السبيل؟</p>
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={() => setShowDelete(false)}>إلغاء</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate();
                  setShowDelete(false);
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
