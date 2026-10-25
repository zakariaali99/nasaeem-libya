import { AlertTriangle, Crosshair, Info, Monitor, Smartphone } from 'lucide-react'
import * as React from 'react'

import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { BANNER_SIZES, cropPercent, sizeNumbers, sizeUnit, type BannerSize } from '@/lib/bannerSizes'
import { SMART_CROP_LIMIT } from '@/components/storefront/widgets/Carousel'
import { cn } from '@/lib/utils'
import type { BannerHeight, ImageMode } from '@/types/api'

/** The natural size of an image url, once it has loaded. */
function useImageSize(url: string | undefined) {
  const [size, setSize] = React.useState<{ width: number; height: number } | null>(null)
  React.useEffect(() => {
    setSize(null)
    if (!url) return
    const img = new Image()
    img.onload = () => setSize({ width: img.naturalWidth, height: img.naturalHeight })
    img.src = url
    return () => {
      img.onload = null
    }
  }, [url])
  return size
}

/**
 * One banner picture in the builder, for one device.
 *
 * It says the exact size the designer should deliver, measures what was
 * uploaded, warns when the frame will cut a large part of it or when it is too
 * small to stay sharp, and lets the operator click the part of the picture
 * that must stay visible (the focus point) while showing the frame's crop.
 */
export function BannerImageField({
  device,
  height,
  value,
  onChange,
  focusX = 50,
  focusY = 50,
  onFocusChange,
  optional = false,
  required: requiredSize,
  mode = 'fill',
  label,
  contain = false,
}: {
  device: 'desktop' | 'mobile'
  /** The banner height the picture is for; or pass the size directly. */
  height?: BannerHeight
  required?: BannerSize
  value: string
  onChange: (url: string) => void
  focusX?: number
  focusY?: number
  /** Without it there is no focus point to pick (the store centres the picture). */
  onFocusChange?: (x: number, y: number) => void
  optional?: boolean
  /** The banner's «طريقة عرض الصورة», so the preview and the warning match the store. */
  mode?: ImageMode
  /** Replaces «صورة الحاسوب / الهاتف» for one-picture widgets. */
  label?: string
  /** The store fits the whole picture inside the frame (logos): nothing is
   * cut, the rest of the frame stays empty. */
  contain?: boolean
}) {
  const required = requiredSize ?? BANNER_SIZES[height ?? 'band'][device]
  const actual = useImageSize(value || undefined)
  const crop = actual ? cropPercent(actual, required) : 0
  const tooSmall = actual ? actual.width < required.width * 0.7 : false
  // What the store will do with this picture (see BannerPicture).
  const shownWhole = !contain && (mode === 'whole' || (mode === 'smart' && crop > SMART_CROP_LIMIT * 100))
  const Icon = device === 'desktop' ? Monitor : Smartphone
  const frameRatio = required.height ? `${required.width} / ${required.height}` : actual ? `${actual.width} / ${actual.height}` : '16 / 9'

  const pick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.round(((event.clientX - box.left) / box.width) * 100)
    const y = Math.round(((event.clientY - box.top) / box.height) * 100)
    onFocusChange?.(Math.min(Math.max(x, 0), 100), Math.min(Math.max(y, 0), 100))
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {label ?? (device === 'desktop' ? 'صورة الحاسوب' : 'صورة الهاتف')}
          {optional ? <span className="text-xs font-normal text-muted-foreground">(موصى بها بشدة)</span> : null}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          المقاس المطلوب: <bdi dir="ltr" className="whitespace-nowrap font-mono">{sizeNumbers(required)}</bdi> {sizeUnit(required)}
        </span>
      </div>
      {required.note ? <p className="text-xs text-muted-foreground">{required.note}</p> : null}

      <ImageUploadField label="" purpose="banner" aspectRatio="auto" value={value} onChange={onChange} />

      {value && actual ? (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            مقاس صورتك: <bdi dir="ltr" className="font-mono font-bold text-foreground">{actual.width} × {actual.height}</bdi> بكسل
          </p>
          {contain && crop >= 15 ? (
            <p className="flex items-start gap-1.5 font-bold text-warning" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              شكل الصورة مختلف عن الإطار: ستظهر كاملة لكن أصغر، ويبقى فراغ حولها.
            </p>
          ) : shownWhole && crop >= 5 ? (
            <p className="flex items-start gap-1.5 font-bold text-info" role="status">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {mode === 'smart'
                ? `شكل الصورة بعيد عن الإطار (كان سيُقص نحو ${crop}% منها)، فستظهر كاملة فوق نسخة مموّهة منها. للنتيجة الأفضل اطلب المقاس المطلوب.`
                : 'ستظهر كاملة فوق نسخة مموّهة منها تملأ بقية الإطار.'}
            </p>
          ) : !contain && crop >= 15 ? (
            <p className="flex items-start gap-1.5 font-bold text-warning" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              شكل الصورة مختلف عن الإطار: سيُقص نحو {crop}% منها.{' '}
              {onFocusChange ? 'اختر أدناه الجزء الذي يجب أن يبقى ظاهراً، أو اطلب من المصمم المقاس المطلوب.' : 'اطلب من المصمم المقاس المطلوب.'}
            </p>
          ) : null}
          {tooSmall ? (
            <p className="flex items-start gap-1.5 font-bold text-warning" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              الصورة أصغر من المطلوب وقد تظهر غير حادة على الشاشة.
            </p>
          ) : null}

          {required.height ? (
            <div className={cn('grid gap-3', onFocusChange && !shownWhole && !contain && 'sm:grid-cols-2')}>
              {onFocusChange && !shownWhole && !contain ? (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 font-bold">
                  <Crosshair className="size-3.5" aria-hidden="true" /> اضغط على ما يجب أن يبقى ظاهراً
                </span>
                <button
                  type="button"
                  onClick={pick}
                  className="relative block w-full cursor-crosshair overflow-hidden rounded-lg border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  aria-label="اختيار نقطة التركيز"
                >
                  <img src={value} alt="" className="block w-full" draggable={false} />
                  <span
                    className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow-md"
                    style={{ left: `${focusX}%`, top: `${focusY}%` }}
                    aria-hidden="true"
                  />
                </button>
              </div>
              ) : null}
              <div className={cn('space-y-1', !(onFocusChange && !shownWhole && !contain) && 'max-w-sm')}>
                <span className="font-bold">هكذا ستظهر داخل الإطار</span>
                <div className="relative overflow-hidden rounded-lg border border-border bg-muted" style={{ aspectRatio: frameRatio }}>
                  {shownWhole ? (
                    <img src={value} alt="" aria-hidden="true" draggable={false}
                      className="absolute inset-0 size-full scale-110 object-cover blur-xl brightness-75" />
                  ) : null}
                  <img
                    src={value}
                    alt=""
                    className={cn('relative size-full', shownWhole || contain ? 'object-contain' : 'object-cover', contain && 'p-2')}
                    style={shownWhole || contain ? undefined : { objectPosition: `${focusX}% ${focusY}%` }}
                    draggable={false}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
