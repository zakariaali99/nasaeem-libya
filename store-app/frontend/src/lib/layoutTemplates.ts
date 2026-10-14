/**
 * Starting structures for a new homepage: the order of sections only, no
 * pictures and no invented products. A widget left without its content stays
 * hidden on the storefront, and the builder says what each one is missing.
 *
 * `store` follows the multi-brand shops measured (Faces, Golden Scent, Arabian
 * Oud): a band banner that leaves products visible, brands, new arrivals, offer
 * strips. `brand` follows the single-brand sites (Afnan, Dior): a full-screen
 * banner, a story, best sellers.
 */
export interface TemplateWidget {
  type: string
  data: Record<string, unknown>
  is_active: boolean
  style?: Record<string, string>
}

const edge = { width: 'full', paddingY: 'none' }

export const LAYOUT_TEMPLATES: Record<'store' | 'brand', { label: string; description: string; widgets: TemplateWidget[] }> = {
  store: {
    label: 'قالب متجر',
    description: 'بانر عريض، الماركات، وصل حديثاً، شرائط عروض، الأكثر مبيعاً، الأقسام، المزايا',
    widgets: [
      { type: 'announcement_bar', data: { dismissible: true, icon: 'megaphone' }, is_active: true },
      { type: 'carousel', data: { bannerHeight: 'band', slides: [] }, is_active: true, style: edge },
      { type: 'category_list', data: { title: 'تسوّق حسب العلامة', layout: 'slider' }, is_active: true },
      { type: 'product_list', data: { title: 'وصل حديثاً', actionLabel: 'عرض الكل', actionUrl: '/products' }, is_active: true },
      { type: 'promo_banners', data: { shape: 'strip', items: [] }, is_active: true },
      { type: 'product_list', data: { title: 'الأكثر مبيعاً', actionLabel: 'عرض الكل', actionUrl: '/products' }, is_active: true },
      { type: 'photo_link_grid', data: { title: 'تسوّق حسب القسم', tileStyle: 'image', layout: 'grid', items: [] }, is_active: true },
      { type: 'promo_banners', data: { shape: 'grid', items: [] }, is_active: true },
      { type: 'trust_badges', data: { items: [{ icon: 'shield-check', title: '', subtitle: '' }] }, is_active: true },
    ],
  },
  brand: {
    label: 'قالب ماركة',
    description: 'بانر بملء الشاشة، صورة ونص، الأكثر مبيعاً، شريط عرض، مجموعة مختارة، المزايا',
    widgets: [
      { type: 'carousel', data: { bannerHeight: 'full', slides: [] }, is_active: true, style: edge },
      { type: 'promo_banners', data: { shape: 'editorial', items: [] }, is_active: true },
      { type: 'product_list', data: { title: 'الأكثر مبيعاً', actionLabel: 'عرض الكل', actionUrl: '/products' }, is_active: true },
      { type: 'promo_banners', data: { shape: 'strip', items: [] }, is_active: true },
      { type: 'collection_showcase', data: {}, is_active: true },
      { type: 'trust_badges', data: { items: [{ icon: 'shield-check', title: '', subtitle: '' }] }, is_active: true },
    ],
  },
}
