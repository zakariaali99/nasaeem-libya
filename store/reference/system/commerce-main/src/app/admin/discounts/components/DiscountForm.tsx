"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { discountSchema } from "@/modules/discounts/types/discountTypes";
import { useFormik } from "formik";
import { Loader2, ArrowLeft, Save, Sparkles, Percent, Tag, ShieldCheck, Clock, Settings2, ShieldAlert, Plus, Trash2 } from "lucide-react";
import { MultiSelect } from "@/components/ui/multiselect";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const PREDEFINED_SEGMENTS = [
    "الكل", // All
    "العملاء الجدد", // New Customers
    "العملاء المخلصين", // Loyal Customers
    "عملاء VIP", // VIP Customers
    "العملاء المهددين بالمغادرة" // At Risk
];

export function DiscountForm({ initialData = null }: { initialData?: any }) {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [targetLoading, setTargetLoading] = useState(false);

    const [products, setProducts] = useState<any[]>([]);
    const [variants, setVariants] = useState<any[]>([]);
    const [cities, setCities] = useState<any[]>([]);
    const [regions, setRegions] = useState<any[]>([]);
    const [collections, setCollections] = useState<any[]>([]);

    const isEdit = !!initialData;

    const formik = useFormik({
        initialValues: initialData || {
            name: "",
            code: "",
            description: "",
            type: "fixed",
            target: "product",
            value: "",
            percentage: "",
            bogo: { buy: 1, get: 1 },
            tiered: [],
            deliveryDiscount: "",
            minOrderAmount: "",
            maxDiscountAmount: "",
            usageLimit: "",
            customerSegment: "",
            isActive: true,
            startDate: "",
            endDate: "",
            targetIds: [],
            cityIds: [],
            regionIds: [],
        },
        validate: (values: any) => {
            const result = discountSchema.safeParse({
                ...values,
                value: values.type === "fixed" && values.value ? Number(values.value) : undefined,
                percentage: values.type === "percentage" && values.percentage ? Number(values.percentage) : undefined,
            });

            const errors: Record<string, string> = {};
            if (!values.name || values.name.trim() === "") errors.name = "اسم العرض مطلوب";
            if (!values.type) errors.type = "نوع الخصم مطلوب";

            if (values.type === "fixed" && (!values.value || isNaN(Number(values.value)))) {
                errors.value = "قيمة الخصم مطلوبة";
            }
            if (values.type === "percentage" && (!values.percentage || isNaN(Number(values.percentage)))) {
                errors.percentage = "النسبة المئوية مطلوبة";
            }

            return errors;
        },
        onSubmit: async (values) => {
            setIsSubmitting(true);
            try {
                const payload = {
                    ...values,
                    value: values.type === "fixed" && values.value ? Number(values.value) : undefined,
                    percentage: values.type === "percentage" && values.percentage ? Number(values.percentage) : undefined,
                    deliveryDiscount: values.type === "delivery" && values.deliveryDiscount ? Number(values.deliveryDiscount) : undefined,
                    minOrderAmount: values.minOrderAmount ? Number(values.minOrderAmount) : undefined,
                    maxDiscountAmount: values.maxDiscountAmount ? Number(values.maxDiscountAmount) : undefined,
                    usageLimit: values.usageLimit ? Number(values.usageLimit) : undefined,
                    productIds: values.target === "product" ? values.targetIds : undefined,
                    variantIds: values.target === "variant" ? values.targetIds : undefined,
                    regionIds: values.target === "region" ? values.regionIds : undefined,
                    cityIds: values.target === "city" ? values.cityIds : undefined,
                    collectionIds: values.target === "collection" ? values.targetIds : undefined,
                    customerSegment: values.customerSegment === "الكل" ? undefined : values.customerSegment,
                };

                const url = isEdit ? `/api/discounts/${initialData.id}` : "/api/discounts";
                const method = isEdit ? "PUT" : "POST";

                const response = await fetch(url, {
                    method,
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || "فشل في حفظ الخصم");
                }

                toast.success(isEdit ? "تم تحديث الخصم بنجاح" : "تم إنشاء الخصم بنجاح");
                router.push("/admin/discounts");
            } catch (error: any) {
                toast.error(error.message || "حدث خطأ أثناء حفظ الخصم");
            } finally {
                setIsSubmitting(false);
            }
        },
    });

    useEffect(() => {
        async function fetchTargets() {
            setTargetLoading(true);
            try {
                if (formik.values.target === "product") {
                    const res = await fetch("/api/products");
                    const data = await res.json();
                    setProducts(data?.data?.data || []);
                } else if (formik.values.target === "variant") {
                    const res = await fetch("/api/variants");
                    const data = await res.json();
                    setVariants(data?.data?.data || []);
                } else if (formik.values.target === "city") {
                    const res = await fetch("/api/delivery/prices");
                    const data = await res.json();
                    setCities(data?.data?.cities || []);
                } else if (formik.values.target === "region") {
                    const res = await fetch("/api/delivery/prices");
                    const data = await res.json();
                    let allRegions: any[] = [];
                    (data?.data?.cities || []).forEach((city: any) => {
                        if (city.regions) allRegions = allRegions.concat(city.regions.map((r: any) => ({ ...r, cityName: city.name })));
                    });
                    setRegions(allRegions);
                } else if (formik.values.target === "collection") {
                    const res = await fetch("/api/collections?limit=1000");
                    const data = await res.json();
                    setCollections(data?.collections || []);
                }
            } finally {
                setTargetLoading(false);
            }
        }
        fetchTargets();
    }, [formik.values.target]);

    return (
        <form onSubmit={formik.handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href="/admin/discounts">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-bold">{isEdit ? "تعديل الخصم" : "إنشاء خصم جديد"}</h1>
                </div>
                <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
                    {isSubmitting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Save className="ml-2 h-4 w-4" />}
                    {isEdit ? "حفظ التغييرات" : "حفظ وإنشاء"}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Details */}
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Tag className="h-5 w-5 text-primary" />
                                المعلومات الأساسية
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>اسم الخصم (يظهر للعملاء) <span className="text-destructive">*</span></Label>
                                    <Input
                                        name="name"
                                        placeholder="مثل: عروض الصيف الخيالية"
                                        value={formik.values.name}
                                        onChange={formik.handleChange}
                                    />
                                    {formik.errors.name && <p className="text-sm text-destructive">{formik.errors.name as string}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label>رمز الكوبون (اختياري)</Label>
                                    <Input
                                        name="code"
                                        placeholder="مثل: SUMMER25"
                                        value={formik.values.code}
                                        onChange={formik.handleChange}
                                        className="font-mono"
                                    />
                                    <p className="text-xs text-muted-foreground">اتركه فارغاً إذا كان الخصم يطبق تلقائياً دون كوبون.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>وصف الخصم</Label>
                                <Textarea
                                    name="description"
                                    placeholder="وصف تفصيلي للخصم..."
                                    value={formik.values.description}
                                    onChange={formik.handleChange}
                                    className="resize-none"
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-primary" />
                                إعدادات القيمة والنوع
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>نوع الخصم <span className="text-destructive">*</span></Label>
                                    <select
                                        name="type"
                                        value={formik.values.type}
                                        onChange={(e) => {
                                            formik.handleChange(e);
                                            formik.setFieldValue("value", "");
                                            formik.setFieldValue("percentage", "");
                                        }}
                                        className="w-full flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="fixed">قيمة ثابتة</option>
                                        <option value="percentage">نسبة مئوية</option>
                                        <option value="bogo">اشتر واحصل (BOGO)</option>
                                        <option value="tiered">متدرج</option>
                                        <option value="delivery">توصيل</option>
                                    </select>
                                </div>

                                {formik.values.type === "fixed" && (
                                    <div className="space-y-2">
                                        <Label>قيمة الخصم (د.ل) <span className="text-destructive">*</span></Label>
                                        <Input name="value" type="number" value={formik.values.value} onChange={formik.handleChange} />
                                        {formik.errors.value && <p className="text-sm text-destructive">{formik.errors.value as string}</p>}
                                    </div>
                                )}
                                {formik.values.type === "percentage" && (
                                    <div className="space-y-2">
                                        <Label>النسبة المئوية (%) <span className="text-destructive">*</span></Label>
                                        <Input name="percentage" type="number" min="1" max="100" value={formik.values.percentage} onChange={formik.handleChange} />
                                        {formik.errors.percentage && <p className="text-sm text-destructive">{formik.errors.percentage as string}</p>}
                                    </div>
                                )}
                                {formik.values.type === "delivery" && (
                                    <div className="space-y-2">
                                        <Label>قيمة خصم التوصيل (د.ل) <span className="text-destructive">*</span></Label>
                                        <Input name="deliveryDiscount" type="number" value={formik.values.deliveryDiscount} onChange={formik.handleChange} />
                                    </div>
                                )}
                            </div>

                            {formik.values.type === "bogo" && (
                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-4">
                                    <p className="text-sm font-medium text-primary">إعدادات اشتر واحصل (BOGO)</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>اشتري كم قطعة؟</Label>
                                            <Input type="number" min="1" value={formik.values.bogo?.buy ?? 1} onChange={(e) => formik.setFieldValue("bogo", { ...formik.values.bogo, buy: Number(e.target.value) })} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>احصل على كم قطعة؟</Label>
                                            <Input type="number" min="1" value={formik.values.bogo?.get ?? 1} onChange={(e) => formik.setFieldValue("bogo", { ...formik.values.bogo, get: Number(e.target.value) })} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>طريقة الخصم على القطعة المكتسبة</Label>
                                        <select
                                            value={formik.values.bogo?.discountType ?? "free"}
                                            onChange={(e) => formik.setFieldValue("bogo", {
                                                ...formik.values.bogo,
                                                discountType: e.target.value,
                                                free: e.target.value === "free",
                                                discountValue: e.target.value === "free" ? undefined : (formik.values.bogo?.discountValue ?? ""),
                                            })}
                                            className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                        >
                                            <option value="free">مجاناً (مجاني بالكامل)</option>
                                            <option value="percentage">خصم بنسبة مئوية</option>
                                            <option value="fixed">خصم بقيمة ثابتة</option>
                                        </select>
                                    </div>
                                    {formik.values.bogo?.discountType === "percentage" && (
                                        <div className="space-y-2">
                                            <Label>نسبة الخصم على القطعة المكتسبة (%)</Label>
                                            <Input type="number" min="1" max="100" placeholder="مثلاً: 50 يعني نصف السعر" value={formik.values.bogo?.discountValue ?? ""} onChange={(e) => formik.setFieldValue("bogo", { ...formik.values.bogo, discountValue: Number(e.target.value) })} />
                                        </div>
                                    )}
                                    {formik.values.bogo?.discountType === "fixed" && (
                                        <div className="space-y-2">
                                            <Label>قيمة الخصم الثابتة على القطعة المكتسبة (د.ل)</Label>
                                            <Input type="number" min="0" placeholder="مثلاً: 10 يعني خصم 10 دينار" value={formik.values.bogo?.discountValue ?? ""} onChange={(e) => formik.setFieldValue("bogo", { ...formik.values.bogo, discountValue: Number(e.target.value) })} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {formik.values.type === "tiered" && (
                                <div className="p-4 bg-amber-50/50 rounded-lg border border-amber-200 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-amber-800">مستويات الخصم المتدرج</p>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="border-amber-300 text-amber-700 hover:bg-amber-100"
                                            onClick={() => {
                                                const current = formik.values.tiered || [];
                                                formik.setFieldValue("tiered", [...current, { minQty: 1, discount: 5 }]);
                                            }}
                                        >
                                            <Plus className="ml-1 h-4 w-4" /> إضافة مستوى
                                        </Button>
                                    </div>
                                    <p className="text-xs text-amber-700">حدد أكثر من مستوى: كلما زادت الكمية، زاد الخصم. قيمة الخصم هي نسبة مئوية.</p>
                                    {(!formik.values.tiered || formik.values.tiered.length === 0) && (
                                        <p className="text-center text-sm text-gray-400 py-4">لم يتم إضافة أي مستويات بعد. اضغط "إضافة مستوى" للبدء.</p>
                                    )}
                                    <div className="space-y-3">
                                        {(formik.values.tiered || []).map((tier: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-lg border border-amber-100">
                                                <span className="text-xs text-amber-700 font-bold min-w-[60px]">مستوى {idx + 1}</span>
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">الحد الأدنى للكمية</Label>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        value={tier.minQty}
                                                        onChange={(e) => {
                                                            const updated = [...formik.values.tiered];
                                                            updated[idx] = { ...updated[idx], minQty: Number(e.target.value) };
                                                            formik.setFieldValue("tiered", updated);
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">نسبة الخصم (%)</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        value={tier.discount}
                                                        onChange={(e) => {
                                                            const updated = [...formik.values.tiered];
                                                            updated[idx] = { ...updated[idx], discount: Number(e.target.value) };
                                                            formik.setFieldValue("tiered", updated);
                                                        }}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="icon"
                                                    variant="ghost"
                                                    className="text-red-500 hover:bg-red-50 h-8 w-8 mt-5"
                                                    onClick={() => {
                                                        const updated = formik.values.tiered.filter((_: any, i: number) => i !== idx);
                                                        formik.setFieldValue("tiered", updated);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-primary" />
                                شروط الاستخدام والحدود
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>تطبيق على شريحة عملاء محددة</Label>
                                    <select
                                        name="customerSegment"
                                        value={formik.values.customerSegment}
                                        onChange={formik.handleChange}
                                        className="w-full flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                    >
                                        <option value="">لا تحديد (الكل)</option>
                                        {PREDEFINED_SEGMENTS.map(seg => (
                                            <option key={seg} value={seg}>{seg}</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground">تحديد الشريحة التي يمكنها الاستفادة من الخصم.</p>
                                </div>

                                <div className="space-y-2">
                                    <Label>الحد الأقصى عدد مرات الاستخدام</Label>
                                    <Input name="usageLimit" type="number" placeholder="غير محدود" value={formik.values.usageLimit} onChange={formik.handleChange} />
                                </div>

                                <div className="space-y-2">
                                    <Label>الحد الأدنى لقيمة الطلب (د.ل)</Label>
                                    <Input name="minOrderAmount" type="number" placeholder="لا يوجد" value={formik.values.minOrderAmount} onChange={formik.handleChange} />
                                </div>

                                {formik.values.type === "percentage" && (
                                    <div className="space-y-2">
                                        <Label>الحد الأقصى للخصم (د.ل)</Label>
                                        <Input name="maxDiscountAmount" type="number" placeholder="لا يوجد" value={formik.values.maxDiscountAmount} onChange={formik.handleChange} />
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Status & Targets */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                الحالة والجدولة
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border">
                                <div className="space-y-0.5">
                                    <Label className="text-base">تفعيل الخصم</Label>
                                    <p className="text-sm text-muted-foreground">هل الخصم متاح للاستخدام فوراً؟</p>
                                </div>
                                <Switch
                                    checked={formik.values.isActive}
                                    onCheckedChange={(v) => formik.setFieldValue("isActive", v)}
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>تاريخ البداية (اختياري)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={formik.values.startDate ? new Date(formik.values.startDate).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => formik.setFieldValue("startDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>تاريخ الانتهاء (اختياري)</Label>
                                    <Input
                                        type="datetime-local"
                                        value={formik.values.endDate ? new Date(formik.values.endDate).toISOString().slice(0, 16) : ""}
                                        onChange={(e) => formik.setFieldValue("endDate", e.target.value ? new Date(e.target.value).toISOString() : "")}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                الهدف للاستخدام
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>على ماذا يطبق الخصم؟</Label>
                                <select
                                    name="target"
                                    value={formik.values.target}
                                    onChange={formik.handleChange}
                                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <option value="order">طلب كامل</option>
                                    <option value="product">منتجات محددة</option>
                                    <option value="collection">مجموعات (تصنيفات)</option>
                                    <option value="city">مدن محددة</option>
                                    <option value="region">مناطق محددة</option>
                                    <option value="delivery">التوصيل بشكل عام</option>
                                </select>
                            </div>

                            {/* Dynamic Target Selection UI */}
                            {formik.values.target === "product" && (
                                <div className="space-y-2 mt-4 pt-4 border-t border-dashed">
                                    <Label>ابحث واختر المنتجات</Label>
                                    {targetLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                        <MultiSelect
                                            options={products.map((p) => ({ value: p.id, label: p.name }))}
                                            value={formik.values.targetIds}
                                            onChange={(vals) => formik.setFieldValue("targetIds", vals)}
                                            placeholder="اختر منتجاً..."
                                        />
                                    )}
                                </div>
                            )}

                            {formik.values.target === "collection" && (
                                <div className="space-y-2 mt-4 pt-4 border-t border-dashed">
                                    <Label>اختر المجموعات</Label>
                                    {targetLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                        <MultiSelect
                                            options={collections.map((c) => ({ value: c.id, label: c.name }))}
                                            value={formik.values.targetIds}
                                            onChange={(vals) => formik.setFieldValue("targetIds", vals)}
                                            placeholder="اختر مجموعة..."
                                        />
                                    )}
                                </div>
                            )}

                            {formik.values.target === "city" && (
                                <div className="space-y-2 mt-4 pt-4 border-t border-dashed">
                                    <Label>اختر المدن</Label>
                                    {targetLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                        <MultiSelect
                                            options={cities.map((c) => ({ value: c.id, label: c.name }))}
                                            value={formik.values.cityIds}
                                            onChange={(vals) => formik.setFieldValue("cityIds", vals)}
                                            placeholder="اختر المدن..."
                                        />
                                    )}
                                </div>
                            )}

                            {formik.values.target === "region" && (
                                <div className="space-y-2 mt-4 pt-4 border-t border-dashed">
                                    <Label>اختر المناطق</Label>
                                    {targetLoading ? <Loader2 className="animate-spin h-5 w-5" /> : (
                                        <MultiSelect
                                            options={regions.map((r) => ({ value: r.id, label: `${r.cityName} - ${r.name}` }))}
                                            value={formik.values.regionIds}
                                            onChange={(vals) => formik.setFieldValue("regionIds", vals)}
                                            placeholder="اختر المناطق..."
                                        />
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </form>
    );
}
