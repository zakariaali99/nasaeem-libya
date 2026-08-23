import { zodResolver } from '@hookform/resolvers/zod'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Percent,
  Trash2,
  Upload,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useBeforeUnload } from 'react-router-dom'
import { z } from 'zod'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { formatPrice } from '@/lib/format'
import { uploadImage, useCategories, useCollections } from '@/lib/queries/catalog'
import { cn } from '@/lib/utils'
import type { Product, ProductImage } from '@/types/api'

const schema = z
  .object({
    name: z.string().trim().min(2, 'اسم المنتج مطلوب').max(100),
    description: z.string().max(5000).optional(),
    price: z
      .string()
      .min(1, 'السعر مطلوب')
      .refine((v) => Number(v) > 0, 'السعر يجب أن يكون أكبر من صفر'),
    compare_at_price: z.string().optional(),
    sku: z.string().max(50).optional(),
    barcode: z.string().max(50).optional(),
    meta_title: z.string().max(255).optional(),
    meta_description: z.string().max(500).optional(),
    is_active: z.boolean(),
    track_quantity: z.boolean(),
  })
  .refine(
    (data) =>
      !data.compare_at_price ||
      Number(data.compare_at_price) > Number(data.price),
    {
      path: ['compare_at_price'],
      message: 'السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي',
    },
  )

export type ProductFormValues = z.infer<typeof schema>

interface ProductFormProps {
  product?: Product
  submitLabel: string
  pending?: boolean
  serverError?: unknown
  onSubmit: (values: Record<string, unknown>) => Promise<void>
}

