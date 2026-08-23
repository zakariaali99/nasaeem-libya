/**
 * Client-side image compression for admin uploads.
 *
 * A 5 MB phone photo on a Libyan upload link takes minutes; the same image
 * resized to 1600px and encoded at ~0.8 quality is ~150–250 KB and visually
 * identical for a product shot. This runs in the browser before the upload,
 * so the weak link carries the small file, not the big one.
 *
 * Quality steps down (0.85 → 0.5) until the blob fits the budget or the
 * floor is reached — documents with small Arabic text keep their legibility
 * because dimensions never shrink below the cap, only encoding quality does.
 */

const MAX_DIMENSION = 1600
const TARGET_BYTES = 250 * 1024
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.5]

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file)
  }
  // Fallback for older Safari: an <img> decode path.
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return image
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

function drawScaled(source: ImageBitmap | HTMLImageElement): HTMLCanvasElement {
  const sourceWidth = 'width' in source ? source.width : 0
  const sourceHeight = 'height' in source ? source.height : 0
  const scale = Math.min(1, MAX_DIMENSION / Math.max(sourceWidth, sourceHeight))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(sourceWidth * scale)
  canvas.height = Math.round(sourceHeight * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas unavailable')
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('encode failed'))),
      'image/webp',
      quality,
    )
  })
}

/** Compress an image File; returns a webp Blob ready for upload. */
export async function compressImage(file: File): Promise<Blob> {
  // SVG and GIF are vector/animated — re-encoding destroys them. Pass through.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file
  // Already tiny: the round trip would cost more than it saves.
  if (file.size <= TARGET_BYTES) return file

  const bitmap = await loadBitmap(file)
  const canvas = drawScaled(bitmap)
  if ('close' in bitmap) bitmap.close()

  let lastBlob: Blob = canvas as unknown as Blob
  for (const quality of QUALITY_STEPS) {
    lastBlob = await canvasToBlob(canvas, quality)
    if (lastBlob.size <= TARGET_BYTES) return lastBlob
  }
  return lastBlob
}

/** Same result as compressImage, wrapped as a File so FormData keeps a name. */
export async function compressImageFile(file: File): Promise<File> {
  const blob = await compressImage(file)
  if (blob === (file as unknown as Blob)) return file
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
  return new File([blob], `${baseName}.${extension}`, { type: blob.type })
}
