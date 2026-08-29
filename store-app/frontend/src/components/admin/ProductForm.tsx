import { zodResolver } from '@hookform/resolvers/zod'
import {
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Percent,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wind,
  X,
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
import { formatPrice, toNumber } from '@/lib/format'
import { uploadImage, useCategories, useCollections } from '@/lib/queries/catalog'
import { cn } from '@/lib/utils'
import type { PerfumeNote, Product, ProductImage } from '@/types/api'

const schema = z
  .object({
    name: z.string().trim().min(2, 'اسم المنتج مطلوب').max(100),
    description: z.string().max(5000).optional(),
    price: z
      .string()
      .min(1, 'السعر مطلوب')
      .refine((v) => toNumber(v) > 0, 'السعر يجب أن يكون أكبر من صفر'),
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
      toNumber(data.compare_at_price) > toNumber(data.price),
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

  // Perfume Details & Olfactory Pyramid States
  const [hasPerfumeDetails, setHasPerfumeDetails] = useState<boolean>(
    product ? Boolean(product?.perfume_details) : true
  )
  const [perfumeGender, setPerfumeGender] = useState<'MEN' | 'WOMEN' | 'UNISEX'>(
    product?.perfume_details?.gender ?? 'UNISEX'
  )
  const [perfumeFamily, setPerfumeFamily] = useState<string>(
    product?.perfume_details?.fragrance_family ?? 'شرقي خشبي فاخر'
  )
  const [perfumeConcentration, setPerfumeConcentration] = useState<string>(
    product?.perfume_details?.concentration ?? 'Eau de Parfum'
  )
  const [perfumeOrigin, setPerfumeOrigin] = useState<string>(
    product?.perfume_details?.origin_country ?? 'فرنسا'
  )
  const [topNotes, setTopNotes] = useState<PerfumeNote[]>(
    product?.perfume_details?.top_notes ?? []
  )
  const [heartNotes, setHeartNotes] = useState<PerfumeNote[]>(
    product?.perfume_details?.heart_notes ?? []
  )
  const [baseNotes, setBaseNotes] = useState<PerfumeNote[]>(
    product?.perfume_details?.base_notes ?? []
  )
  const [longevityScore, setLongevityScore] = useState<number>(
    product?.perfume_details?.longevity_score ?? 4
  )
  const [longevityHours, setLongevityHours] = useState<string>(
    product?.perfume_details?.longevity_hours ?? '12 إلى 18 ساعة'
  )
  const [sillageScore, setSillageScore] = useState<number>(
    product?.perfume_details?.sillage_score ?? 4
  )
  const [selectedSeasons, setSelectedSeasons] = useState<string[]>(
    product?.perfume_details?.seasons ?? ['winter', 'autumn']
  )
  const [selectedOccasions, setSelectedOccasions] = useState<string[]>(
    product?.perfume_details?.occasions ?? ['formal', 'evening']
  )

  const [topInput, setTopInput] = useState('')
  const [heartInput, setHeartInput] = useState('')
  const [baseInput, setBaseInput] = useState('')

  // Perfume Sizes & Volumes States
  const [hasMultipleSizes, setHasMultipleSizes] = useState<boolean>(() => {
    return Boolean(product?.variants && product.variants.length > 0)
  })
  const [sizes, setSizes] = useState<
    {
      id?: string
      size: string
      price: string
      compare_at_price: string
      stock: number
      sku: string
      is_active: boolean
    }[]
  >(() => {
    if (product?.variants && product.variants.length > 0) {
      return product.variants.map((v) => ({
        id: v.id,
        size: v.values?.map((val) => val.value).join(' / ') || v.sku || 'حجم',
        price: v.price || product.price || '',
        compare_at_price: v.compare_at_price || '',
        stock: v.stock ?? 0,
        sku: v.sku || '',
        is_active: v.is_active ?? true,
      }))
    }
    return []
  })
  const [customSizeInput, setCustomSizeInput] = useState('')

  const PRESET_SIZES = ['30 مل', '50 مل', '75 مل', '100 مل', '125 مل', '150 مل', '200 مل', '250 مل']

  const addSize = (sizeName: string) => {
    const trimmed = sizeName.trim()
    if (!trimmed) return
    if (sizes.some((s) => s.size === trimmed)) return
    const currentPrice = form.getValues('price') || ''
    const currentCompare = form.getValues('compare_at_price') || ''
    const baseSku = form.getValues('sku') || 'NAS'
    const cleanSizeSlug = trimmed.replace(/\s+/g, '')
    setSizes((prev) => [
      ...prev,
      {
        size: trimmed,
        price: currentPrice,
        compare_at_price: currentCompare,
        stock: 10,
        sku: `${baseSku}-${cleanSizeSlug}`,
        is_active: true,
      },
    ])
  }

  const removeSize = (index: number) => {
    setSizes((prev) => prev.filter((_, i) => i !== index))
  }

  const updateSizeField = (
    index: number,
    field: 'size' | 'price' | 'compare_at_price' | 'stock' | 'sku' | 'is_active',
    value: any,
  ) => {
    setSizes((prev) => {
      const copy = [...prev]
      const currentItem = copy[index]
      if (currentItem) {
        copy[index] = {
          size: field === 'size' ? String(value) : currentItem.size,
          price: field === 'price' ? String(value) : currentItem.price,
          compare_at_price: field === 'compare_at_price' ? String(value) : currentItem.compare_at_price,
          stock: field === 'stock' ? Number(value) || 0 : currentItem.stock,
          sku: field === 'sku' ? String(value) : currentItem.sku,
          is_active: field === 'is_active' ? Boolean(value) : currentItem.is_active,
          id: currentItem.id,
        }
      }
      return copy
    })
  }

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

  // Sync form and component states when the product prop changes
  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name ?? '',
        description: product.description ?? '',
        price: product.price ?? '',
        compare_at_price: product.compare_at_price ?? '',
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        meta_title: product.meta_title ?? '',
        meta_description: product.meta_description ?? '',
        is_active: product.is_active ?? true,
        track_quantity: product.track_quantity ?? true,
      })
      setImages(
        product.images?.map((img) => ({ url: img.url, alt_text: img.alt_text })) ?? [],
      )
      setCategoryIds(product.categories?.map((c) => c.id) ?? [])
      setCollectionIds(product.collections?.map((c) => c.id) ?? [])
      if (product.perfume_details) {
        setHasPerfumeDetails(true)
        setPerfumeFamily(product.perfume_details.fragrance_family ?? 'شرقي خشبي فاخر')
        setPerfumeGender(product.perfume_details.gender ?? 'UNISEX')
        setPerfumeConcentration(product.perfume_details.concentration ?? 'Eau de Parfum')
        setPerfumeOrigin(product.perfume_details.origin_country ?? 'فرنسا')
        setTopNotes(product.perfume_details.top_notes ?? [])
        setHeartNotes(product.perfume_details.heart_notes ?? [])
        setBaseNotes(product.perfume_details.base_notes ?? [])
        setLongevityScore(product.perfume_details.longevity_score ?? 4)
        setLongevityHours(product.perfume_details.longevity_hours ?? '12 إلى 18 ساعة')
        setSillageScore(product.perfume_details.sillage_score ?? 4)
        setSelectedSeasons(product.perfume_details.seasons ?? ['winter', 'autumn'])
        setSelectedOccasions(product.perfume_details.occasions ?? ['formal', 'evening'])
      }
      if (product.variants && product.variants.length > 0) {
        setHasMultipleSizes(true)
        setSizes(
          product.variants.map((v) => ({
            id: v.id,
            size: v.values?.map((val) => val.value).join(' / ') || v.sku || 'حجم',
            price: v.price || product.price || '',
            compare_at_price: v.compare_at_price || '',
            stock: v.stock ?? 0,
            sku: v.sku || '',
            is_active: v.is_active ?? true,
          }))
        )
      } else {
        setHasMultipleSizes(false)
        setSizes([])
      }
    }
  }, [product, form])

  // Auto sync lowest active size price to form price
  useEffect(() => {
    if (hasMultipleSizes && sizes.length > 0) {
      const activeSizes = sizes.filter((s) => s.is_active)
      const validPrices = (activeSizes.length > 0 ? activeSizes : sizes)
        .map((s) => parseFloat(s.price) || 0)
        .filter((p) => p > 0)
      if (validPrices.length > 0) {
        const minP = Math.min(...validPrices)
        form.setValue('price', String(minP), { shouldValidate: true })
      }
    }
  }, [sizes, hasMultipleSizes, form])

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
    if (!files?.length) return
    setUploading(true)
    setUploadError(null)
    try {
      const remainingSlots = 10 - images.length
      if (remainingSlots <= 0) {
        throw new Error('الحد الأقصى لصور المنتج هو 10 صور')
      }
      const filesToUpload = Array.from(files).slice(0, remainingSlots)
      const uploaded = await Promise.all(
        filesToUpload.map(async (f) => {
          const res = await uploadImage(f)
          return { url: res.url, alt_text: form.getValues('name') || 'عطر' }
        }),
      )
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
    const cleanNum = (v: string | undefined | null) => {
      if (!v) return ''
      let s = String(v).trim()
      s = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      return s.replace(/،/g, '.').replace(/,/g, '.')
    }

    const cleanedPrice = cleanNum(values.price)
    const cleanedCompare = cleanNum(values.compare_at_price) || null

    let effectivePrice = cleanedPrice
    let effectiveCompare = cleanedCompare

    if (hasMultipleSizes && sizes.length > 0) {
      const activeSizes = sizes.filter((s) => s.is_active)
      const validPrices = (activeSizes.length > 0 ? activeSizes : sizes)
        .map((s) => parseFloat(cleanNum(s.price)) || 0)
        .filter((p) => p > 0)

      if (validPrices.length > 0) {
        effectivePrice = String(Math.min(...validPrices))
      }
    }

    await onSubmit({
      ...values,
      price: effectivePrice,
      compare_at_price: effectiveCompare,
      has_variants: hasMultipleSizes && sizes.length > 0,
      sizes: hasMultipleSizes && sizes.length > 0
        ? sizes.map((s) => ({
            size: s.size,
            price: cleanNum(s.price) || effectivePrice,
            compare_at_price: cleanNum(s.compare_at_price) || null,
            stock: Number(s.stock) || 0,
            sku: s.sku,
            is_active: s.is_active,
          }))
        : null,
      category_ids: categoryIds,
      collection_ids: collectionIds,
      images: images.map((img, order) => ({
        url: img.url,
        alt_text: img.alt_text,
        order,
      })),
      perfume_details: hasPerfumeDetails
        ? {
            gender: perfumeGender,
            fragrance_family: perfumeFamily,
            concentration: perfumeConcentration,
            origin_country: perfumeOrigin,
            top_notes: topNotes,
            heart_notes: heartNotes,
            base_notes: baseNotes,
            longevity_score: longevityScore,
            longevity_hours: longevityHours,
            sillage_score: sillageScore,
            seasons: selectedSeasons,
            occasions: selectedOccasions,
          }
        : null,
    })
  })

  const FIELD_LABELS: Record<string, string> = {
    name: 'اسم المنتج',
    price: 'السعر',
    compare_at_price: 'السعر قبل الخصم',
    sku: 'رمز المنتج SKU',
    barcode: 'الباركود',
    images: 'الصور',
    category_ids: 'التصنيفات',
    collection_ids: 'المجموعات',
  }

  const apiError = serverError instanceof ApiError
    ? serverError.errors && Object.keys(serverError.errors).length > 0
      ? `${serverError.message}: ${Object.entries(serverError.errors)
          .map(([f, msgs]) => `${FIELD_LABELS[f] || f} (${msgs.join(', ')})`)
          .join(' | ')}`
      : serverError.message
    : null

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

          {/* Perfume Attributes & Pyramid Section */}
          <Section title="مواصفات وهرم العطر الحسي">
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  تفعيل بيانات وهرم العطر التفصيلي
                </span>
                <p className="text-xs text-muted-foreground">
                  عند التفعيل، يعرض المتجر هرم النوتات ومؤشرات الثبات والفوحان الحقيقية في صفحة العطر.
                </p>
              </div>
              <Checkbox
                id="has_perfume_details"
                checked={hasPerfumeDetails}
                onCheckedChange={(v) => setHasPerfumeDetails(Boolean(v))}
              />
            </div>

            {hasPerfumeDetails && (
              <div className="space-y-6 pt-2 animate-fade-rise">
                {/* Gender / Target Group */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground block">
                    الفئة المستهدفة (الجنس) *
                  </label>
                  <div className="grid grid-cols-3 gap-2 sm:gap-3">
                    {[
                      { value: 'MEN', label: 'عطر رجالي', emoji: '🧔‍♂️' },
                      { value: 'WOMEN', label: 'عطر نسائي', emoji: '🧕' },
                      { value: 'UNISEX', label: 'للجنسين (محايد)', emoji: '✨' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPerfumeGender(opt.value as any)}
                        className={cn(
                          'flex items-center justify-center gap-2 p-3 rounded-2xl border text-xs font-bold transition-all',
                          perfumeGender === opt.value
                            ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary'
                            : 'border-border bg-card text-muted-foreground hover:border-border/80 hover:text-foreground'
                        )}
                      >
                        <span className="text-base">{opt.emoji}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fragrance Family, Concentration & Origin Country */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">العائلة العطرية</label>
                    <Input
                      value={perfumeFamily}
                      onChange={(e) => setPerfumeFamily(e.target.value)}
                      placeholder="شرقي خشبي، زهري فاخر..."
                      className="h-10 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">درجة التركيز</label>
                    <select
                      value={perfumeConcentration}
                      onChange={(e) => setPerfumeConcentration(e.target.value)}
                      className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="Parfum Extrait">Parfum Extrait (خلاصة العطر)</option>
                      <option value="Eau de Parfum">Eau de Parfum (EDP)</option>
                      <option value="Eau de Toilette">Eau de Toilette (EDT)</option>
                      <option value="Eau de Cologne">Eau de Cologne</option>
                      <option value="معطر شعر وجسم">معطر شعر وجسم</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">بلد المنشأ</label>
                    <Input
                      value={perfumeOrigin}
                      onChange={(e) => setPerfumeOrigin(e.target.value)}
                      placeholder="فرنسا، إيطاليا، عُمان، الإمارات..."
                      className="h-10 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Olfactory Pyramid Builders */}
                <div className="space-y-4 rounded-2xl border border-border/80 bg-card/60 p-4">
                  <h4 className="font-bold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                    <span>الهرم العطري التفاعلي</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      (أضف النوتات الفردية لكل مستوى من مستويات العطر)
                    </span>
                  </h4>

                  {/* Top Notes */}
                  <div className="space-y-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        1. قمة العطر (الافتتاحية - أول 15 دقيقة)
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {topNotes.length} نوتات
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 min-h-7">
                      {topNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-200"
                        >
                          <span>{note.name}</span>
                          <button
                            type="button"
                            onClick={() => setTopNotes(topNotes.filter((_, i) => i !== idx))}
                            className="hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={topInput}
                        onChange={(e) => setTopInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (topInput.trim()) {
                              setTopNotes([...topNotes, { name: topInput.trim() }])
                              setTopInput('')
                            }
                          }
                        }}
                        placeholder="اكتب اسم النوتة ثم اضغط إضافة (مثال: برغموت إيطالي)..."
                        className="h-8 text-xs rounded-lg"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (topInput.trim()) {
                            setTopNotes([...topNotes, { name: topInput.trim() }])
                            setTopInput('')
                          }
                        }}
                        className="h-8 px-3 rounded-lg text-xs font-bold shrink-0"
                      >
                        <Plus className="size-3.5 me-1" />
                        إضافة
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-[10px]">اقتراحات سريعة:</span>
                      {['برغموت', 'فلفل وردي', 'حمضيات صقلية', 'زعفران', 'تفاح أخضر'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (!topNotes.some((n) => n.name === s)) {
                              setTopNotes([...topNotes, { name: s }])
                            }
                          }}
                          className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] hover:border-primary hover:text-primary transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Heart Notes */}
                  <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                        2. قلب العطر (الجوهر - من ساعتين إلى 4 ساعات)
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {heartNotes.length} نوتات
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 min-h-7">
                      {heartNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-500/20 px-2 py-0.5 text-xs font-bold text-rose-800 dark:text-rose-200"
                        >
                          <span>{note.name}</span>
                          <button
                            type="button"
                            onClick={() => setHeartNotes(heartNotes.filter((_, i) => i !== idx))}
                            className="hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={heartInput}
                        onChange={(e) => setHeartInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (heartInput.trim()) {
                              setHeartNotes([...heartNotes, { name: heartInput.trim() }])
                              setHeartInput('')
                            }
                          }
                        }}
                        placeholder="اسم نوتة قلب العطر (مثال: ورد دمشقي، ياسمين هندي)..."
                        className="h-8 text-xs rounded-lg"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (heartInput.trim()) {
                            setHeartNotes([...heartNotes, { name: heartInput.trim() }])
                            setHeartInput('')
                          }
                        }}
                        className="h-8 px-3 rounded-lg text-xs font-bold shrink-0"
                      >
                        <Plus className="size-3.5 me-1" />
                        إضافة
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-[10px]">اقتراحات سريعة:</span>
                      {['ورد جوري دمشقي', 'ياسمين سامباك', 'حبوب الهيل', 'لافندر فرنسي', 'قرفة سيلانية'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (!heartNotes.some((n) => n.name === s)) {
                              setHeartNotes([...heartNotes, { name: s }])
                            }
                          }}
                          className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] hover:border-primary hover:text-primary transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Base Notes */}
                  <div className="space-y-2 rounded-xl border border-amber-900/20 bg-amber-900/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        3. قاعدة العطر (الثبات والعمق - أطول أثر عتري)
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {baseNotes.length} نوتات
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 min-h-7">
                      {baseNotes.map((note, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-900/20 px-2 py-0.5 text-xs font-bold text-amber-900 dark:text-amber-100"
                        >
                          <span>{note.name}</span>
                          <button
                            type="button"
                            onClick={() => setBaseNotes(baseNotes.filter((_, i) => i !== idx))}
                            className="hover:text-destructive"
                          >
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={baseInput}
                        onChange={(e) => setBaseInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            if (baseInput.trim()) {
                              setBaseNotes([...baseNotes, { name: baseInput.trim() }])
                              setBaseInput('')
                            }
                          }
                        }}
                        placeholder="اسم نوتة قاعدة العطر (مثال: عود كمبودي، عنبر ملكي)..."
                        className="h-8 text-xs rounded-lg"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (baseInput.trim()) {
                            setBaseNotes([...baseNotes, { name: baseInput.trim() }])
                            setBaseInput('')
                          }
                        }}
                        className="h-8 px-3 rounded-lg text-xs font-bold shrink-0"
                      >
                        <Plus className="size-3.5 me-1" />
                        إضافة
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-[10px]">اقتراحات سريعة:</span>
                      {['عود كمبودي معتق', 'عنبر ملكي', 'مسك أبيض فاخر', 'خشب الصندل', 'فانيليا مدغشقر', 'حبوب التونكا'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            if (!baseNotes.some((n) => n.name === s)) {
                              setBaseNotes([...baseNotes, { name: s }])
                            }
                          }}
                          className="rounded-md border border-border/80 bg-background/80 px-1.5 py-0.5 text-[10px] hover:border-primary hover:text-primary transition-colors"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Longevity & Sillage Performance */}
                <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-border/80 bg-card p-4">
                  {/* Longevity */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5 text-primary" />
                        درجة الثبات (من 1 إلى 5)
                      </label>
                      <span className="font-mono text-xs font-bold text-primary">
                        {longevityScore} / 5
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setLongevityScore(score)}
                          className={cn(
                            'h-9 rounded-xl text-xs font-bold border transition-all',
                            longevityScore === score
                              ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                          )}
                        >
                          ★ {score}
                        </button>
                      ))}
                    </div>
                    <div className="pt-1.5">
                      <label className="text-[11px] text-muted-foreground block mb-1">
                        مدة الثبات التقريبية
                      </label>
                      <Input
                        value={longevityHours}
                        onChange={(e) => setLongevityHours(e.target.value)}
                        placeholder="مثال: 12 إلى 18 ساعة، يدوم حتى يومين..."
                        className="h-9 rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  {/* Sillage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Wind className="size-3.5 text-primary" />
                        قوة الفوحان وانتشار الأثر
                      </label>
                      <span className="font-mono text-xs font-bold text-primary">
                        {sillageScore} / 5
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setSillageScore(score)}
                          className={cn(
                            'h-9 rounded-xl text-xs font-bold border transition-all',
                            sillageScore === score
                              ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                              : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
                          )}
                        >
                          ★ {score}
                        </button>
                      ))}
                    </div>
                    <div className="pt-2 text-[11px] text-muted-foreground">
                      {sillageScore <= 2 && 'فوحان خفيف حميمي (على مسافة قريبة)'}
                      {sillageScore === 3 && 'فوحان متوسط متوازن (يملأ محيط الشخص)'}
                      {sillageScore >= 4 && 'فوحان هائل فواح يترك أثراً واضحاً في المكان'}
                    </div>
                  </div>
                </div>

                {/* Seasons & Occasions */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">الفصول الموصى بها</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'winter', label: 'شتاء ❄️' },
                        { key: 'autumn', label: 'خريف 🍂' },
                        { key: 'spring', label: 'ربيع 🌸' },
                        { key: 'summer', label: 'صيف ☀️' },
                      ].map((s) => {
                        const active = selectedSeasons.includes(s.key)
                        return (
                          <button
                            key={s.key}
                            type="button"
                            onClick={() =>
                              setSelectedSeasons(
                                active
                                  ? selectedSeasons.filter((k) => k !== s.key)
                                  : [...selectedSeasons, s.key]
                              )
                            }
                            className={cn(
                              'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                              active
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                            )}
                          >
                            {s.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-foreground">المناسبات الملائمة</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: 'formal', label: 'لقاءات رسمية 👔' },
                        { key: 'evening', label: 'سهرات ومساء 🌙' },
                        { key: 'daily', label: 'استخدام يومي 💼' },
                        { key: 'special_dates', label: 'أعراس واحتفالات 💍' },
                      ].map((o) => {
                        const active = selectedOccasions.includes(o.key)
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() =>
                              setSelectedOccasions(
                                active
                                  ? selectedOccasions.filter((k) => k !== o.key)
                                  : [...selectedOccasions, o.key]
                              )
                            }
                            className={cn(
                              'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                              active
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                            )}
                          >
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Section>

          {/* Perfume Sizes & Volumes Section */}
          <Section title="سعات وأحجام العطر والأسعار (السعات بالـ مل)">
            <div className="flex items-center justify-between p-3.5 rounded-2xl border border-border/80 bg-muted/20">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Boxes className="size-4 text-primary" />
                  تفعيل أحجام وسعات متعددة للعطر (خيارات البيع بالـ مل)
                </span>
                <p className="text-xs text-muted-foreground">
                  أضف سعات العطر المتوفرة (مثل: 50 مل، 100 مل، 200 مل) مع تحديد سعر ومخزون كل سعة بشكل مستقل.
                </p>
              </div>
              <Checkbox
                id="has_multiple_sizes"
                checked={hasMultipleSizes}
                onCheckedChange={(v) => {
                  const enabled = Boolean(v)
                  setHasMultipleSizes(enabled)
                  if (enabled && sizes.length === 0) {
                    addSize('50 مل')
                    addSize('100 مل')
                  }
                }}
              />
            </div>

            {hasMultipleSizes && (
              <div className="space-y-4 pt-2 animate-fade-rise">
                {/* Preset Quick Chips */}
                <div className="space-y-2 rounded-2xl border border-border/80 bg-card/60 p-4">
                  <span className="text-xs font-bold text-foreground block">
                    اختيار سريع لسعات العطور الشائعة (انقر للإضافة الفورية):
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_SIZES.map((preset) => {
                      const exists = sizes.some((s) => s.size === preset)
                      return (
                        <button
                          key={preset}
                          type="button"
                          disabled={exists}
                          onClick={() => addSize(preset)}
                          className={cn(
                            'rounded-xl border px-3 py-1.5 text-xs font-bold transition-all',
                            exists
                              ? 'border-primary/40 bg-primary/10 text-primary opacity-60 cursor-default'
                              : 'border-border bg-background hover:border-primary hover:text-primary shadow-2xs'
                          )}
                        >
                          {exists ? `✓ ${preset}` : `+ ${preset}`}
                        </button>
                      )
                    })}
                  </div>

                  {/* Custom Size Input */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Input
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (customSizeInput.trim()) {
                            addSize(customSizeInput.trim())
                            setCustomSizeInput('')
                          }
                        }
                      }}
                      placeholder="أو اكتب سعة مخصصة (مثال: 70 مل، ربع تولة، عينة 10 مل)..."
                      className="h-9 text-xs rounded-xl flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (customSizeInput.trim()) {
                          addSize(customSizeInput.trim())
                          setCustomSizeInput('')
                        }
                      }}
                      className="h-9 px-4 rounded-xl text-xs font-bold shrink-0 shadow-2xs"
                    >
                      <Plus className="size-3.5 me-1" />
                      إضافة السعة
                    </Button>
                  </div>
                </div>

                {/* Sizes Table */}
                {sizes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    لم تقم بإضافة أي سعات بعد. انقر على أحد أزرار السعات أعلاه للبدء.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-2xs">
                    <table className="w-full text-start text-xs">
                      <thead className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                        <tr>
                          <th className="p-3 text-start">السعة / الحجم</th>
                          <th className="p-3 text-start">السعر الحالي (د.ل) *</th>
                          <th className="p-3 text-start">السعر قبل الخصم (اختياري)</th>
                          <th className="p-3 text-start">المخزون (قطعة)</th>
                          <th className="p-3 text-start">رمز SKU</th>
                          <th className="p-3 text-center">الحالة</th>
                          <th className="p-3 text-end">إزالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {sizes.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-bold text-foreground">
                              <Input
                                value={item.size}
                                onChange={(e) => updateSizeField(idx, 'size', e.target.value)}
                                className="h-8 text-xs font-bold w-24 rounded-lg"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                dir="ltr"
                                value={item.price}
                                onChange={(e) => updateSizeField(idx, 'price', e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-xs font-mono font-bold w-28 text-price rounded-lg"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                dir="ltr"
                                value={item.compare_at_price || ''}
                                onChange={(e) => updateSizeField(idx, 'compare_at_price', e.target.value)}
                                placeholder="0.00"
                                className="h-8 text-xs font-mono text-muted-foreground w-28 rounded-lg"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min="0"
                                dir="ltr"
                                value={item.stock}
                                onChange={(e) => updateSizeField(idx, 'stock', Number(e.target.value) || 0)}
                                className="h-8 text-xs font-mono font-bold w-20 rounded-lg text-center"
                              />
                            </td>
                            <td className="p-3">
                              <Input
                                dir="ltr"
                                value={item.sku}
                                onChange={(e) => updateSizeField(idx, 'sku', e.target.value)}
                                placeholder="SKU-..."
                                className="h-8 text-xs font-mono w-28 rounded-lg"
                              />
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => updateSizeField(idx, 'is_active', !item.is_active)}
                                className={cn(
                                  'px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors',
                                  item.is_active
                                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                    : 'bg-muted text-muted-foreground border-border'
                                )}
                              >
                                {item.is_active ? 'مفعل' : 'معطل'}
                              </button>
                            </td>
                            <td className="p-3 text-end">
                              <button
                                type="button"
                                onClick={() => removeSize(idx)}
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                title="إزالة هذا الحجم"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-primary font-medium flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0" />
                  <span>
                    عند حفظ المنتج، يتم تحديث السعر المعروض في واجهة المتجر تلقائياً ليعكس أقل سعر سعة مفعّلة، كما يظهر للمشتري محدد السعات لاختيار حجم العطر المناسب قبل الشراء.
                  </span>
                </div>
              </div>
            )}
          </Section>

          {/* Pricing & Discounts Section */}
          <Section title="التسعير والعروض الترويجية">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="price"
                label="سعر البيع الحالي (د.ل)"
                hint="سعر الشراء النهائي الذي يدفعه الزبون عند الطلب (مثال: 150)"
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
                hint="السعر القديم المشطوب قبل التخفيض، اتركه فارغاً إذا لم يكن هناك خصم (مثال: 200)"
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
                accept="image/*,.heic,.heif,.avif,.webp,.jpg,.jpeg,.png"
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
                      className="aspect-square w-full object-contain p-2 bg-white dark:bg-card/40"
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