export function ProductForm({
  product,
  submitLabel,
  pending,
  serverError,
  onSubmit,
}: ProductFormProps) {
  const categories = useCategories()
  const collections = useCollections()

  const [images, setImages] = useState<
    Pick<ProductImage, 'url' | 'alt_text'>[]
  >(
    product?.images.map((i) => ({ url: i.url, alt_text: i.alt_text })) ?? [],
  )
  const [categoryIds, setCategoryIds] = useState<string[]>(
    product?.categories.map((c) => c.id) ?? [],
  )
  const [collectionIds, setCollectionIds] = useState<string[]>(
    product?.collections.map((c) => c.id) ?? [],
  )
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dragIndex = useRef<number | null>(null)

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product?.price ?? '',
      compare_at_price: product?.compare_at_price ?? '',
      sku: product?.sku ?? '',
      barcode: product?.barcode ?? '',
      meta_title: product?.meta_title ?? '',
      meta_description: product?.meta_description ?? '',
      is_active: product?.is_active ?? true,
      track_quantity: product?.track_quantity ?? true,
    },
  })

  const { errors, isDirty, isSubmitting } = form.formState
  const dirty = isDirty || images.length !== (product?.images.length ?? 0)

  const watchedPrice = form.watch('price')
  const watchedCompare = form.watch('compare_at_price')
  const watchedName = form.watch('name')
  const watchedDesc = form.watch('description')

  // Calculate discount percentage preview
  const priceNum = Number(watchedPrice) || 0
  const compareNum = Number(watchedCompare) || 0
  const discountPct =
    compareNum > priceNum && priceNum > 0
      ? Math.round(((compareNum - priceNum) / compareNum) * 100)
      : 0

  useBeforeUnload(
    (event) => {
      if (!dirty) return
      event.preventDefault()
    },
    { capture: true },
  )

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setUploadError(null)
    try {
      const uploaded: Pick<ProductImage, 'url' | 'alt_text'>[] = []
      for (const file of Array.from(files)) {
        const result = await uploadImage(file)
        uploaded.push({ url: result.url, alt_text: '' })
      }
      setImages((current) => [...current, ...uploaded])
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : 'تعذّر رفع بعض الصور',
      )
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= images.length) return
    setImages((current) => {
      const copy = [...current]
      const [item] = copy.splice(from, 1)
      if (item) copy.splice(to, 0, item)
      return copy
    })
  }

  const submitHandler = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      category_ids: categoryIds,
      collection_ids: collectionIds,
      images: images.map((img, order) => ({
        url: img.url,
        alt_text: img.alt_text,
        order,
      })),
    })
  })

  const apiError =
    serverError instanceof ApiError ? serverError.message : null

  return (
    <form onSubmit={submitHandler} className="space-y-6 animate-fade-rise">
      {apiError && <Alert tone="error">{apiError}</Alert>}
      {uploadError && <Alert tone="error">{uploadError}</Alert>}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info Section */}
          <Section title="المعلومات الأساسية للعطر">
            <Field id="name" label="اسم العطر / المنتج" error={errors.name?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...form.register('name')}
                  placeholder="مثال: كلوب دي نوي إنتنس مان (Club de Nuit Intense)"
                  className="h-11 rounded-xl text-sm font-bold"
                />
              )}
            </Field>

            <Field
              id="description"
              label="الوصف والمكونات العطرية"
              error={errors.description?.message}
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...form.register('description')}
                  rows={4}
                  placeholder="اكتب وصفاً تفصيلياً لمقدمة وقلب وقاعدة العطر والثبات والفوحان..."
                  className="rounded-xl text-xs sm:text-sm leading-relaxed"
                />
              )}
            </Field>
          </Section>

          {/* Pricing & Discounts Section */}
          <Section title="التسعير والعروض الترويجية">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="price"
                label="سعر البيع الحالي (د.ل)"
                error={errors.price?.message}
              >
                {(field) => (
                  <Input
                    {...field}
                    {...form.register('price')}
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    placeholder="0.00"
                    className="h-11 font-mono text-sm rounded-xl font-bold text-price"
                  />
                )}
              </Field>

              <Field
                id="compare_at_price"
                label="السعر قبل الخصم (اختياري)"
                error={errors.compare_at_price?.message}
              >
                {(field) => (
                  <Input
                    {...field}
                    {...form.register('compare_at_price')}
                    type="number"
                    step="0.01"
                    min="0"
                    dir="ltr"
                    placeholder="0.00"
                    className="h-11 font-mono text-sm rounded-xl text-muted-foreground"
                  />
                )}
              </Field>
            </div>

            {discountPct > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
                <Percent className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  خصم تلقائي بقيمة:{' '}
                  <strong className="font-mono text-sm">{discountPct}%</strong>{' '}
                  (توفير {formatPrice(compareNum - priceNum)})
                </span>
              </div>
            )}
          </Section>

          {/* Images & Media Gallery */}
          <Section title="معرض صور المنتج">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                الصورة الأولى في الترتيب هي صورة الغلاف الرئيسية بالمتجر.
              </p>
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => handleFiles(event.target.files)}
                id="product-images"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                loading={uploading}
                onClick={() => fileInput.current?.click()}
                className="rounded-xl font-bold gap-1.5 h-9 px-3.5 shadow-2xs"
              >
                <Upload className="size-4 text-primary" />
                <span>رفع صور</span>
              </Button>
            </div>

            {images.length > 0 ? (
              <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {images.map((image, index) => (
                  <li
                    key={image.url}
                    draggable
                    onDragStart={() => (dragIndex.current = index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragIndex.current !== null)
                        reorder(dragIndex.current, index)
                      dragIndex.current = null
                    }}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xs"
                  >
                    <img
                      src={image.url}
                      alt=""
                      width={160}
                      height={160}
                      className="aspect-square w-full object-cover"
                    />
                    {index === 0 && (
                      <span className="absolute start-2 top-2 rounded-lg bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground shadow-xs">
                        الغلاف
                      </span>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-card/95 p-1 backdrop-blur-sm border-t border-border">
                      <div className="flex items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg"
                          aria-label="تحريك لليمين"
                          disabled={index === 0}
                          onClick={() => reorder(index, index - 1)}
                        >
                          <ChevronRight className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 rounded-lg"
                          aria-label="تحريك لليسار"
                          disabled={index === images.length - 1}
                          onClick={() => reorder(index, index + 1)}
                        >
                          <ChevronLeft className="size-3.5" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-lg text-destructive hover:bg-destructive/10"
                        aria-label={`حذف الصورة ${index + 1}`}
                        onClick={() =>
                          setImages((c) => c.filter((_, i) => i !== index))
                        }
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
                <Upload className="size-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground font-medium">
                  لم تُضَف صور بعد. انقر على زر رفع صور لإضافة صور العطر.
                </p>
              </div>
            )}
          </Section>

          {/* SEO Meta Section */}
          <Section title="تحسين محركات البحث (SEO)">
            <Field
              id="meta_title"
              label="عنوان الصفحة في جوجل"
              error={errors.meta_title?.message}
            >
              {(field) => (
                <Input
                  {...field}
                  {...form.register('meta_title')}
                  placeholder={watchedName || 'عنوان المنتج...'}
                  className="h-10 rounded-xl text-xs"
                />
              )}
            </Field>
            <Field
              id="meta_description"
              label="الوصف التعريفي للبحث"
              error={errors.meta_description?.message}
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...form.register('meta_description')}
                  rows={2}
                  placeholder={watchedDesc?.slice(0, 150) || 'وصف مختصر لمحركات البحث...'}
                  className="rounded-xl text-xs"
                />
              )}
            </Field>
          </Section>
        </div>

        {/* Sidebar (1 Column) */}
        <div className="space-y-6">
          {/* Status & Visibility Card */}
          <Section title="حالة النشر والظهور">
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3 hover:bg-muted/30 transition-colors">
                <Checkbox
                  id="is_active"
                  checked={form.watch('is_active')}
                  onCheckedChange={(v) =>
                    form.setValue('is_active', Boolean(v), { shouldDirty: true })
                  }
                />
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">
                    منشور في المتجر
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    عند التفعيل يظهر المنتج للعملاء في نتائج البحث والصفحة الرئيسية.
                  </span>
                </div>
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3 hover:bg-muted/30 transition-colors">
                <Checkbox
                  id="track_quantity"
                  checked={form.watch('track_quantity')}
                  onCheckedChange={(v) =>
                    form.setValue('track_quantity', Boolean(v), {
                      shouldDirty: true,
                    })
                  }
                />
                <div className="min-w-0">
                  <span className="block text-xs font-bold text-foreground">
                    تتبّع كميات المخزون
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    إلغاء التفعيل يعني أن المنتج متوفر دائماً دون حد أقصى.
                  </span>
                </div>
              </label>
            </div>
          </Section>

          {/* SKU & Barcode Card */}
          <Section title="الرموز والباركود">
            <Field id="sku" label="رمز المنتج (SKU)" error={errors.sku?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...form.register('sku')}
                  dir="ltr"
                  placeholder="ARM-CDN-105"
                  className="h-10 font-mono text-xs rounded-xl"
                />
              )}
            </Field>

            <Field
              id="barcode"
              label="الباركود الدولي"
              error={errors.barcode?.message}
            >
              {(field) => (
                <Input
                  {...field}
                  {...form.register('barcode')}
                  dir="ltr"
                  placeholder="6294015112345"
                  className="h-10 font-mono text-xs rounded-xl"
                />
              )}
            </Field>
          </Section>

          {/* Categories & Collections Card */}
          <Section title="التصنيفات والماركات">
            <MultiSelect
              label="العلامات والتصنيفات"
              options={(categories.data ?? []).map((c) => ({
                id: c.id,
                label: c.name,
              }))}
              selected={categoryIds}
              onChange={setCategoryIds}
            />

            <div className="border-t border-border pt-4">
              <MultiSelect
                label="المجموعات الترويجية"
                options={(collections.data ?? []).map((c) => ({
                  id: c.id,
                  label: c.name,
                }))}
                selected={collectionIds}
                onChange={setCollectionIds}
              />
            </div>
          </Section>
        </div>
      </div>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-0 z-30 flex items-center justify-between gap-4 rounded-3xl border border-border bg-card/95 p-4 shadow-xl backdrop-blur-md">
        <p className="text-xs font-semibold text-muted-foreground" aria-live="polite">
          {dirty ? '⚠️ لديك تغييرات غير محفوظة' : '✅ جميع البيانات محفوظة'}
        </p>
        <Button
          type="submit"
          size="lg"
          loading={pending || isSubmitting}
          className="rounded-2xl font-extrabold px-8 shadow-md shadow-primary/20 h-11 text-xs sm:text-sm"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4 rounded-3xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
      <h3 className="text-sm sm:text-base font-extrabold text-foreground border-b border-border/80 pb-3">
        {title}
      </h3>
      {children}
    </section>
  )
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-bold text-foreground block">{label}</span>
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">لا توجد خيارات متاحة.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map((option) => {
            const active = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((id) => id !== option.id)
                      : [...selected, option.id],
                  )
                }
                className={cn(
                  'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all shadow-2xs inline-flex items-center gap-1',
                  active
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
                )}
              >
                {active && <Check className="size-3" />}
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
