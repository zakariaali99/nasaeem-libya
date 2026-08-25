import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState } from '@/components/storefront/EmptyState'
import { ProductGrid } from '@/components/storefront/ProductGrid'
import { WidgetHeading } from '@/components/storefront/widgets/WidgetShell'
import { cn } from '@/lib/utils'
import type { Category, Product, Widget } from '@/types/api'

// Realistic luxury mock items displayed during admin preview when backend items are not loaded
const PREVIEW_PRODUCTS: Product[] = [
  {
    id: 'preview-1',
    name: 'ديور سوفاج إلكسير 60 مل',
    slug: 'dior-sauvage-elixir',
    price: '380.00',
    compare_at_price: '420.00',
    sku: 'DIO-SAUV-ELX-60',
    stock: 15,
    reserved_stock: 0,
    available_stock: 15,
    in_stock: true,
    is_active: true,
    has_variants: false,
    track_quantity: true,
    images: [{ id: 'img-1', url: '/assets/images/perfume_sample.jpg', alt_text: 'ديور سوفاج إلكسير', sort_order: 0, renditions: {} }],
    categories: [],
    collections: [],
    discounts: [],
    discount_percent: 10,
  },
  {
    id: 'preview-2',
    name: 'كريد أفينتوس أو دو بارفيوم 100 مل',
    slug: 'creed-aventus',
    price: '540.00',
    compare_at_price: null,
    sku: 'CRD-AVNT-EDP-100',
    stock: 8,
    reserved_stock: 0,
    available_stock: 8,
    in_stock: true,
    is_active: true,
    has_variants: false,
    track_quantity: true,
    images: [{ id: 'img-2', url: '/assets/images/perfume_sample.jpg', alt_text: 'كريد أفينتوس', sort_order: 0, renditions: {} }],
    categories: [],
    collections: [],
    discounts: [],
    discount_percent: null,
  },
  {
    id: 'preview-3',
    name: 'توم فورد بلاك أوركيد 100 مل',
    slug: 'tom-ford-black-orchid',
    price: '420.00',
    compare_at_price: '460.00',
    sku: 'TF-BLCK-ORC-100',
    stock: 12,
    reserved_stock: 0,
    available_stock: 12,
    in_stock: true,
    is_active: true,
    has_variants: false,
    track_quantity: true,
    images: [{ id: 'img-3', url: '/assets/images/perfume_sample.jpg', alt_text: 'توم فورد بلاك أوركيد', sort_order: 0, renditions: {} }],
    categories: [],
    collections: [],
    discounts: [],
    discount_percent: 8,
  },
  {
    id: 'preview-4',
    name: 'باقة العينات الاستكشافية الملكية (5 عينات)',
    slug: 'royal-discovery-box',
    price: '60.00',
    compare_at_price: '85.00',
    sku: 'DISC-ROYAL-BOX-5',
    stock: 50,
    reserved_stock: 0,
    available_stock: 50,
    in_stock: true,
    is_active: true,
    has_variants: false,
    track_quantity: true,
    images: [{ id: 'img-4', url: '/assets/images/perfume_sample.jpg', alt_text: 'باقة العينات الاستكشافية', sort_order: 0, renditions: {} }],
    categories: [],
    collections: [],
    discounts: [],
    discount_percent: 29,
  },
]

const PREVIEW_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'عطور رجالية فاخرة', slug: 'men-perfumes', image_url: '', is_active: true, is_system: false, description: '', parent: null, children: [] },
  { id: 'cat-2', name: 'عطور نسائية راقية', slug: 'women-perfumes', image_url: '', is_active: true, is_system: false, description: '', parent: null, children: [] },
  { id: 'cat-3', name: 'عطور نيش حصرية', slug: 'niche-perfumes', image_url: '', is_active: true, is_system: false, description: '', parent: null, children: [] },
  { id: 'cat-4', name: 'باقات الهدايا الملكية', slug: 'gift-sets', image_url: '', is_active: true, is_system: false, description: '', parent: null, children: [] },
  { id: 'cat-5', name: 'عطور شرقية وبخور', slug: 'oriental-oud', image_url: '', is_active: true, is_system: false, description: '', parent: null, children: [] },
  { id: 'cat-6', name: 'عينات استكشافية', slug: 'discovery-samples', image_url: '', is_active: true, is_system: false, description: '', parent: null, children: [] },
]

