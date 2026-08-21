'use client'
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Formik, Form, Field, useField } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import * as z from 'zod';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { TextBlockEditor } from '@/components/admin/customization/TextBlockComponents';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { createProductSchema } from '@/modules/variants/types/variantTypes';
import { ImageUpload } from '@/components/ui/image-upload';
import type { ProductImage } from '@/modules/images/types/imageTypes';
import { MultiSelect } from '@/components/ui/multiselect';

// Helper function for class names
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Simplified postProduct without image handling
async function postProduct(productData: any) {
    // Ensure price and compareAtPrice are numbers not strings
    const payload = {
        ...productData,
        price: productData.price !== undefined ? Number(productData.price) : undefined,
        compareAtPrice: productData.compareAtPrice ? Number(productData.compareAtPrice) : null,
    };

    console.log("Formatted product payload:", payload);

    const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'فشل في إنشاء المنتج');
    }

    return response.json();
}

// Simplified product schema
const productSchema = z.object({
    // Product fields
    name: createProductSchema.shape.name,
    slug: createProductSchema.shape.slug,
    description: createProductSchema.shape.description.nullable(),
    price: z.coerce.number().optional(),
    compareAtPrice: z.coerce.number().optional().nullable(),
    sku: createProductSchema.shape.sku.optional(),
    barcode: createProductSchema.shape.barcode.optional(),
    categoryId: createProductSchema.shape.categoryId.nullable(),
    categoryIds: z.array(z.string().uuid("معرف الفئة غير صالح")).optional().default([]),
    metaTitle: createProductSchema.shape.metaTitle.nullable(),
    metaDescription: createProductSchema.shape.metaDescription.nullable(),
    hasVariants: z.boolean().default(false),
    trackQuantity: z.boolean().default(false),
    width: z.coerce.number().min(0).optional(),
    length: z.coerce.number().min(0).optional(),
    height: z.coerce.number().min(0).optional(),
    weight: z.coerce.number().min(0).optional(),
    stock: z.coerce.number().int().min(0, "الكمية يجب أن تكون صفرًا أو أكثر").optional(),
    images: z.array(z.object({ id: z.string(), url: z.string(), altText: z.string().optional().nullable() })).optional().default([]),
})
.refine(
    (data) => {
        // If product has variants, we don't need price or quantity validation
        if (data.hasVariants) {
            return true;
        }
        // For products without variants, validate that price and quantity are present
        return data.price !== undefined && data.price > 0 && data.stock !== undefined;
    },
    {
        message: "السعر والكمية مطلوبان للمنتج بدون متغيرات",
        path: ["hasVariants"], // This ensures the error is associated with hasVariants toggle
    }
)
.superRefine((data, ctx) => {
    // Only validate price and inventoryQuantity if hasVariants is false
    if (!data.hasVariants) {
        if (data.price === undefined || data.price <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "السعر مطلوب للمنتج بدون متغيرات ويجب أن يكون رقماً موجباً",
                path: ["price"],
            });
        }

        if (data.stock === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "الكمية مطلوبة للمنتج بدون متغيرات.",
                path: ["stock"],
            });
        }
    }
});

type ProductInput = z.infer<typeof productSchema>;

// Initial values for the form
const initialValues: ProductInput = {
    name: '',
    slug: '',
    description: '',
    sku: '',
    barcode: '',
    categoryId: null,
    categoryIds: [],
    metaTitle: '',
    metaDescription: '',
    hasVariants: false,
    trackQuantity: false,
    width: undefined,
    length: undefined,
    height: undefined,
    weight: undefined,
    images: [],
    stock: undefined,
};

