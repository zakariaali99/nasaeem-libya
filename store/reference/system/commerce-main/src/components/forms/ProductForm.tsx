import React from 'react';
import { Form, Field, FormikProps } from 'formik';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import { FormikField } from './FormikField';
import { FormError, FormSuccess } from './FormMessages';
import { ImageUpload } from '@/components/ui/image-upload';
import { ProductImage } from '@/modules/images/types/imageTypes';
import { TextBlockEditor } from '@/components/admin/customization/TextBlockComponents';

interface ProductFormProps {
  formik: FormikProps<any>;
  formError: string | null;
  formSuccess: string | null;
  errorRef: React.RefObject<HTMLDivElement>;
  isEditing?: boolean;
  generateSlug?: (name: string) => string;
  onCancel: () => void;
  images?: ProductImage[];
  onImagesChange?: (images: ProductImage[]) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({
  formik,
  formError,
  formSuccess,
  errorRef,
  isEditing = false,
  generateSlug,
  onCancel,
  images = [],
  onImagesChange
}) => {
  const { values, isSubmitting, setFieldValue, errors, dirty, isValid } = formik;

  return (
    <Form className="space-y-8">
      {/* Error and Success Messages */}
      <FormError 
        error={formError} 
        validationErrors={Object.entries(errors).reduce((acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, string>)} 
        formTouched={dirty} 
        formValid={isValid} 
        errorRef={errorRef} 
      />
      <FormSuccess message={formSuccess} />

      {/* Basic Product Information */}
      {/* Replace description field with TextBlockEditor */}
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
              if (generateSlug && (!values.slug || values.slug === generateSlug(values.name))) {
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
            disabled={isEditing}
            explanation="جزء من رابط المنتج (URL). يجب أن يكون فريداً ويحتوي على أحرف إنجليزية صغيرة وأرقام وشرطات فقط. يتم إنشاؤه تلقائياً من الاسم إذا ترك فارغاً."
          />
          <div className="md:col-span-2">
            <Label htmlFor="description" className="block mb-1">وصف المنتج</Label>
            <TextBlockEditor
              value={values.description || ''}
              onChange={(markdown: string) => setFieldValue('description', markdown)}
            />
            {errors.description && dirty && (
              <p className="text-sm text-destructive mt-1">{errors.description as string}</p>
            )}
          </div>
          {/* TODO: Add Category Select Here */}
        </CardContent>
      </Card>

      {/* Product Images */}
      {onImagesChange && (
        <Card>
          <CardHeader>
            <CardTitle>2. صور المنتج</CardTitle>
            <CardDescription>أضف صور للمنتج. الصورة الأولى ستكون الصورة الرئيسية.</CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUpload
              images={images}
              onChange={(uploaded) => onImagesChange(uploaded as ProductImage[])}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>
      )}

      {/* Pricing and Inventory */}
      <Card>
        <CardHeader>
          <CardTitle>{onImagesChange ? '3' : '2'}. التسعير والمخزون</CardTitle>
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
                  disabled={isEditing} // Disable hasVariants toggle when editing
                  aria-readonly={isEditing}
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
                  {isEditing && <p className="mt-2 text-amber-600">لا يمكن تغيير هذا الإعداد بعد إنشاء المنتج.</p>}
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
                بما أن المنتج له متغيرات، {isEditing ? 'يمكنك إدارة المتغيرات من خلال قسم المتغيرات أدناه' : 'ستقوم بتحديد السعر والكمية لكل متغير في الخطوة التالية بعد حفظ المنتج الأساسي'}. يمكنك إضافة SKU أو باركود عام للمنتج هنا إذا أردت.
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

      {/* Logistics Settings: Track Quantity and Dimensions */}
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
          <FormikField
            name="width"
            label="العرض (سم)"
            type="number"
            min="0"
            placeholder="0"
            explanation="العرض بالسنتيمتر"
          />
          <FormikField
            name="length"
            label="الطول (سم)"
            type="number"
            min="0"
            placeholder="0"
            explanation="الطول بالسنتيمتر"
          />
          <FormikField
            name="height"
            label="الارتفاع (سم)"
            type="number"
            min="0"
            placeholder="0"
            explanation="الارتفاع بالسنتيمتر"
          />
          <FormikField
            name="weight"
            label="الوزن (كجم)"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            explanation="الوزن بالكيلوغرام"
          />
        </CardContent>
      </Card>

      {/* SEO Section */}
      <Card>
        <CardHeader>
          <CardTitle>{onImagesChange ? '5' : '4'}. تحسين محركات البحث (SEO)</CardTitle>
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          إلغاء
        </Button>
        <Button type="submit" disabled={isSubmitting || !isValid}>
          {isSubmitting 
            ? 'جاري الحفظ...' 
            : isEditing 
              ? 'حفظ التغييرات' 
              : values.hasVariants 
                ? 'حفظ والانتقال لإنشاء المتغيرات' 
                : 'حفظ المنتج'
          }
        </Button>
      </div>
    </Form>
  );
};

export default ProductForm;