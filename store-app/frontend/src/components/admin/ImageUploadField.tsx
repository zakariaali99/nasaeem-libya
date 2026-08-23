import { Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { compressImageFile } from '@/lib/imageCompress'
import { uploadImage } from '@/lib/queries/catalog'
import { cn } from '@/lib/utils'

interface ImageUploadFieldProps {
  label: string
  hint?: string
  value?: string
  onChange: (url: string) => void
  aspectRatio?: 'video' | 'square' | 'banner' | 'auto'
  className?: string
}

export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  aspectRatio = 'auto',
  className,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    try {
      // Compress in the browser BEFORE the network: a 5 MB phone photo
      // becomes ~200 KB, so the upload survives Libyan uplink speeds.
      const compressed = await compressImageFile(file)
      const result = await uploadImage(compressed)
      onChange(result.url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'تعذّر رفع الصورة، يرجى المحاولة مرة أخرى')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleRemove = () => {
    onChange('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-foreground">{label}</label>
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive hover:underline"
          >
            <Trash2 className="size-3" />
            <span>حذف الصورة</span>
          </button>
        )}
      </div>

      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative group overflow-hidden rounded-2xl border border-border bg-muted/20 p-2">
          <img
            src={value}
            alt={label}
            className={cn(
              'w-full object-contain rounded-xl max-h-48 bg-card/60 border border-border/50',
              aspectRatio === 'video' && 'aspect-video object-cover',
              aspectRatio === 'square' && 'aspect-square object-cover',
              aspectRatio === 'banner' && 'aspect-[21/9] object-cover',
            )}
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="bg-card text-foreground font-bold text-xs rounded-xl shadow-md gap-1.5"
            >
              <Upload className="size-3.5" />
              <span>تغيير الصورة</span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              className="font-bold text-xs rounded-xl shadow-md gap-1.5"
            >
              <Trash2 className="size-3.5" />
              <span>حذف</span>
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2.5 w-full rounded-2xl border-2 border-dashed border-border hover:border-primary/50 bg-card hover:bg-primary/5 p-6 text-center transition-all cursor-pointer group shadow-2xs"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-primary">
              <Loader2 className="size-8 animate-spin" />
              <span className="text-xs font-bold">جارٍ رفع الصورة ومعالجتها…</span>
            </div>
          ) : (
            <>
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-105 transition-transform shadow-2xs">
                <Upload className="size-6" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">
                  انقر هنا لاختيار ملف الصورة من جهازك
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  يدعم JPG, PNG, WebP, SVG حتى 10 ميغابايت
                </p>
              </div>
            </>
          )}
        </button>
      )}

      {error && <p className="text-xs text-destructive font-semibold">{error}</p>}
    </div>
  )
}
