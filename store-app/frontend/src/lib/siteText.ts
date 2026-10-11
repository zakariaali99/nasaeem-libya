import { useStoreSettings } from '@/lib/queries/storeSettings'

/**
 * The storefront's fixed wording, editable from the dashboard
 * (إعدادات المتجر ← نصوص المتجر).
 *
 * Each entry is a line of text that used to be typed into a component. The
 * dashboard stores overrides in `StoreSettings.texts`:
 *
 * - key absent  → the `fallback` below is shown;
 * - empty string → the line is hidden (components skip empty text).
 *
 * To make another line editable: add it here and read it with `useSiteText()`.
 */
export interface SiteTextEntry {
  key: string
  group: string
  label: string
  fallback: string
  multiline?: boolean
}

export const SITE_TEXTS: SiteTextEntry[] = [
  // ---- header -------------------------------------------------------------
  { key: 'header.tagline', group: 'أعلى الصفحة', label: 'السطر الصغير تحت اسم المتجر', fallback: 'عطور فاخرة وأصلية' },
  { key: 'drawer.note', group: 'أعلى الصفحة', label: 'سطر أسفل قائمة التصنيفات الجانبية', fallback: 'توصيل إلى جميع المدن الليبية' },

  // ---- footer -------------------------------------------------------------
  { key: 'footer.trust.1.title', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 1 — العنوان', fallback: 'عطور أصلية' },
  { key: 'footer.trust.1.text', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 1 — السطر التوضيحي', fallback: 'ماركات عالمية' },
  { key: 'footer.trust.2.title', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 2 — العنوان', fallback: 'توصيل لجميع مدن ليبيا' },
  { key: 'footer.trust.2.text', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 2 — السطر التوضيحي', fallback: 'نتفق معك على التوصيل عند تأكيد الطلب' },
  { key: 'footer.trust.3.title', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 3 — العنوان', fallback: 'دفع مريح' },
  { key: 'footer.trust.3.text', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 3 — السطر التوضيحي', fallback: 'عند الاستلام أو بتحويل مصرفي' },
  { key: 'footer.about', group: 'التذييل', label: 'نبذة عن المتجر', multiline: true,
    fallback: 'متجر للعطور والزيوت العطرية وأطقم الهدايا، بالجملة والقطاعي.' },
  { key: 'footer.shop.title', group: 'التذييل', label: 'عنوان عمود روابط المتجر', fallback: 'المتجر والتسوق' },
  { key: 'footer.account.title', group: 'التذييل', label: 'عنوان عمود روابط الحساب', fallback: 'خدمات الحساب' },
  { key: 'footer.rights', group: 'التذييل', label: 'عبارة الحقوق بعد اسم الشركة', fallback: 'جميع الحقوق محفوظة.' },

  // ---- product page -------------------------------------------------------
  { key: 'product.badge.1.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 1 — العنوان', fallback: 'منتج أصلي' },
  { key: 'product.badge.1.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 1 — السطر التوضيحي', fallback: '' },
  { key: 'product.badge.2.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 2 — العنوان', fallback: 'توصيل لكافة المدن' },
  { key: 'product.badge.2.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 2 — السطر التوضيحي', fallback: 'نتفق معك عند تأكيد الطلب' },
  { key: 'product.badge.3.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 3 — العنوان', fallback: 'المعاينة قبل الاستلام' },
  { key: 'product.badge.3.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 3 — السطر التوضيحي', fallback: '' },
  { key: 'product.badge.4.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 4 — العنوان', fallback: 'دفع نقداً أو بتحويل' },
  { key: 'product.badge.4.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 4 — السطر التوضيحي', fallback: '' },

  // ---- catalogue, cart, checkout ------------------------------------------
  { key: 'products.description', group: 'صفحات التسوق', label: 'وصف صفحة «كل المنتجات»', fallback: 'تصفّح كل العطور والزيوت وأطقم الهدايا.' },
  { key: 'cart.secure', group: 'صفحات التسوق', label: 'سطر تحت زر الشراء في السلة', fallback: '' },
  { key: 'checkout.guarantee', group: 'صفحات التسوق', label: 'سطر تحت زر تأكيد الطلب', fallback: '' },
  { key: 'shipping.note', group: 'صفحات التسوق', label: 'ملاحظة التوصيل تحت الإجمالي', multiline: true,
    fallback: 'الإجمالي لا يشمل التوصيل: سنتواصل معك مباشرة لتأكيد الطلب والاتفاق على التوصيل وسعره.' },
  { key: 'order.thanks', group: 'صفحات التسوق', label: 'رسالة الشكر بعد إتمام الطلب', multiline: true,
    fallback: 'شكراً لتسوّقك من متجرنا. سنراجع طلبك ونتواصل معك لتأكيده.' },

  // ---- homepage with no layout --------------------------------------------
  { key: 'home.empty.title', group: 'الصفحة الرئيسية بدون تخطيط', label: 'العنوان', fallback: 'مرحباً بك في متجرنا' },
  { key: 'home.empty.text', group: 'الصفحة الرئيسية بدون تخطيط', label: 'النص', fallback: 'كل المنتجات متاحة للتصفّح الآن.' },
]

const FALLBACKS: Record<string, string> = Object.fromEntries(SITE_TEXTS.map((t) => [t.key, t.fallback]))

/** `t('footer.about')` → the operator's wording, or the built-in one. */
export function useSiteText(): (key: string) => string {
  const { data } = useStoreSettings()
  const overrides = data?.texts
  return (key) => {
    const value = overrides?.[key]
    return typeof value === 'string' ? value : (FALLBACKS[key] ?? '')
  }
}
