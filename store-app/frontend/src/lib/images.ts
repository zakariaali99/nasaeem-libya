/** Rendition names every uploaded image has on disk (mirrors `RENDITIONS` in
 * backend/apps/catalog/services.py). */
export type RenditionName = 'thumb' | 'medium' | 'full'

const RENDITION_SUFFIX = /-(thumb|medium|full)(?=\.webp$)/i

/**
 * One rendition of a free-form image url (banners, slides), or the url itself
 * when that image has none. Mirrors `rendition_url` in the backend: only WebP
 * files under /media/ were written by the upload pipeline or `optimize_media`,
 * so a legacy JPG or an external url is returned untouched instead of pointing
 * at a file that does not exist.
 */
export function renditionUrl(url: string | null | undefined, name: RenditionName): string {
  if (!url) return ''
  if (!url.startsWith('/media/') || !/\.webp$/i.test(url)) return url
  return url.replace(RENDITION_SUFFIX, '').replace(/\.webp$/i, `-${name}.webp`)
}
