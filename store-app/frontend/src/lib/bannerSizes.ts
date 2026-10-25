import type { BannerHeight } from '@/types/api'

export interface BannerSize {
  width: number
  /** null = any height (the picture keeps its own shape). */
  height: number | null
  /** Shown under the size when the frame is not one fixed shape. */
  note?: string
}

/**
 * The picture sizes a designer should deliver for each banner height, desktop
 * and phone. They are the real frames in `Carousel.tsx` — change one, change
 * the other:
 * - `band`: exactly 3:1 on a computer (never taller than 640px) and 4:5 on a phone.
 * - `full`: the screen below the header (and the phone's bottom bar), which is
 *   1920×880 on a typical computer (2.0–2.4:1 measured) and 1080×1700 on a
 *   typical phone (0.55–0.70 measured); the edges vary, the middle is safe.
 * - `auto`: the picture's own shape, up to 85% of the screen's height.
 */
export const BANNER_SIZES: Record<BannerHeight, { desktop: BannerSize; mobile: BannerSize; label: string }> = {
  band: {
    label: 'شريط عريض',
    desktop: { width: 1920, height: 640 },
    mobile: { width: 1080, height: 1350 },
  },
  full: {
    label: 'ملء الشاشة',
    desktop: { width: 1920, height: 880, note: 'يختلف حسب الشاشة، فقد يُقص حتى 10% من الأطراف: اجعل النص والمنتج في الوسط' },
    mobile: { width: 1080, height: 1700, note: 'يختلف حسب الهاتف، فقد يُقص حتى 15% من الأطراف: اجعل النص والمنتج في الوسط' },
  },
  auto: {
    label: 'بأبعاد الصورة',
    desktop: { width: 1920, height: null, note: 'الصورة الأطول من 85% من ارتفاع الشاشة تُقص' },
    mobile: { width: 1080, height: null, note: 'الصورة الأطول من 85% من ارتفاع الشاشة تُقص' },
  },
}

/** Offer banners (`promo_banners`): the picture sizes per shape. */
export const PROMO_SIZES: Record<'strip' | 'grid' | 'editorial', { desktop: BannerSize; mobile: BannerSize; label: string; note: string }> = {
  strip: {
    label: 'شريط رفيع',
    note: 'عرض أو إعلان قصير بعرض الصفحة',
    desktop: { width: 1920, height: 320 },
    mobile: { width: 1080, height: 360 },
  },
  grid: {
    label: 'بانران أو ثلاثة متجاورة',
    note: 'تصبح شريطاً يُسحب على الهاتف',
    desktop: { width: 1080, height: 1350 },
    mobile: { width: 1080, height: 1350 },
  },
  editorial: {
    label: 'صورة بجانبها نص',
    note: 'لقصة عطر أو مجموعة جديدة',
    desktop: { width: 1080, height: 1350 },
    mobile: { width: 1080, height: 1350 },
  },
}

/**
 * The other pictures the builder takes, measured in the store (1920, 1440 and
 * 375px screens) on 25 Oct 2026:
 * - `image` («صورة منفردة»): the page width (1120px in the page, 1920px edge
 *   to edge), its own height, never cut; the same file on a phone.
 * - photo tiles: about 270px wide on a computer and 165px on a phone; the
 *   picture tile is 4:5, the logo box 4:3 (236×183) with the logo fitted inside.
 * - the text hero: as wide as the page, as tall as its words — about 320px on
 *   a computer and 256px or more on a phone — so its picture is cut to fit.
 */
export const PICTURE_SIZES = {
  image: {
    width: 1920,
    height: null,
    note: 'تظهر كاملة بأبعادها بلا قص، بعرض الصفحة. على الهاتف تُصغَّر الصورة نفسها بعرض الشاشة، فاجعل أي كتابة فيها كبيرة.',
  },
  tileImage: {
    width: 800,
    height: 1000,
    note: 'طولية 4:5. تظهر البطاقة بعرض نحو 270 بكسل على الحاسوب و165 على الهاتف.',
  },
  tileLogo: {
    width: 600,
    height: 450,
    note: 'PNG بخلفية شفافة. يظهر الشعار كاملاً داخل إطار 4:3 دون قص.',
  },
  heroTextDesktop: {
    width: 1920,
    height: 640,
    note: 'الارتفاع يتبع طول النص (نحو 320 بكسل على الشاشة)، فيُقص من الأعلى والأسفل: اجعل المهم في الوسط.',
  },
  heroTextMobile: {
    width: 1080,
    height: 1080,
    note: 'الارتفاع يتبع طول النص، فقد يُقص من الجوانب أو الأعلى: اجعل المهم في الوسط.',
  },
} satisfies Record<string, BannerSize>

/** "1920 × 640" — the numbers only, for a left-to-right <bdi>. */
export function sizeNumbers(size: BannerSize): string {
  return size.height ? `${size.width} × ${size.height}` : `${size.width} × —`
}

/** The words that go with `sizeNumbers`. */
export function sizeUnit(size: BannerSize): string {
  return size.height ? 'بكسل' : 'بكسل، بأي ارتفاع'
}

/**
 * How much of a picture a frame will cut off, as a whole percent (0 when it
 * fits or the frame follows the picture).
 */
export function cropPercent(picture: { width: number; height: number }, frame: BannerSize): number {
  if (!frame.height || !picture.width || !picture.height) return 0
  const pictureRatio = picture.width / picture.height
  const frameRatio = frame.width / frame.height
  const kept = pictureRatio > frameRatio ? frameRatio / pictureRatio : pictureRatio / frameRatio
  return Math.round((1 - kept) * 100)
}