// Helper component for Formik fields with shadcn styling and explanations
const FormikField = ({ name, label, placeholder, type = 'text', explanation, as: Component = Input, className, ...props }: any) => {
    // Get field error status from Formik context
    const [field, meta] = useField(name);
    const hasError = meta.touched && meta.error;

    return (
        <div className="grid gap-2">
            <div className="flex items-center justify-between">
                <Label htmlFor={name} className={cn("flex items-center", hasError ? "text-destructive" : "")}>
                    {label}
                    {explanation && (
                        <TooltipProvider delayDuration={100}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Info className="h-4 w-4 text-muted-foreground cursor-help mr-2" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs z-50">
                                    <p>{explanation}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </Label>
            </div>
            <Field
                as={Component}
                id={name}
                type={type}
                placeholder={placeholder}
                className={cn(
                    "block w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    hasError
                        ? "border-destructive focus-visible:ring-destructive/50"
                        : "border-input",
                    Component === Input && "h-9",
                    Component === Textarea && "min-h-[80px] py-2",
                    className
                )}
                {...field}
                {...props}
            />
            {hasError ? (
                <div className="text-sm text-destructive flex items-center gap-1 pt-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>{meta.error}</span>
                </div>
            ) : null}
        </div>
    );
};

// Main component
export default function CreateProductPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Create a ref to scroll to error messages
    const errorRef = useRef<HTMLDivElement>(null);

    const { data: categoriesData, isLoading: categoriesLoading, isError: categoriesError } = useQuery({
        queryKey: ['categories', 'all'],
        queryFn: async () => {
            const res = await fetch('/api/categories?limit=500');
            if (!res.ok) {
                throw new Error('فشل في جلب الفئات');
            }
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });

    const categoryOptions = Array.isArray(categoriesData?.data?.data)
        ? categoriesData.data.data.map((cat: any) => ({ value: cat.id, label: cat.name }))
        : Array.isArray(categoriesData?.data)
            ? categoriesData.data.map((cat: any) => ({ value: cat.id, label: cat.name }))
            : [];

    const createProductMutation = useMutation({
        mutationFn: postProduct,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        },
        onError: (error: any) => {
            console.error("Product creation error:", error);
            setFormError(error.message || 'حدث خطأ أثناء إنشاء المنتج');
        }
    });

    const handleSubmit = async (values: ProductInput, { setSubmitting }: any) => {
        setFormError(null);
        setFormSuccess(null);
        setValidationErrors([]);
        setSubmitting(true);

        try {
            // Prepare product data
            const productPayload: any = {
                name: values.name,
                slug: values.slug,
                description: values.description || null,
                metaTitle: values.metaTitle || null,
                metaDescription: values.metaDescription || null,
                hasVariants: values.hasVariants,
                sku: values.sku || null,
                barcode: values.barcode || null,
                trackQuantity: values.trackQuantity,
                width: values.width,
                length: values.length,
                height: values.height,
                weight: values.weight,
                images: values.images.map(img => ({ url: img.url, altText: img.altText })) || [],
                stock: values.stock !== undefined ? values.stock : 0, // Default
            };

            const selectedCategoryIds = values.categoryIds || [];
            if (selectedCategoryIds.length > 0) {
                productPayload.categoryId = selectedCategoryIds[0]; // اختياري: فئة رئيسية إذا اختار المستخدم
            }

            // Add price/compareAtPrice only if NOT hasVariants
            if (!values.hasVariants) {
                if (values.price === undefined || values.price <= 0) {
                    throw new Error("السعر مطلوب للمنتج بدون متغيرات ويجب أن يكون رقماً موجباً.");
                }
                productPayload.price = values.price;
                productPayload.compareAtPrice = values.compareAtPrice || null;
            }

            console.log("Sending product payload:", productPayload);

            // Create the product
            const productResult = await createProductMutation.mutateAsync(productPayload);
            const productId = productResult.data.id;

            if (selectedCategoryIds.length) {
                await Promise.all(selectedCategoryIds.map(async (categoryId: string) => {
                    const assignRes = await fetch(`/api/categories/${categoryId}/products`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId }),
                    });

                    if (!assignRes.ok) {
                        const assignError = await assignRes.json();
                        throw new Error(assignError.message || 'تم إنشاء المنتج لكن فشل ربطه بالفئات المختارة');
                    }
                }));
            }

            console.log("Product created with ID:", productId);

            // Handle variants or single product inventory (default variant)
            if (values.hasVariants) {
                // Redirect to variants creation page
                setFormSuccess(`تم إنشاء المنتج "${values.name}" بنجاح! جاري الانتقال إلى صفحة إنشاء المتغيرات...`);
                setTimeout(() => {
                    router.push(`/admin/products/new/variants?productId=${productId}&productName=${encodeURIComponent(values.name)}`);
                }, 1000);
            } else {
                // Create a default variant for the non-variant product
                if (values.price === undefined || values.stock === undefined) {
                    throw new Error("السعر والكمية مطلوبان للمنتج بدون متغيرات.");
                }
                const defaultVariantPayload = {
                    productId: productId,
                    price: values.price,
                    compareAtPrice: values.compareAtPrice || null,
                    inventoryQuantity: values.stock,
                    sku: values.sku || null,
                    barcode: values.barcode || null,
                    isActive: true,
                };

                console.log("Sending default variant payload:", defaultVariantPayload);
                
                // Post default variant
                const response = await fetch('/api/variants', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(defaultVariantPayload),
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'فشل في إنشاء المتغير الافتراضي');
                }

                setFormSuccess(`تم إنشاء المنتج "${values.name}" بنجاح!`);
                queryClient.invalidateQueries({ queryKey: ['products'] });
                
                // Redirect to products list
                setTimeout(() => router.push('/admin/products'), 1500);
            }

        } catch (error: any) {
            console.error("Error creating product/variant:", error);
            const message = error.message || 'حدث خطأ غير متوقع.';
            setFormError(message);
            if (errorRef.current) {
                errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Function to generate slug
    const generateSlug = (name: string) => {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9ء-ي\s-]/g, '')
            .trim()
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    };

    return (
        <div dir="rtl" className="container mx-auto py-10 px-4">
            <h1 className="text-3xl font-bold mb-6">إنشاء منتج جديد</h1>
            <p className="text-muted-foreground mb-8">
                اتبع الخطوات التالية لإضافة منتج جديد إلى متجرك. الحقول المعلمة بـ * مطلوبة.
            </p>

            <Formik
                initialValues={initialValues}
                validationSchema={toFormikValidationSchema(productSchema)}
                onSubmit={handleSubmit}
                enableReinitialize
                validateOnMount={false}
                validateOnChange={true}
                validateOnBlur={true}
            >
                {({ values, isSubmitting, setFieldValue, setFieldTouched, errors, touched, dirty, isValid }) => (
                    <Form className="space-y-8">
                        {/* Basic Product Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>1. المعلومات الأساسية للمنتج</CardTitle>
                                <CardDescription>أدخل التفاصيل الرئيسية التي تعرف المنتج.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-2 gap-6">
                                <FormikField
                                    name="name"
                                    label="* اسم المنتج"
                                    placeholder="مثال: قميص قطني أبيض"
                                    explanation="اسم المنتج كما سيظهر للعملاء."
                                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                        const currentName = e.target.value;
                                        if (!values.slug || values.slug === generateSlug(values.name)) {
                                             const previousName = values.name;
                                             if (values.slug === generateSlug(previousName)) {
                                                 setFieldValue('slug', generateSlug(currentName));
                                             } else if (!values.slug) {
                                                  setFieldValue('slug', generateSlug(currentName));
                                             }
                                        }
                                        setFieldValue('name', currentName);
                                    }}
                                />
                                <FormikField
                                    name="slug"
                                    label="* المعرف الفريد (Slug)"
                                    placeholder="مثال: qamis-qotni-abyad"
                                    explanation="جزء من رابط المنتج (URL). يجب أن يكون فريداً ويحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط. يتم إنشاؤه تلقائياً من الاسم إذا ترك فارغاً."
                                />
                                <div className="md:col-span-2">
                                    <Label htmlFor="description" className="block mb-1">وصف المنتج</Label>
                                    <TextBlockEditor
                                        value={values.description || ''}
                                        onChange={(md: string) => setFieldValue('description', md)}
                                    />
                                    {dirty && errors.description && (
                                        <p className="text-sm text-destructive mt-1">{errors.description as string}</p>
                                    )}
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <Label className="block">الفئات</Label>
                                    {categoriesLoading ? (
                                        <p className="text-sm text-muted-foreground">جاري تحميل الفئات...</p>
                                    ) : categoriesError ? (
                                        <p className="text-sm text-destructive">تعذّر جلب الفئات، حاول مرة أخرى.</p>
                                    ) : (
                                        <MultiSelect
                                            options={categoryOptions}
                                            value={values.categoryIds || []}
                                            onChange={(vals) => {
                                                setFieldValue('categoryIds', vals);
                                                setFieldTouched('categoryIds', true, true);
                                            }}
                                            placeholder="ابحث أو اختر فئة (يمكن اختيار عدة فئات)"
                                            isMulti
                                            isSearchable
                                        />
                                    )}
                                    {touched.categoryIds && errors.categoryIds ? (
                                        <p className="text-sm text-destructive">{errors.categoryIds as string}</p>
                                    ) : null}
                                    <p className="text-xs text-muted-foreground">حدد فئة واحدة أو أكثر لربط المنتج بها مباشرة بعد إنشائه.</p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Product Images */}
                        <Card>
                          <CardHeader>
                            <CardTitle>2. صور المنتج</CardTitle>
                            <CardDescription>أضف صور للمنتج. الصورة الأولى ستكون الصورة الرئيسية.</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <ImageUpload
                              images={values.images as ProductImage[]}
                              onChange={(imgs) => setFieldValue('images', imgs)}
                              disabled={isSubmitting}
                            />
                          </CardContent>
                        </Card>

                        {/* Pricing and Inventory */}
                        <Card>
                            <CardHeader>
                                <CardTitle>3. التسعير والمخزون</CardTitle>
                                <CardDescription>حدد سعر المنتج وتفاصيل المخزون.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center space-x-2 space-x-reverse">
                                    <Field name="hasVariants">
                                        {({ field, form }: any) => (
                                            <Switch
                                                id="hasVariants"
                                                checked={field.value}
                                                onCheckedChange={(checked) => {
                                                    setFieldValue('hasVariants', checked);
                                                    if (!checked) {
                                                        // Clear variant related fields when switching off
                                                    } else {
                                                        // Clear base price/qty when switching on
                                                        setFieldValue('price', undefined);
                                                        setFieldValue('stock', undefined);
                                                        setFieldValue('compareAtPrice', undefined);
                                                    }
                                                    // Trigger validation immediately after changing hasVariants
                                                    setTimeout(() => {
                                                        form.validateForm().then(() => {
                                                            form.setTouched({ 
                                                                ...form.touched, 
                                                                hasVariants: true,
                                                                price: !checked ? true : form.touched.price,
                                                                stock: !checked ? true : form.touched.stock
                                                            });
                                                        });
                                                    }, 0);
                                                }}
                                                aria-readonly
                                            />
                                        )}
                                    </Field>
                                    <Label htmlFor="hasVariants" className="flex-grow cursor-pointer">هذا المنتج له متغيرات (مثل اللون، الحجم)</Label>
                                    <TooltipProvider delayDuration={100}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="max-w-xs z-50">
                                                <p>قم بتفعيل هذا الخيار إذا كان المنتج يأتي بخيارات مختلفة (مثل مقاسات أو ألوان مختلفة)، ولكل خيار سعره أو كميته الخاصة.</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>

                                <Separator />

                                {!values.hasVariants ? (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <FormikField
                                            name="price"
                                            label="* سعر البيع (دينار)"
                                            type="number"
                                            step="0.01"
                                            min="0.01"
                                            placeholder="100.00"
                                            explanation="السعر النهائي الذي سيدفعه العميل."
                                        />
                                        <FormikField
                                            name="compareAtPrice"
                                            label="السعر قبل الخصم (دينار)"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="120.00"
                                            explanation="السعر الأصلي للمنتج قبل أي تخفيض (اختياري). سيظهر مشطوباً بجانب سعر البيع."
                                        />
                                        <FormikField
                                            name="stock"
                                            label="* الكمية المتوفرة"
                                            type="number"
                                            min="0"
                                            step="1"
                                            placeholder="50"
                                            explanation="عدد القطع المتوفرة حالياً في المخزون."
                                        />
                                        <FormikField
                                            name="sku"
                                            label="SKU (رمز المخزون)"
                                            placeholder="قميص-ابيض-كبير"
                                            explanation="رمز فريد لتعريف المنتج في نظام المخزون الخاص بك (اختياري)."
                                        />
                                        <FormikField
                                            name="barcode"
                                            label="الباركود (ISBN, UPC, GTIN, etc.)"
                                            placeholder="123456789012"
                                            explanation="الرمز الشريطي للمنتج (اختياري)."
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-sm text-muted-foreground mb-4">
                                            بما أن المنتج له متغيرات، ستقوم بتحديد السعر والكمية لكل متغير في الخطوة التالية بعد حفظ المنتج الأساسي. يمكنك إضافة SKU أو باركود عام للمنتج هنا إذا أردت.
                                        </p>
                                         <div className="grid md:grid-cols-2 gap-6">
                                            <FormikField
                                                name="sku"
                                                label="SKU عام للمنتج (اختياري)"
                                                placeholder="قميص-ابيض"
                                                explanation="رمز مخزون عام للمنتج الأساسي. كل متغير يمكن أن يكون له SKU خاص به."
                                            />
                                            <FormikField
                                                name="barcode"
                                                label="باركود عام للمنتج (اختياري)"
                                                placeholder="123456789000"
                                                explanation="باركود عام للمنتج الأساسي."
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Logistics Settings */}
                        <Card>
                          <CardHeader>
                            <CardTitle>4. الإعدادات اللوجستية</CardTitle>
                            <CardDescription>حدد ما إذا كنت تريد تتبع الكمية وأدخل أبعاد المنتج ووزنه.</CardDescription>
                          </CardHeader>
                          <CardContent className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <Field name="trackQuantity">
                                {({ field }: any) => (
                                  <Switch
                                    id="trackQuantity"
                                    checked={field.value}
                                    onCheckedChange={(val) => setFieldValue('trackQuantity', val)}
                                  />
                                )}
                              </Field>
                              <Label htmlFor="trackQuantity" className="cursor-pointer">تتبع المخزون</Label>
                            </div>
                            <FormikField name="width" label="العرض (سم)" type="number" min="0" placeholder="0" explanation="العرض بالسنتيمتر" />
                            <FormikField name="length" label="الطول (سم)" type="number" min="0" placeholder="0" explanation="الطول بالسنتيمتر" />
                            <FormikField name="height" label="الارتفاع (سم)" type="number" min="0" placeholder="0" explanation="الارتفاع بالسنتيمتر" />
                            <FormikField name="weight" label="الوزن (كجم)" type="number" step="0.01" min="0" placeholder="0.00" explanation="الوزن بالكيلوغرام" />
                          </CardContent>
                        </Card>

                        {/* SEO Section */}
                        <Card>
                             <CardHeader>
                                <CardTitle>3. تحسين محركات البحث (SEO)</CardTitle>
                                <CardDescription>ساعد محركات البحث والعملاء في العثور على منتجك.</CardDescription>
                            </CardHeader>
                            <CardContent className="grid md:grid-cols-2 gap-6">
                                <FormikField
                                    name="metaTitle"
                                    label="عنوان SEO (Meta Title)"
                                    placeholder="عنوان جذاب يظهر في نتائج البحث"
                                    explanation="إذا ترك فارغاً، سيتم استخدام اسم المنتج. يفضل أن يكون أقل من 60 حرفاً."
                                />
                                <FormikField
                                    name="metaDescription"
                                    label="وصف SEO (Meta Description)"
                                    placeholder="وصف مختصر للمنتج يظهر في نتائج البحث"
                                    as={Textarea}
                                    rows={3}
                                    explanation="إذا ترك فارغاً، قد يتم استخدام جزء من وصف المنتج. يفضل أن يكون أقل من 160 حرفاً."
                                />
                            </CardContent>
                        </Card>

                        {/* Submit Button */}
                        <div className="flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={() => router.push('/admin/products')} disabled={isSubmitting}>
                                إلغاء
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !isValid}>
                                {isSubmitting ? 'جاري الحفظ...' : values.hasVariants ? 'حفظ والانتقال لإنشاء المتغيرات' : 'حفظ المنتج'}
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
}