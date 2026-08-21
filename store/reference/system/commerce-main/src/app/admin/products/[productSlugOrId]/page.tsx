'use client'
import { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Formik } from 'formik';
import { toFormikValidationSchema } from 'zod-formik-adapter';
import * as z from 'zod';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductImage } from '@/modules/images/types/imageTypes';
import ProductForm from '@/components/forms/ProductForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

// Simplified product schema - same as in new product creation
const productSchema = z.object({
  name: z.string().min(1, "اسم المنتج مطلوب"),
  slug: z.string().min(1, "المعرف الفريد مطلوب"),
  description: z.string().nullable().optional(),
  price: z.coerce.number().optional(),
  compareAtPrice: z.coerce.number().optional().nullable(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  categoryId: z.string().nullable(),
  metaTitle: z.string().nullable().optional(),
  metaDescription: z.string().nullable().optional(),
  hasVariants: z.boolean().default(false),
  trackQuantity: z.boolean().default(false),
  isActive: z.boolean().default(true),
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
    path: ["hasVariants"],
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

// Helper function to fetch product by ID or slug
async function fetchProduct(idOrSlug: string) {
  const response = await fetch(`/api/products/${idOrSlug}`);
  if (!response.ok) {
    throw new Error('فشل في جلب معلومات المنتج');
  }
  return response.json();
}

// Helper function to fetch product variants
async function fetchProductVariants(productId: string) {
  const response = await fetch(`/api/variants?productId=${productId}`);
  if (!response.ok) {
    throw new Error('فشل في جلب متغيرات المنتج');
  }
  const data = await response.json();
  return data.data;
}

// Helper function to update a product
async function updateProduct(productId: string, productData: any) {
  const payload = {
    ...productData,
    price: productData.price !== undefined ? Number(productData.price) : undefined,
    compareAtPrice: productData.compareAtPrice ? Number(productData.compareAtPrice) : null,
  };

  const response = await fetch(`/api/products/${productId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'فشل في تحديث المنتج');
  }

  return response.json();
}

// Helper function to update a variant
async function updateVariant(variantId: string, variantData: any) {
  const payload = {
    ...variantData,
    price: variantData.price !== undefined ? Number(variantData.price) : undefined,
    compareAtPrice: variantData.compareAtPrice ? Number(variantData.compareAtPrice) : null,
    inventoryQuantity: Number(variantData.inventoryQuantity || 0),
  };

  const response = await fetch(`/api/variants/${variantId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'فشل في تحديث المتغير');
  }

  return response.json();
}

// Function to generate slug from product name
function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9ء-ي\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productSlugOrId = params.productSlugOrId as string;
  const queryClient = useQueryClient();
  
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [activeTab, setActiveTab] = useState('product');
  
  // Reference for scrolling to error messages - with correct typing
  const errorRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  // Fetch product details
  const { data: productData, isLoading: isProductLoading, error: productError } = useQuery({
    queryKey: ['product', productSlugOrId],
    queryFn: () => fetchProduct(productSlugOrId),
    enabled: !!productSlugOrId,
  });

  // Initialize images from product data
  useEffect(() => {
    if (productData?.data?.images) {
      setImages(productData.data.images);
    }
  }, [productData]);

  // Fetch product variants
  const { data: variantsData, isLoading: isVariantsLoading } = useQuery({
    queryKey: ['product-variants', productData?.data?.id],
    queryFn: () => fetchProductVariants(productData?.data?.id),
    enabled: !!productData?.data?.id,
  });

  // Update product mutation
  const updateProductMutation = useMutation({
    mutationFn: ({ productId, productData }: { productId: string, productData: any }) => 
      updateProduct(productId, productData),
    onSuccess: (updated) => {
      // Optimistically update local cache so UI reflects changes immediately
      queryClient.setQueryData(['product', productSlugOrId], (prev: any) => {
        const newData = updated?.data ?? updated;
        if (!prev) return { data: newData };
        return { ...prev, data: { ...prev.data, ...newData } };
      });
      // Also ensure local images state reflects server result
      if (updated?.data?.images) {
        setImages(updated.data.images);
      }
      // Invalidate broader lists to keep consistency elsewhere
      queryClient.invalidateQueries({ queryKey: ['product', productSlugOrId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    }
  });

  // Handle product updates
  const handleProductUpdate = async (values: ProductInput, { setSubmitting }: any) => {
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);

    try {
      if (!productData?.data?.id) {
        throw new Error('لم يتم العثور على معرف المنتج');
      }

      // Prepare product data for update
      const productPayload: any = {
        name: values.name,
        description: values.description || null,
        categoryId: values.categoryId || null,
        metaTitle: values.metaTitle || null,
        metaDescription: values.metaDescription || null,
        sku: values.sku || null,
        barcode: values.barcode || null,
        isActive: values.isActive,
        // Include updated images
        images: images,
      };

      // Add price/compareAtPrice only if NOT hasVariants
      if (!values.hasVariants) {
        if (values.price === undefined || values.price <= 0) {
          throw new Error("السعر مطلوب للمنتج بدون متغيرات ويجب أن يكون رقماً موجباً.");
        }
        productPayload.price = values.price;
        productPayload.compareAtPrice = values.compareAtPrice || null;
      }

      // Update the product
      await updateProductMutation.mutateAsync({ 
        productId: productData.data.id, 
        productData: productPayload 
      });

      // If product has no variants, update the default variant
      if (!values.hasVariants && variantsData?.data?.length > 0) {
        const defaultVariant = variantsData.data[0];
        const variantPayload = {
          price: values.price,
          compareAtPrice: values.compareAtPrice || null,
          inventoryQuantity: values.stock || 0,
          sku: values.sku || null,
          barcode: values.barcode || null,
          isActive: true,
        };

        await updateVariant(defaultVariant.id, variantPayload);
      }

      setFormSuccess(`تم تحديث المنتج "${values.name}" بنجاح!`);
      // Update images state to reflect the saved payload immediately
      setImages(productPayload.images || []);
      setTimeout(() => {
        setFormSuccess(null);
      }, 3000);

    } catch (error: any) {
      console.error("Error updating product:", error);
      const message = error.message || 'حدث خطأ غير متوقع.';
      setFormError(message);
      if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle image updates
  const handleImagesChange = (newImages: ProductImage[]) => {
    setImages(newImages);
  };

  // Handle cancel button
  const handleCancel = () => {
    router.push('/admin/products');
  };

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Show loading state
  if (isProductLoading) {
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
          <Skeleton className="h-9 w-48" />
        </div>
        
        <div className="space-y-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  // Show error state
  if (productError || !productData?.data) {
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
          <h1 className="text-3xl font-bold">خطأ</h1>
        </div>
        
        <div className="bg-destructive/10 border border-destructive rounded-md p-4">
          <p className="text-center">لم يتم العثور على المنتج المطلوب. الرجاء التحقق من الرابط والمحاولة مرة أخرى.</p>
          <div className="flex justify-center mt-4">
            <Button onClick={handleCancel}>
              العودة إلى قائمة المنتجات
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Prepare initial form values from product data
  const initialValues: ProductInput = {
      name: productData.data.name || '',
      slug: productData.data.slug || '',
      description: productData.data.description || '',
      sku: productData.data.sku || '',
      barcode: productData.data.barcode || '',
      categoryId: productData.data.categoryId || null,
      metaTitle: productData.data.metaTitle || '',
      metaDescription: productData.data.metaDescription || '',
      hasVariants: productData.data.hasVariants || false,
      trackQuantity: productData.data.trackQuantity || false,
      isActive: productData.data.isActive ?? true,
      width: productData.data.width ?? undefined,
      length: productData.data.length ?? undefined,
      height: productData.data.height ?? undefined,
      weight: productData.data.weight ?? undefined,
      images: images,
      price: productData.data.price ?? undefined,
      compareAtPrice: productData.data.compareAtPrice ?? null,
      stock: productData.data.stock ?? undefined,
  };

  return (
    <div dir="rtl" className="container mx-auto py-10 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            onClick={handleCancel}
            className="mr-4"
          >
            <ArrowRight className="h-4 w-4 ml-2" />
            العودة
          </Button>
          <h1 className="text-3xl font-bold">تعديل المنتج</h1>
        </div>
        <div>
          <Button 
            variant="outline" 
            onClick={() => window.open(`/products/${productData.data.slug}`, '_blank')}
          >
            معاينة المنتج
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-8">
          <TabsTrigger value="product">تفاصيل المنتج</TabsTrigger>
          {productData.data.hasVariants && (
            <TabsTrigger value="variants">المتغيرات ({isVariantsLoading ? '...' : variantsData?.total || 0})</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="product">
          <Formik
            initialValues={initialValues}
            validationSchema={toFormikValidationSchema(productSchema)}
            onSubmit={handleProductUpdate}
            enableReinitialize
          >
            {(formik) => (
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 border rounded-md">
                  <div>
                    <p className="font-medium">حالة المنتج</p>
                    <p className="text-sm text-muted-foreground">تفعيل أو إيقاف عرض المنتج في المتجر</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm">غير مفعل</span>
                    <Switch
                      checked={formik.values.isActive}
                      onCheckedChange={(checked) => formik.setFieldValue('isActive', checked)}
                    />
                    <span className="text-sm">مفعل</span>
                  </div>
                </div>

                <ProductForm
                  formik={formik}
                  formError={formError}
                  formSuccess={formSuccess}
                  errorRef={errorRef}
                  isEditing={true}
                  generateSlug={generateSlug}
                  onCancel={handleCancel}
                  images={images}
                  onImagesChange={handleImagesChange}
                />
              </div>
            )}
          </Formik>
        </TabsContent>
        
        {productData.data.hasVariants && (
          <TabsContent value="variants">
            <Card>
              <CardHeader>
                <CardTitle>متغيرات المنتج</CardTitle>
                <CardDescription>إدارة متغيرات المنتج وتعديل خصائصها مثل السعر والكمية</CardDescription>
              </CardHeader>
              <CardContent>
                {isVariantsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : variantsData?.data?.length ? (
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <h3 className="text-lg font-medium">قائمة المتغيرات ({variantsData.data.length})</h3>
                      <Button 
                        onClick={() => router.push(`/admin/products/new/variants?productId=${productData.data.id}&productName=${productData.data.name}`)}
                      >
                        إضافة متغير جديد
                      </Button>
                    </div>
                    
                    {/* Variants List - Basic for now, will implement full editing later */}
                    <div className="border rounded-md">
                      <div className="grid grid-cols-5 p-3 bg-muted font-medium border-b">
                        <div>المتغير</div>
                        <div>السعر</div>
                        <div>الكمية</div>
                        <div>SKU</div>
                        <div className="text-left">الإجراءات</div>
                      </div>
                      
                      {variantsData.data.map((variant: any) => (
                        <div key={variant.id} className="grid grid-cols-5 p-3 border-b last:border-0">
                          <div>{variant.title || variant.sku || '-'}</div>
                          <div>{variant.price} {variant.compareAtPrice && <span className="text-muted-foreground line-through text-xs mr-1">{variant.compareAtPrice}</span>}</div>
                          <div>{variant.inventoryQuantity}</div>
                          <div>{variant.sku || '-'}</div>
                          <div className="text-left">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => router.push(`/admin/products/${productSlugOrId}/variants/${variant.id}`)}
                            >
                              تعديل
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">لا توجد متغيرات لهذا المنتج.</p>
                    <Button onClick={() => router.push(`/admin/products/${productSlugOrId}/variants/new`)}>
                      إضافة متغير جديد
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}