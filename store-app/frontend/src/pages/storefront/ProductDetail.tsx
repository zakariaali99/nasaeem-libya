import { ShoppingBag, Truck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ErrorState } from '@/components/storefront/ErrorState'
import { Price } from '@/components/storefront/Price'
import { DiscountBadge } from '@/components/storefront/DiscountBadge'
import { ProductGallery } from '@/components/storefront/ProductGallery'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { StockBadge } from '@/components/storefront/StockBadge'
import {
  VariantSelector,
  matchVariant,
  optionGroups,
  type VariantSelection,
} from '@/components/storefront/VariantSelector'
import { QuantityStepper } from '@/components/storefront/QuantityStepper'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { useAddToCart } from '@/lib/queries/cart'
import { useProduct, useProducts } from '@/lib/queries/catalog'
import { rememberViewed } from '@/lib/recentlyViewed'
import { usePageTitle } from '@/lib/usePageTitle'
import type { Product, ProductVariant } from '@/types/api'

export default function ProductDetailPage() {
  const { productSlug = '' } = useParams()
  const { data: product, isPending, isError, error, refetch } = useProduct(productSlug)
  const [selection, setSelection] = useState<VariantSelection>({})

  useEffect(() => {
    if (product?.id) rememberViewed(product.id)
    setSelection({})
  }, [product?.id])

  usePageTitle(
    product?.meta_title || product?.name || 'المنتج',
    product?.meta_description || product?.description?.slice(0, 160),
  )

  if (isPending) return <ProductDetailSkeleton />

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="sr-only">{notFound ? 'المنتج غير موجود' : 'تعذّر تحميل المنتج'}</h1>
        {notFound ? (
          <EmptyState
            title="المنتج غير موجود"
            description="ربما تم حذفه أو تغيّر رابطه."
            action={
              <Button asChild>
                <Link to="/products">تصفّح كل المنتجات</Link>
              </Button>
            }
          />
        ) : (
          <ErrorState error={error} onRetry={() => refetch()} />
        )}
      </div>
    )
  }

  return <ProductView product={product} selection={selection} onSelect={setSelection} />
}