export function ProductListWidget({ widget }: { widget: Widget }) {
  const rawProducts = widget.data.products
  const products = rawProducts && rawProducts.length > 0 ? rawProducts : PREVIEW_PRODUCTS

  return (
    <div className="space-y-4">
      <WidgetHeading
        title={widget.data.title || 'تشكيلة العطور الأكثر طلباً'}
        action={
          <Link
            to="/products"
            className="inline-flex min-h-11 items-center gap-1 text-xs sm:text-sm font-bold text-primary hover:gap-1.5 transition-all px-2"
          >
            <span>عرض التشكيلة كاملة</span>
            <ArrowLeft className="size-4 rtl:rotate-0" />
          </Link>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          title="لا توجد منتجات في هذا القسم"
          description="قد تكون المنتجات المختارة غير متاحة حالياً."
        />
      ) : (
        <ProductGrid products={products} layout={widget.data.layout ?? 'grid'} />
      )}
    </div>
  )
}

export function CollectionShowcase({ widget }: { widget: Widget }) {
  const collection = widget.data.collection || {
    id: 'preview-col',
    name: widget.data.title || 'مجموعة العطور الحصرية',
    slug: 'exclusive-collection',
    description: 'تشكيلة مختارة بعناية من أرقى دور العطور العالمية مع ضمان الأصالة بنسبة 100%.',
  }
  const rawProducts = widget.data.products
  const products = rawProducts && rawProducts.length > 0 ? rawProducts : PREVIEW_PRODUCTS

  return (
    <div className="space-y-4 rounded-3xl border border-border/80 bg-muted/20 p-5 sm:p-8">
      <WidgetHeading
        title={widget.data.title || collection.name}
        action={
          <Link
            to={`/collections/${encodeURIComponent(collection.slug)}`}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
          >
            <span>استكشف المجموعة</span>
            <ArrowLeft className="size-3.5 rtl:rotate-0" />
          </Link>
        }
      />
      {collection.description ? (
        <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground max-w-2xl">{collection.description}</p>
      ) : null}
      <ProductGrid products={products} layout={widget.data.layout ?? 'grid'} />
    </div>
  )
}

export function CategoryListWidget({ widget }: { widget: Widget }) {
  const rawCategories = widget.data.categories
  const categories = rawCategories && rawCategories.length > 0 ? rawCategories : PREVIEW_CATEGORIES

  const slider = widget.data.layout === 'slider'

  return (
    <div className="space-y-4">
      <WidgetHeading
        title={widget.data.title || 'تسوّق حسب التصنيف والمجموعة'}
        action={
          <Link
            to="/products"
            className="inline-flex min-h-11 items-center gap-1 text-xs sm:text-sm font-bold text-primary hover:gap-1.5 transition-all px-2"
          >
            <span>جميع الأقسام</span>
            <ArrowLeft className="size-4 rtl:rotate-0" />
          </Link>
        }
      />
      <ul
        className={cn(
          slider
            ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar'
            : 'grid grid-cols-2 gap-3.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6',
        )}
      >
        {categories.map((category) => (
          <li key={category.id} className={cn(slider && 'w-32 shrink-0 snap-start sm:w-36')}>
            <Link
              to={`/categories/${encodeURIComponent(category.slug)}`}
              className="card-hover group flex h-full flex-col items-center justify-center gap-2.5 rounded-2xl border border-border/80 bg-card p-4 text-center hover:border-primary/50 hover:shadow-md transition-all shadow-2xs"
            >
              {category.image_url ? (
                <div className="flex size-14 sm:size-16 items-center justify-center rounded-xl bg-muted/40 p-2 border border-border/60 group-hover:scale-105 transition-transform">
                  <img
                    src={category.image_url}
                    alt={category.name}
                    width={120}
                    height={120}
                    loading="lazy"
                    className="size-full object-contain"
                  />
                </div>
              ) : (
                <span className="flex size-14 sm:size-16 items-center justify-center rounded-xl bg-primary/10 text-primary text-base font-black border border-primary/20 group-hover:scale-105 transition-transform">
                  {category.name.slice(0, 1)}
                </span>
              )}
              <span className="line-clamp-1 text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                {category.name}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
