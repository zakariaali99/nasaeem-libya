'use client'
import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Formik, Form, Field, FieldArray, useField } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import * as z from 'zod';
import { twMerge } from 'tailwind-merge';
import { clsx, type ClassValue } from 'clsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, CheckCircle, Info, PlusCircle, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import {
    createProductVariantSchema,
    VariantOptionValue
} from '@/modules/variants/types/variantTypes';
import { ImageUpload } from '@/components/ui/image-upload';
import type { ProductImage } from '@/modules/images/types/imageTypes';

// Define schema for product options and option values
const productOptionSchema = z.object({
    name: z.string().min(1, "اسم الخيار مطلوب"),
    values: z.array(z.string().min(1, "قيمة الخيار مطلوبة")).min(1, "يجب إضافة قيمة واحدة على الأقل")
});

// Define the option type for use in the form
interface ProductOption {
    name: string;
    values: string[];
}

// Helper function for class names
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Simplified postVariant without image handling
async function postVariant(variantData: any) {
    // Ensure price and compareAtPrice are numbers not strings
    const payload = {
        ...variantData,
        price: variantData.price !== undefined ? Number(variantData.price) : undefined,
        compareAtPrice: variantData.compareAtPrice ? Number(variantData.compareAtPrice) : null,
        inventoryQuantity: Number(variantData.inventoryQuantity || 0),
    };

    console.log("Formatted variant payload:", payload);

    const response = await fetch('/api/variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorData = await response.json();
        // Attempt to parse Zod errors if available
        const zodErrors = errorData.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new Error(zodErrors || errorData.message || 'فشل في إنشاء المتغير');
    }

    return response.json();
}

// Helper function to fetch product by ID
async function fetchProductById(productId: string) {
    const response = await fetch(`/api/products/${productId}`);
    if (!response.ok) {
        throw new Error('فشل في جلب معلومات المنتج');
    }
    return response.json();
}

// Combine schemas for Formik validation - removed images
const variantsFormSchema = z.object({
    // Product information (for display only)
    productId: z.string(),
    productName: z.string(),
    // Options array for the form
    options: z.array(productOptionSchema),
    // Variants array
    variants: z.array(
        z.object({
            price: z.union([
                z.number().min(0.01, "السعر يجب أن يكون أكبر من صفر"),
                z.string().min(1, "السعر مطلوب").transform(val => Number(val) || 0)
            ]),
            compareAtPrice: z.union([
                z.number().optional(),
                z.string().optional().transform(val => val ? Number(val) : undefined)
            ]).optional(),
            inventoryQuantity: z.union([
                z.number().min(0, "الكمية لا يمكن أن تكون سالبة"),
                z.string().transform(val => Number(val) || 0)
            ]).default(0),
            sku: z.string().optional(),
            barcode: z.string().optional(),
            isActive: z.boolean().default(true),
            title: z.string().optional(),
            options: z.array(z.object({
                optionId: z.string(),
                valueId: z.string(),
                optionName: z.string(),
                value: z.string()
            })).optional(),
            images: z.array(z.object({ id: z.string(), url: z.string(), altText: z.string().optional().nullable() })).optional().default([]),
        })
    ).optional().default([]),
}).superRefine((data, ctx) => {
    // Only validate variants if we've attempted to generate them
    if (data.options.length > 0 && data.variants.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "يجب توليد متغير واحد على الأقل",
            path: ["variants"],
        });
    }
});

type VariantsFormInput = z.infer<typeof variantsFormSchema>;

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

// Helper function to get initial values for a new variant
interface VariantInitialValues {
    price: number;
    compareAtPrice: number;
    inventoryQuantity: number;
    sku: string;
    barcode: string;
    isActive: boolean;
    title: string;
    options: VariantOptionValue[];
    images: ProductImage[];
}

const getVariantInitialValues = (): VariantInitialValues => ({
    price: 0,
    compareAtPrice: 0,
    inventoryQuantity: 0,
    sku: '',
    barcode: '',
    isActive: true,
    title: '',
    options: [],
    images: [],
});

const VariantsCreationPageContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const productId = searchParams.get('productId');
    const productName = searchParams.get('productName');

    const queryClient = useQueryClient();
    const [formError, setFormError] = useState<string | null>(null);
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);
    const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);

    // Reference for scrolling to error messages
    const errorRef = useRef<HTMLDivElement>(null);

    // Fetch product details if needed
    const { data: productData } = useQuery({
        queryKey: ['product', productId],
        queryFn: () => productId ? fetchProductById(productId) : null,
        enabled: !!productId,
    });

    // Redirect if no product ID
    useEffect(() => {
        if (!productId) {
            router.push('/admin/products');
        }
    }, [productId, router]);

    const createVariantMutation = useMutation({
        mutationFn: postVariant,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['variants'] });
        },
        onError: (error: any) => {
            console.error("Variant creation error:", error);
            setFormError(prev => (prev ? `${prev}\n` : '') + `خطأ في المتغير: ${error.message || 'فشل إنشاء المتغير'}`);
        }
    });

    // Initial values for the form
    const initialValues: VariantsFormInput = {
        productId: productId || '',
        productName: productName || '',
        options: [{ name: '', values: [''] }],
        variants: [],
    };

    const handleSubmit = async (values: VariantsFormInput, { setSubmitting }: any) => {
        setFormError(null);
        setFormSuccess(null);
        setValidationErrors([]);
        setSubmitting(true);

        try {
            // Validate variants exist
            if (!values.variants || values.variants.length === 0) {
                setFormError('يرجى توليد المتغيرات أولاً قبل حفظها.');
                setSubmitting(false);
                if (errorRef.current) {
                    errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                return;
            }

            // Create variants
            for (const variant of values.variants) {
                // Make sure we're correctly handling the variant options
                const apiOptions = variant.options?.map((opt: any) => ({
                    optionId: opt.optionId,
                    valueId: opt.valueId,
                    optionName: opt.optionName,
                    value: opt.value
                })) || [];

                const variantPayload = {
                    price: variant.price,
                    compareAtPrice: variant.compareAtPrice || null,
                    inventoryQuantity: variant.inventoryQuantity || 0,
                    sku: variant.sku || null,
                    barcode: variant.barcode || null,
                    isActive: variant.isActive,
                    options: apiOptions,
                    productId: values.productId,
                    images: variant.images?.map(img => ({ url: img.url, altText: img.altText })) || [],
                };

                await createVariantMutation.mutateAsync(variantPayload);
            }

            setFormSuccess(`تم إنشاء المتغيرات بنجاح!`);

            // Redirect to products list after success
            setTimeout(() => router.push('/admin/products'), 1500);

        } catch (error: any) {
            console.error("Error creating variants:", error);
            const message = error.message || 'حدث خطأ غير متوقع.';
            setFormError(message);
            if (errorRef.current) {
                errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } finally {
            setSubmitting(false);
        }
    };

    // Function to generate variant combinations
    const handleGenerateVariants = (values: VariantsFormInput, setFieldValue: Function) => {
        setIsGeneratingVariants(true);
        setFormError(null);
        setValidationErrors([]);

        const { options } = values;

        // Basic validation before generating
        if (!options || options.length === 0) {
            setFormError("يرجى إضافة خيار واحد على الأقل قبل توليد المتغيرات.");
            setIsGeneratingVariants(false);
            return;
        }

        if (options.some(opt => !opt.name || !opt.values || opt.values.length === 0 || opt.values.some(v => !v))) {
            setFormError("يرجى التأكد من أن جميع الخيارات لها أسماء وقيم غير فارغة.");
            setIsGeneratingVariants(false);
            return;
        }

        // Generate combinations
        const optionValues = options.map(opt => opt.values.map(val => ({ optionName: opt.name, value: val })));

        if (optionValues.length === 0) {
            setFieldValue('variants', []);
            setIsGeneratingVariants(false);
            return;
        }

        const combinations = optionValues.reduce((acc, currentValues) => {
            if (acc.length === 0) {
                return currentValues.map(val => [val]);
            }
            const newCombinations: { optionName: string; value: string }[][] = [];
            acc.forEach(existingCombo => {
                currentValues.forEach(currentVal => {
                    newCombinations.push([...existingCombo, currentVal]);
                });
            });
            return newCombinations;
        }, [] as { optionName: string; value: string }[][]);

        // Create new variant objects based on combinations
        const newVariants = combinations.map(combo => {
            const title = combo.map(c => c.value).join(' / ');
            // Map combo to VariantOptionValue structure
            const variantOptions: VariantOptionValue[] = combo.map(c => ({
                optionName: c.optionName,
                value: c.value,
                optionId: `temp-option-${c.optionName}`,
                valueId: `temp-value-${c.value}`
            }));

            return {
                ...getVariantInitialValues(),
                title: title,
                options: variantOptions,
            };
        });

        console.log("Generated Variants:", newVariants);
        setFieldValue('variants', newVariants);
        setIsGeneratingVariants(false);
    };

    // Function to go back to products list
    const handleCancel = () => {
        router.push('/admin/products');
    };

    if (!productId) {
        return (
            <div dir="rtl" className="container mx-auto py-10 px-4">
                <div className="text-center">
                    <p>معلومات المنتج غير متوفرة. الرجاء العودة للخلف وإعادة المحاولة.</p>
                    <Button onClick={handleCancel} className="mt-4">
                        العودة إلى قائمة المنتجات
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div dir="rtl" className="container mx-auto py-10 px-4">
            <div className="flex items-center mb-6">
                <Button
                    variant="ghost"
                    onClick={handleCancel}
                    className="mr-4"
                >
                    <ArrowRight className="h-4 w-4 ml-2" />
                    العودة
                </Button>
                <h1 className="text-3xl font-bold">إنشاء متغيرات المنتج</h1>
            </div>

            <p className="text-muted-foreground mb-8">
                أضف متغيرات للمنتج "{productName || 'المنتج'}". قم بإنشاء الخيارات وتوليد المتغيرات ثم تخصيص تفاصيل كل متغير.
            </p>

            <Formik
                initialValues={initialValues}
                validationSchema={toFormikValidationSchema(variantsFormSchema)}
                onSubmit={handleSubmit}
                enableReinitialize
            >
                {({ values, isSubmitting, setFieldValue, errors, touched, dirty, isValid }) => (
                    <Form className="space-y-8">
                        {/* Error Summary Section */}
                        {(formError || (dirty && !isValid && Object.keys(errors).length > 0)) && (
                            <div ref={errorRef} className="bg-destructive/10 border border-destructive rounded-md p-4">
                                <div className="flex items-start">
                                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5 ml-2 flex-shrink-0" />
                                    <div className="flex-grow">
                                        <h3 className="text-sm font-medium text-destructive">توجد مشكلة في النموذج</h3>
                                        <div className="mt-2 text-sm text-destructive">
                                            {formError && <p className="mb-2">{formError}</p>}

                                            {/* Display validation errors */}
                                            {dirty && !isValid && Object.keys(errors).length > 0 && (
                                                <ul className="list-disc space-y-1 mr-5">
                                                    {Object.entries(errors).map(([key, errorMsg]) => {
                                                        if (typeof errorMsg === 'string') {
                                                            return <li key={key}>{`${key}: ${errorMsg}`}</li>;
                                                        }
                                                        return null;
                                                    })}
                                                    {validationErrors.map((error, i) => (
                                                        <li key={`val-${i}`}>{error}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Success Message */}
                        {formSuccess && (
                            <div className="bg-green-50 border border-green-200 rounded-md p-4">
                                <div className="flex">
                                    <CheckCircle className="h-5 w-5 text-green-400 ml-2 flex-shrink-0" />
                                    <div className="mr-3 flex-grow">
                                        <h3 className="text-sm font-medium text-green-800">تم بنجاح</h3>
                                        <div className="mt-2 text-sm text-green-700">
                                            <p>{formSuccess}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Options Section */}
                        <Card>
                            <CardHeader>
                                <CardTitle>1. خيارات المتغيرات</CardTitle>
                                <CardDescription>حدد نوع المتغيرات (مثل اللون، المقاس) وقيمها المتاحة. ثم قم بتوليد توليفات المتغيرات.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    <FieldArray name="options">
                                        {({ remove: removeOption, push: pushOption, form }) => (
                                            <div className="space-y-4">
                                                {values.options && values.options.length > 0 ? (
                                                    values.options.map((option, optionIndex) => (
                                                        <div key={optionIndex} className="border rounded-md p-4 relative bg-muted/20">
                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                                                <FormikField
                                                                    name={`options.${optionIndex}.name`}
                                                                    label={`* اسم الخيار #${optionIndex + 1}`}
                                                                    placeholder="مثال: اللون، المقاس، المادة"
                                                                    explanation="نوع الخيار، مثل: اللون، المقاس، المادة."
                                                                />

                                                                <div>
                                                                    <Label className="block mb-2">
                                                                        * القيم المتاحة
                                                                        <TooltipProvider delayDuration={100}>
                                                                            <Tooltip>
                                                                                <TooltipTrigger asChild>
                                                                                    <Info className="h-4 w-4 text-muted-foreground mr-1 cursor-help inline-block" />
                                                                                </TooltipTrigger>
                                                                                <TooltipContent side="top" className="max-w-xs">
                                                                                    أضف كل القيم المتاحة لهذا الخيار، مثل: أحمر، أخضر، أزرق لخيار اللون. اضغط Enter لإضافة قيمة جديدة.
                                                                                </TooltipContent>
                                                                            </Tooltip>
                                                                        </TooltipProvider>
                                                                    </Label>

                                                                    <FieldArray name={`options.${optionIndex}.values`}>
                                                                        {({ remove: removeValue, push: pushValue }) => (
                                                                            <div className="space-y-2">
                                                                                {option.values && option.values.map((_value, valueIndex) => {
                                                                                    const errorForThisValue =
                                                                                        typeof errors.options?.[optionIndex] === 'object' &&
                                                                                            errors.options?.[optionIndex]?.values &&
                                                                                            Array.isArray(errors.options?.[optionIndex]?.values) &&
                                                                                            typeof errors.options?.[optionIndex]?.values?.[valueIndex] === 'string'
                                                                                            ? errors.options[optionIndex].values[valueIndex]
                                                                                            : undefined;

                                                                                    const isTouchedForThisValue =
                                                                                        touched.options?.[optionIndex]?.values &&
                                                                                        Array.isArray(touched.options?.[optionIndex]?.values) &&
                                                                                        touched.options?.[optionIndex]?.values?.[valueIndex];

                                                                                    return (
                                                                                        <div key={valueIndex} className="flex gap-2 items-center">
                                                                                            <Field
                                                                                                name={`options.${optionIndex}.values.${valueIndex}`}
                                                                                                placeholder={`قيمة #${valueIndex + 1}`}
                                                                                                className={cn(
                                                                                                    "flex-1 block w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 h-9",
                                                                                                    isTouchedForThisValue && errorForThisValue ? "border-destructive focus-visible:ring-destructive/50" : "border-input"
                                                                                                )}
                                                                                                onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                                                                                    if (e.key === 'Enter' && valueIndex === option.values.length - 1 && e.currentTarget.value.trim() !== '') {
                                                                                                        e.preventDefault();
                                                                                                        pushValue('');
                                                                                                        setTimeout(() => {
                                                                                                            const nextInput = document.querySelector(`[name="options.${optionIndex}.values.${valueIndex + 1}"]`) as HTMLInputElement;
                                                                                                            nextInput?.focus();
                                                                                                        }, 0);
                                                                                                    }
                                                                                                }}
                                                                                            />
                                                                                            <Button
                                                                                                type="button"
                                                                                                variant="ghost"
                                                                                                size="icon"
                                                                                                className="text-muted-foreground hover:text-destructive h-7 w-7"
                                                                                                onClick={() => removeValue(valueIndex)}
                                                                                                disabled={option.values.length <= 1}
                                                                                            >
                                                                                                <Trash2 className="h-4 w-4" />
                                                                                                <span className="sr-only">حذف القيمة</span>
                                                                                            </Button>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    onClick={() => pushValue('')}
                                                                                    className="mt-2"
                                                                                >
                                                                                    إضافة قيمة أخرى
                                                                                </Button>
                                                                                {(() => {
                                                                                    const optionTouched = touched.options?.[optionIndex];
                                                                                    const optionError = errors.options?.[optionIndex];
                                                                                    if (optionTouched?.values && typeof optionError === 'object' && optionError?.values && typeof optionError.values === 'string') {
                                                                                        return <div className="text-sm text-destructive mt-1">{optionError.values}</div>;
                                                                                    }
                                                                                    return null;
                                                                                })()}
                                                                            </div>
                                                                        )}
                                                                    </FieldArray>
                                                                </div>
                                                            </div>

                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="absolute top-2 left-2 text-destructive hover:bg-destructive/10 h-7 w-7"
                                                                onClick={() => {
                                                                    removeOption(optionIndex);
                                                                    form.setFieldValue('variants', []);
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="sr-only">حذف الخيار</span>
                                                            </Button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-sm text-muted-foreground text-center py-4">لا توجد خيارات مضافة بعد. اضغط على "إضافة خيار جديد" للبدء.</p>
                                                )}

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={() => pushOption({ name: '', values: [''] })}
                                                    className="flex items-center gap-2"
                                                    disabled={isGeneratingVariants}
                                                >
                                                    <PlusCircle className="h-4 w-4" />
                                                    إضافة خيار جديد
                                                </Button>

                                                {touched.options && typeof errors.options === 'string' && (
                                                    <div className="text-sm text-destructive mt-2">{errors.options}</div>
                                                )}

                                                {values.options && values.options.length > 0 && (
                                                    <div className="mt-6 border-t pt-6">
                                                        <h4 className="text-md font-medium mb-3">توليد المتغيرات</h4>
                                                        <Button
                                                            type="button"
                                                            onClick={() => handleGenerateVariants(values, setFieldValue)}
                                                            variant="secondary"
                                                            disabled={isGeneratingVariants || values.options.some(opt => !opt.name || !opt.values || opt.values.length === 0 || opt.values.some(v => !v))}
                                                        >
                                                            {isGeneratingVariants ? "جاري التوليد..." : "توليد توليفات المتغيرات"}
                                                        </Button>
                                                        <p className="text-xs text-muted-foreground mt-2">
                                                            بعد إضافة جميع الخيارات والقيم والتأكد من صحتها، اضغط هنا لتوليد جميع توليفات المتغيرات الممكنة تلقائياً في القسم التالي.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </FieldArray>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Generated Variants Section */}
                        {values.variants && values.variants.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>2. تفاصيل المتغيرات</CardTitle>
                                    <CardDescription>تم توليد المتغيرات بناءً على الخيارات. قم بتعديل السعر، الكمية، SKU، والباركود لكل متغير.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <FieldArray name="variants">
                                        {({ remove }) => (
                                            <div className="space-y-6">
                                                {values.variants.map((variant, index) => (
                                                    <div key={index} className="border rounded-md p-4 relative bg-muted/20 space-y-4">
                                                        <div className="flex justify-between items-center mb-3">
                                                            <h4 className="font-semibold text-md">
                                                                متغير #{index + 1}: {variant.title || 'بدون عنوان'}
                                                                <span className="text-xs text-muted-foreground mr-2">
                                                                    {variant.options && Array.isArray(variant.options) ?
                                                                        variant.options.map((o: any) => o.value).join(' / ') :
                                                                        ''}
                                                                </span>
                                                            </h4>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                className="text-destructive hover:bg-destructive/10 h-7 w-7"
                                                                onClick={() => remove(index)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                                <span className="sr-only">حذف المتغير</span>
                                                            </Button>
                                                        </div>

                                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                                            <FormikField
                                                                name={`variants.${index}.price`}
                                                                label="* سعر البيع"
                                                                type="number"
                                                                step="0.01"
                                                                min="0.01"
                                                                placeholder="50.00"
                                                            />
                                                            <FormikField
                                                                name={`variants.${index}.compareAtPrice`}
                                                                label="السعر قبل الخصم"
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                placeholder="60.00"
                                                            />
                                                            <FormikField
                                                                name={`variants.${index}.inventoryQuantity`}
                                                                label="* الكمية"
                                                                type="number"
                                                                min="0"
                                                                step="1"
                                                                placeholder="10"
                                                            />
                                                            <FormikField
                                                                name={`variants.${index}.sku`}
                                                                label="SKU"
                                                                placeholder={`SKU-${variant.options && Array.isArray(variant.options) ?
                                                                    variant.options.map((o: any) => o.value).join('-') :
                                                                    ''}`}
                                                            />
                                                            <FormikField
                                                                name={`variants.${index}.barcode`}
                                                                label="الباركود"
                                                                placeholder="123..."
                                                            />
                                                        </div>
                                                        <div className="mt-4">
                                                            <Label className="block mb-1">صور المتغير</Label>
                                                            <ImageUpload
                                                                images={variant.images || []}
                                                                onChange={(imgs) => setFieldValue(`variants.${index}.images`, imgs)}
                                                                disabled={isSubmitting}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                                {touched.variants && typeof errors.variants === 'string' && (
                                                    <div className="text-sm text-destructive mt-2">{errors.variants}</div>
                                                )}
                                            </div>
                                        )}
                                    </FieldArray>
                                </CardContent>
                            </Card>
                        )}

                        {/* Submit Button */}
                        <div className="flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                                إلغاء
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !isValid || (values.variants.length === 0)}>
                                {isSubmitting ? 'جاري الحفظ...' : 'حفظ المتغيرات'}
                            </Button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default function VariantsCreationPage() {
    return (
        <Suspense fallback={<div className="p-4 text-center" dir="rtl">جاري التحميل...</div>}>
            <VariantsCreationPageContent />
        </Suspense>
    );
}