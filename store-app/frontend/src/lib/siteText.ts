import { isEnglish } from '@/lib/i18n'
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
 * The English wording of a line is stored under `en:<key>`, with the same rules.
 *
 * To make another line editable: add it here and read it with `useSiteText()`.
 */
export interface SiteTextEntry {
  key: string
  group: string
  label: string
  fallback: string
  /** The built-in English wording, shown on `/en/` pages. */
  fallbackEn: string
  multiline?: boolean
}

export const SITE_TEXTS: SiteTextEntry[] = [
  // ---- header -------------------------------------------------------------
  { key: 'header.tagline', group: 'أعلى الصفحة', label: 'السطر الصغير تحت اسم المتجر', fallback: 'عطور فاخرة وأصلية', fallbackEn: 'Genuine luxury perfumes' },
  { key: 'drawer.note', group: 'أعلى الصفحة', label: 'سطر أسفل قائمة التصنيفات الجانبية', fallback: 'توصيل إلى جميع المدن الليبية', fallbackEn: 'Delivery to every city in Libya' },

  // ---- footer -------------------------------------------------------------
  { key: 'footer.trust.1.title', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 1 — العنوان', fallback: 'عطور أصلية', fallbackEn: 'Genuine perfumes' },
  { key: 'footer.trust.1.text', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 1 — السطر التوضيحي', fallback: 'ماركات عالمية', fallbackEn: 'World-class brands' },
  { key: 'footer.trust.2.title', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 2 — العنوان', fallback: 'توصيل لجميع مدن ليبيا', fallbackEn: 'Delivery across Libya' },
  { key: 'footer.trust.2.text', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 2 — السطر التوضيحي', fallback: 'نتفق معك على التوصيل عند تأكيد الطلب', fallbackEn: 'We agree on delivery with you when we confirm the order' },
  { key: 'footer.trust.3.title', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 3 — العنوان', fallback: 'دفع مريح', fallbackEn: 'Easy payment' },
  { key: 'footer.trust.3.text', group: 'شريط المزايا (أسفل كل صفحة)', label: 'الميزة 3 — السطر التوضيحي', fallback: 'عند الاستلام أو بتحويل مصرفي', fallbackEn: 'Cash on delivery or bank transfer' },
  { key: 'footer.about', group: 'التذييل', label: 'نبذة عن المتجر', multiline: true,
    fallback: 'متجر للعطور والزيوت العطرية وأطقم الهدايا، بالجملة والقطاعي.', fallbackEn: 'Perfumes, perfume oils and gift sets — wholesale and retail.' },
  { key: 'footer.shop.title', group: 'التذييل', label: 'عنوان عمود روابط المتجر', fallback: 'المتجر والتسوق', fallbackEn: 'Shop' },
  { key: 'footer.account.title', group: 'التذييل', label: 'عنوان عمود روابط الحساب', fallback: 'خدمات الحساب', fallbackEn: 'Your account' },
  { key: 'footer.rights', group: 'التذييل', label: 'عبارة الحقوق بعد اسم الشركة', fallback: 'جميع الحقوق محفوظة.', fallbackEn: 'All rights reserved.' },

  // ---- product page -------------------------------------------------------
  { key: 'product.badge.1.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 1 — العنوان', fallback: 'منتج أصلي', fallbackEn: 'Genuine product' },
  { key: 'product.badge.1.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 1 — السطر التوضيحي', fallback: '', fallbackEn: '' },
  { key: 'product.badge.2.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 2 — العنوان', fallback: 'توصيل لكافة المدن', fallbackEn: 'Delivery to every city' },
  { key: 'product.badge.2.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 2 — السطر التوضيحي', fallback: 'نتفق معك عند تأكيد الطلب', fallbackEn: 'We agree on it when we confirm the order' },
  { key: 'product.badge.3.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 3 — العنوان', fallback: 'المعاينة قبل الاستلام', fallbackEn: 'Check before you accept' },
  { key: 'product.badge.3.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 3 — السطر التوضيحي', fallback: '', fallbackEn: '' },
  { key: 'product.badge.4.title', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 4 — العنوان', fallback: 'دفع نقداً أو بتحويل', fallbackEn: 'Pay cash or by transfer' },
  { key: 'product.badge.4.text', group: 'صفحة المنتج — المزايا الأربع', label: 'الميزة 4 — السطر التوضيحي', fallback: '', fallbackEn: '' },

  // ---- catalogue, cart, checkout ------------------------------------------
  { key: 'products.description', group: 'صفحات التسوق', label: 'وصف صفحة «كل المنتجات»', fallback: 'تصفّح كل العطور والزيوت وأطقم الهدايا.', fallbackEn: 'Browse every perfume, perfume oil and gift set.' },
  { key: 'cart.secure', group: 'صفحات التسوق', label: 'سطر تحت زر الشراء في السلة', fallback: '', fallbackEn: '' },
  { key: 'checkout.guarantee', group: 'صفحات التسوق', label: 'سطر تحت زر تأكيد الطلب', fallback: '', fallbackEn: '' },
  { key: 'shipping.note', group: 'صفحات التسوق', label: 'ملاحظة التوصيل تحت الإجمالي', multiline: true,
    fallback: 'الإجمالي لا يشمل التوصيل: سنتواصل معك مباشرة لتأكيد الطلب والاتفاق على التوصيل وسعره.', fallbackEn: 'The total does not include delivery: we will contact you directly to confirm the order and agree on delivery and its price.' },
  { key: 'order.thanks', group: 'صفحات التسوق', label: 'رسالة الشكر بعد إتمام الطلب', multiline: true,
    fallback: 'شكراً لتسوّقك من متجرنا. سنراجع طلبك ونتواصل معك لتأكيده.', fallbackEn: 'Thank you for shopping with us. We will review your order and contact you to confirm it.' },

  // ---- homepage with no layout --------------------------------------------
  { key: 'home.empty.title', group: 'الصفحة الرئيسية بدون تخطيط', label: 'العنوان', fallback: 'مرحباً بك في متجرنا', fallbackEn: 'Welcome to our store' },
  { key: 'home.empty.text', group: 'الصفحة الرئيسية بدون تخطيط', label: 'النص', fallback: 'كل المنتجات متاحة للتصفّح الآن.', fallbackEn: 'Every product is ready to browse now.' },
]

const FALLBACKS: Record<string, string> = Object.fromEntries(SITE_TEXTS.map((t) => [t.key, t.fallback]))
const FALLBACKS_EN: Record<string, string> = Object.fromEntries(SITE_TEXTS.map((t) => [t.key, t.fallbackEn]))

/**
 * `t('footer.about')` → the operator's wording, or the built-in one. On an
 * English page the operator's English wording wins; without one the Arabic
 * wording is not shown but the built-in English line is, except that a line
 * the operator hid stays hidden.
 */
export function useSiteText(): (key: string) => string {
  const { data } = useStoreSettings()
  const overrides = data?.texts
  return (key) => {
    const value = overrides?.[key]
    if (isEnglish()) {
      const english = overrides?.[`en:${key}`]
      if (typeof english === 'string') return english
      return value === '' ? '' : (FALLBACKS_EN[key] ?? '')
    }
    return typeof value === 'string' ? value : (FALLBACKS[key] ?? '')
  }
}
