import { AlertTriangle, Crosshair, Monitor, Smartphone } from 'lucide-react'
import * as React from 'react'

import { ImageUploadField } from '@/components/admin/ImageUploadField'
import { BANNER_SIZES, cropPercent, sizeNumbers, sizeUnit } from '@/lib/bannerSizes'
import { cn } from '@/lib/utils'
import type { BannerHeight } from '@/types/api'

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
}: {
  device: 'desktop' | 'mobile'
  height: BannerHeight
  value: string
  onChange: (url: string) => void
  focusX?: number
  focusY?: number
  onFocusChange: (x: number, y: number) => void
  optional?: boolean
}) {
  const required = BANNER_SIZES[height][device]
  const actual = useImageSize(value || undefined)
  const crop = actual ? cropPercent(actual, required) : 0
  const tooSmall = actual ? actual.width < required.width * 0.7 : false
  const Icon = device === 'desktop' ? Monitor : Smartphone
  const frameRatio = required.height ? `${required.width} / ${required.height}` : actual ? `${actual.width} / ${actual.height}` : '16 / 9'

  const pick = (event: React.MouseEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.round(((event.clientX - box.left) / box.width) * 100)
    const y = Math.round(((event.clientY - box.top) / box.height) * 100)
    onFocusChange(Math.min(Math.max(x, 0), 100), Math.min(Math.max(y, 0), 100))
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {device === 'desktop' ? 'صورة الحاسوب' : 'صورة الهاتف'}
          {optional ? <span className="text-xs font-normal text-muted-foreground">(موصى بها بشدة)</span> : null}
        </span>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          المقاس المطلوب: <bdi dir="ltr" className="font-mono">{sizeNumbers(required)}</bdi> {sizeUnit(required)}
        </span>
      </div>

      <ImageUploadField label="" purpose="banner" aspectRatio="auto" value={value} onChange={onChange} />

      {value && actual ? (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            مقاس صورتك: <bdi dir="ltr" className="font-mono font-bold text-foreground">{actual.width} × {actual.height}</bdi> بكسل
          </p>
          {crop >= 15 ? (
            <p className="flex items-start gap-1.5 font-bold text-warning" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              شكل الصورة مختلف عن الإطار: سيُقص نحو {crop}% منها. اختر أدناه الجزء الذي يجب أن يبقى ظاهراً، أو اطلب من المصمم المقاس المطلوب.
            </p>
          ) : null}
          {tooSmall ? (
            <p className="flex items-start gap-1.5 font-bold text-warning" role="alert">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              الصورة أصغر من المطلوب وقد تظهر غير حادة على الشاشة.
            </p>
          ) : null}

          {required.height ? (
            <div className="grid gap-3 sm:grid-cols-2">
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
              <div className="space-y-1">
                <span className="font-bold">هكذا ستظهر داخل الإطار</span>
                <div className="overflow-hidden rounded-lg border border-border bg-muted" style={{ aspectRatio: frameRatio }}>
                  <img
                    src={value}
                    alt=""
                    className={cn('size-full object-cover')}
                    style={{ objectPosition: `${focusX}% ${focusY}%` }}
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
