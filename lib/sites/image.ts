// Encode a canvas as WebP (~30% smaller) where the browser supports it, falling
// back to JPEG otherwise (toDataURL returns a non-webp type when it can't encode).
export function encodeImage(canvas: HTMLCanvasElement, quality = 0.82): string {
  const webp = canvas.toDataURL('image/webp', quality)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality)
}

// Resize an uploaded image in the browser and return a compact data URL (WebP when
// supported), so the site stays self-contained (no storage bucket needed).
export function resizeToDataUrl(file: File, maxW = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('decode failed'))
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('no ctx'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(encodeImage(canvas, quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}
