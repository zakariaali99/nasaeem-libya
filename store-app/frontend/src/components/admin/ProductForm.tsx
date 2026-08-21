import { zodResolver } from '@hookform/resolvers/zod'
import { GripVertical, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useBeforeUnload } from 'react-router-dom'
import { z } from 'zod'

import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ApiError } from '@/lib/api'
import { uploadImage, useCategories, useCollections } from '@/lib/queries/catalog'
import type { Product, ProductImage } from '@/types/api'

const schema = z.object({
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
}).refine(
  (data) => !data.compare_at_price || Number(data.compare_at_price) > Number(data.price),
  { path: ['compare_at_price'], message: 'السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي' },
)

export type ProductFormValues = z.infer<typeof schema>

interface ProductFormProps {
  product?: Product
  submitLabel: string
  pending?: boolean
  serverError?: unknown
  onSubmit: (values: Record<string, unknown>) => Promise<void>
}

/**
 * The most complex form in the app: grouped sections, image upload with
 * reordering, and unsaved-changes protection. `useBeforeUnload` covers a tab
 * close; the router's own blocker covers in-app navigation.
 */
export function ProductForm({ product, submitLabel, pending, serverError, onSubmit }: ProductFormProps) {
  const categories = useCategories()
  const collections = useCollections()

  const [images, setImages] = useState<Pick<ProductImage, 'url' | 'alt_text'>[]>(
    product?.images.map((i) => ({ url: i.url, alt_text: i.alt_text })) ?? [],
  )
  const [categoryIds, setCategoryIds] = useState<string[]>(product?.categories.map((c) => c.id) ?? [])
  const [collectionIds, setCollectionIds] = useState<string[]>(product?.collections.map((c) => c.id) ?? [])
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
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    try {
      for (const file of Array.from(files)) {
        const result = await uploadImage(file)
        setImages((current) => [...current, { url: result.url, alt_text: '' }])
      }
    } catch (error) {
      setUploadError(error instanceof ApiError ? error.message : 'تعذّر رفع الصورة')
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const reorder = (from: number, to: number) => {
    setImages((current) => {
      const next = [...current]
      const [moved] = next.splice(from, 1)
      if (moved) next.splice(to, 0, moved)
      return next
    })
  }

  const submit = form.handleSubmit(async (values) => {
    await onSubmit({
      ...values,
      compare_at_price: values.compare_at_price ? values.compare_at_price : null,
      category_ids: categoryIds,
      collection_ids: collectionIds,
      images,
    })
    form.reset(values)
  })

  const apiError = serverError instanceof ApiError ? serverError : null

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-8">
      {apiError ? (
        <Alert tone="error">
          {apiError.message}
          {apiError.errors ? (
            <ul className="mt-2 space-y-1">
              {Object.entries(apiError.errors).map(([field, messages]) => (
                <li key={field}>• {messages.join('، ')}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Section title="الأساسيات">
        <Field id="name" label="اسم المنتج" error={errors.name?.message}>
          {(field) => <Input {...field} {...form.register('name')} />}
        </Field>
        <Field id="description" label="الوصف" error={errors.description?.message}>
          {(field) => <Textarea {...field} {...form.register('description')} rows={5} />}
        </Field>
      </Section>

      <Section title="التسعير">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="price" label="السعر (د.ل)" error={errors.price?.message}>
            {(field) => (
              <Input {...field} {...form.register('price')} inputMode="decimal" dir="ltr" className="text-start" />
            )}
          </Field>
          <Field
            id="compare_at_price"
            label="السعر قبل الخصم (د.ل)"
            error={errors.compare_at_price?.message}
            hint="اتركه فارغاً إن لم يكن هناك خصم"
          >
            {(field) => (
              <Input
                {...field}
                {...form.register('compare_at_price')}
                inputMode="decimal"
                dir="ltr"
                className="text-start"
              />
            )}
          </Field>
        </div>
      </Section>

      <Section title="الصور">
        {uploadError ? <Alert tone="error">{uploadError}</Alert> : null}
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
          loading={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          رفع صور
        </Button>

        {images.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((image, index) => (
              <li
                key={image.url}
                draggable
                onDragStart={() => (dragIndex.current = index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragIndex.current !== null) reorder(dragIndex.current, index)
                  dragIndex.current = null
                }}
                className="group relative overflow-hidden rounded-md border border-border"
              >
                <img src={image.url} alt="" width={160} height={160} className="aspect-square w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-card/90 p-1">
                  {/* Keyboard equivalents for the drag handle — reordering must
                      not require a mouse. */}
                  <div className="flex">
                    <Button
                      type="button" variant="ghost" size="icon"
                      aria-label={`نقل الصورة ${index + 1} لليمين`}
                      disabled={index === 0}
                      onClick={() => reorder(index, index - 1)}
                    >
                      <GripVertical aria-hidden="true" />
                    </Button>
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon"
                    aria-label={`حذف الصورة ${index + 1}`}
                    onClick={() => setImages((c) => c.filter((_, i) => i !== index))}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">لم تُضَف صور بعد. الصورة الأولى هي صورة الغلاف.</p>
        )}
      </Section>

      <Section title="المخزون والتنظيم">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sku" label="رمز المنتج (SKU)" error={errors.sku?.message}>
            {(field) => <Input {...field} {...form.register('sku')} dir="ltr" className="text-start" />}
          </Field>
          <Field id="barcode" label="الباركود" error={errors.barcode?.message}>
            {(field) => <Input {...field} {...form.register('barcode')} dir="ltr" className="text-start" />}
          </Field>
        </div>

        <CheckboxRow
          id="track_quantity"
          label="تتبّع الكمية"
          hint="عند إيقافه يُعتبر المنتج متوفراً دائماً"
          checked={form.watch('track_quantity')}
          onChange={(value) => form.setValue('track_quantity', value, { shouldDirty: true })}
        />
        <CheckboxRow
          id="is_active"
          label="منشور في المتجر"
          checked={form.watch('is_active')}
          onChange={(value) => form.setValue('is_active', value, { shouldDirty: true })}
        />

        <MultiSelect
          label="التصنيفات"
          options={(categories.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          selected={categoryIds}
          onChange={setCategoryIds}
        />
        <MultiSelect
          label="المجموعات"
          options={(collections.data ?? []).map((c) => ({ id: c.id, label: c.name }))}
          selected={collectionIds}
          onChange={setCollectionIds}
        />
      </Section>

      <Section title="تحسين محركات البحث">
        <Field id="meta_title" label="عنوان الصفحة" error={errors.meta_title?.message}>
          {(field) => <Input {...field} {...form.register('meta_title')} />}
        </Field>
        <Field id="meta_description" label="وصف الصفحة" error={errors.meta_description?.message}>
          {(field) => <Textarea {...field} {...form.register('meta_description')} rows={3} />}
        </Field>
      </Section>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-background py-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? 'لديك تغييرات غير محفوظة' : 'كل التغييرات محفوظة'}
        </p>
        <Button type="submit" size="lg" loading={pending || isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function CheckboxRow({
  id, label, hint, checked, onChange,
}: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={(value) => onChange(Boolean(value))} />
      <div className="pt-3">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  )
}

function MultiSelect({
  label, options, selected, onChange,
}: {
  label: string
  options: { id: string; label: string }[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">{label}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد خيارات بعد.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => {
            const active = selected.includes(option.id)
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id])
                }
                className={
                  active
                    ? 'min-h-11 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground'
                    : 'min-h-11 rounded-full border border-input px-4 text-sm text-muted-foreground hover:bg-muted'
                }
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