function ProductView({
  product,
  selection,
  onSelect,
}: {
  product: Product
  selection: VariantSelection
  onSelect: (selection: VariantSelection) => void
}) {
  const variants = product.variants ?? []
  const groups = optionGroups(variants)
  const variant = matchVariant(variants, selection, groups)

  // The variant, when one is chosen, is the source of truth for price and
  // stock. Its price may be null, meaning "same as the product".
  const price = variant?.price ?? product.price
  const compareAt = variant?.compare_at_price ?? product.compare_at_price
  const availableStock = variant ? variant.available_stock : product.available_stock
  const inStock = variant ? variant.available_stock > 0 : product.in_stock
  const needsChoice = groups.length > 0 && !variant

  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const addToCart = useAddToCart()
  const max = product.track_quantity ? availableStock : undefined

  // Choosing a different variant changes what is in stock, so the quantity has
  // to come back inside the new ceiling rather than silently exceed it.
  useEffect(() => {
    setQuantity((current) => (max !== undefined ? Math.max(1, Math.min(current, max)) : current))
    setAdded(false)
  }, [max, variant?.id])

  const addLine = () => {
    setAdded(false)
    addToCart.mutate(
      { product_id: product.id, variant_id: variant?.id ?? null, quantity },
      { onSuccess: () => setAdded(true) },
    )
  }

  const canAdd = inStock && !needsChoice && !addToCart.isPending
  const addLabel = needsChoice
    ? `اختر ${groups.map((group) => group.name).join(' و')}`
    : inStock
      ? 'أضف إلى السلة'
      : 'غير متوفر حالياً'

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <nav aria-label="مسار التصفح" className="mb-4 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link to="/" className="hover:text-foreground">
              الرئيسية
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link to="/products" className="hover:text-foreground">
              المنتجات
            </Link>
          </li>
          {product.categories?.[0] ? (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to={`/categories/${encodeURIComponent(product.categories[0].slug)}`}
                  className="hover:text-foreground"
                >
                  {product.categories[0].name}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images ?? []} productName={product.name} />

        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{product.name}</h1>
            {product.sku ? (
              <p className="text-sm text-muted-foreground">
                رمز المنتج: <span className="tabular-nums">{variant?.sku || product.sku}</span>
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Price price={price} compareAtPrice={compareAt} size="lg" />
            <DiscountBadge price={price} compareAtPrice={compareAt} />
          </div>

          <StockBadge
            trackQuantity={product.track_quantity}
            availableStock={availableStock}
            inStock={inStock}
          />

          {variants.length > 0 ? (
            <VariantSelector variants={variants} selection={selection} onChange={onSelect} />
          ) : null}

          {needsChoice ? (
            <p className="text-sm text-muted-foreground" role="status">
              اختر {groups.map((group) => group.name).join(' و')} لعرض السعر والتوفر بدقة.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={max ?? undefined}
              disabled={!inStock || needsChoice}
            />
            <Button size="lg" onClick={addLine} disabled={!canAdd} loading={addToCart.isPending}>
              <ShoppingBag aria-hidden="true" />
              {addLabel}
            </Button>
          </div>

          {added ? (
            <Alert tone="success" role="status">
              تمت الإضافة إلى السلة.{' '}
              <Link to="/cart" className="font-semibold underline">
                عرض السلة
              </Link>
            </Alert>
          ) : null}
          {addToCart.isError ? (
            <Alert tone="error" role="alert">
              {addToCart.error instanceof ApiError
                ? addToCart.error.message
                : 'تعذّرت الإضافة إلى السلة'}
            </Alert>
          ) : null}

          <p className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            <Truck className="size-5 shrink-0" aria-hidden="true" />
            التوصيل إلى جميع المدن الليبية، وتُحتسب رسوم التوصيل حسب المنطقة عند إتمام الطلب.
          </p>
        </div>
      </div>

      {product.description ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold">الوصف</h2>
          <p className="max-w-3xl whitespace-pre-line leading-loose text-foreground">
            {product.description}
          </p>
        </section>
      ) : null}

      <Specs product={product} variant={variant} />
      <RelatedProducts product={product} />

      <ProductJsonLd product={product} price={price} inStock={inStock} />

      {/* Sticky summary on mobile — the price stays reachable while scrolling
          the description. It sits above the bottom navigation. */}
      <div className="fixed inset-x-0 bottom-14 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Price price={price} compareAtPrice={compareAt} />
            <StockBadge
              trackQuantity={product.track_quantity}
              availableStock={availableStock}
              inStock={inStock}
            />
          </div>
          <Button onClick={addLine} disabled={!canAdd} loading={addToCart.isPending}>
            <ShoppingBag aria-hidden="true" />
            {needsChoice ? 'اختر الخيار' : 'أضف إلى السلة'}
          </Button>
        </div>
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
    </div>
  )
}

function Specs({ product, variant }: { product: Product; variant: ProductVariant | null }) {
  const rows = [
    product.barcode ? ['الباركود', product.barcode] : null,
    variant?.sku ? ['رمز الخيار', variant.sku] : null,
    product.categories?.length
      ? ['التصنيف', product.categories.map((category) => category.name).join('، ')]
      : null,
    product.collections?.length
      ? ['المجموعة', product.collections.map((collection) => collection.name).join('، ')]
      : null,
    product.track_quantity ? ['المتوفر', `${formatNumber(product.available_stock)} قطعة`] : null,
  ].filter(Boolean) as [string, string][]

  if (rows.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-bold">المواصفات</h2>
      <dl className="max-w-2xl divide-y divide-border rounded-lg border border-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4 px-4 py-3 text-sm">
            <dt className="w-32 shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 flex-1">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function RelatedProducts({ product }: { product: Product }) {
  const categorySlug = product.categories?.[0]?.slug

  /*
   * Related products sit below the fold, and their request was competing with
   * the LCP image for the browser's connection budget — visible in the network
   * log as three API calls starting in the same 50 ms window as the hero image.
   * Held back until the browser is idle.
   */
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => setReady(true), { timeout: 2000 })
      : window.setTimeout(() => setReady(true), 1200)
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle as number)
      else window.clearTimeout(idle as number)
    }
  }, [])

  const { data } = useProducts(
    { category: categorySlug, limit: 8, sort: 'newest' },
    { enabled: ready && Boolean(categorySlug) },
  )
  const related = useMemo(
    () => (data?.items ?? []).filter((item) => item.id !== product.id).slice(0, 6),
    [data?.items, product.id],
  )

  if (!categorySlug || related.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-bold">منتجات مشابهة</h2>
      <ProductGrid products={related} layout="slider" />
    </section>
  )
}

/**
 * `Product` structured data. The prices come from the same values rendered
 * above, so the rich result cannot disagree with the page.
 */
function ProductJsonLd({
  product,
  price,
  inStock,
}: {
  product: Product
  price: string | null
  inStock: boolean
}) {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    sku: product.sku || undefined,
    // Absolute: a crawler resolving `/media/...` against schema.org's own
    // context, or against a syndicated copy of the page, gets nothing.
    image: (product.images ?? []).map((image) =>
      new URL(image.renditions?.full || image.url, window.location.origin).toString(),
    ),
    brand: product.categories?.[0]
      ? { '@type': 'Brand', name: product.categories[0].name }
      : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'LYD',
      price: price ?? undefined,
      availability: inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: window.location.href,
    },
  }

  return (
    <script
      type="application/ld+json"
      // Serialised data, not markup: JSON.stringify escapes the payload and the
      // script type is never executed as JavaScript.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  )
}

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6" aria-busy="true">
      <span className="sr-only" role="status">
        جارٍ تحميل المنتج…
      </span>
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-11 w-2/3" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  )
}
