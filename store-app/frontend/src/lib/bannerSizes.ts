import type { BannerHeight } from '@/types/api'

export interface BannerSize {
  width: number
  /** null = any height (the picture keeps its own shape). */
  height: number | null
}

/**
 * The picture sizes a designer should deliver for each banner height, desktop
 * and phone. They match the frames in `Carousel.tsx`: a `band` is 3:1 on a
 * computer and 4:5 on a phone, `full` is the screen (16:9 / 9:16).
 */
export const BANNER_SIZES: Record<BannerHeight, { desktop: BannerSize; mobile: BannerSize; label: string }> = {
  band: {
    label: 'شريط عريض',
    desktop: { width: 1920, height: 640 },
    mobile: { width: 1080, height: 1350 },
  },
  full: {
    label: 'ملء الشاشة',
    desktop: { width: 1920, height: 1080 },
    mobile: { width: 1080, height: 1920 },
  },
  auto: {
    label: 'بأبعاد الصورة',
    desktop: { width: 1920, height: null },
    mobile: { width: 1080, height: null },
  },
}

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
