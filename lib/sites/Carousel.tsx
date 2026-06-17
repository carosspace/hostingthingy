'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { ImageFit } from './types'

// A cross-fading image slideshow. Auto-advances every `interval` seconds (unless
// the visitor prefers reduced motion or there's only one slide); dots let them
// jump between slides. Used on the published free-canvas page.
export default function Carousel({ slides, fit, radiusCss, interval }: { slides: string[]; fit?: ImageFit; radiusCss?: string; interval?: number }) {
  const [i, setI] = useState(0)
  const n = slides.length

  useEffect(() => {
    if (!interval || n < 2) return
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = window.setInterval(() => setI(x => (x + 1) % n), interval * 1000)
    return () => window.clearInterval(t)
  }, [interval, n])

  if (!n) return null
  const cur = Math.min(i, n - 1)
  const imgStyle: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit || 'cover', transition: 'opacity 0.8s ease' }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: radiusCss, overflow: 'hidden' }}>
      {slides.map((s, k) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={k} src={s} alt="" loading={k === 0 ? undefined : 'lazy'} decoding="async" style={{ ...imgStyle, opacity: k === cur ? 1 : 0 }} />
      ))}
      {n > 1 && (
        <div style={{ position: 'absolute', bottom: '6%', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 7, zIndex: 2 }}>
          {slides.map((_, k) => (
            <button key={k} type="button" aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} style={{ width: 9, height: 9, padding: 0, borderRadius: '50%', background: k === cur ? '#fff' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer' }} />
          ))}
        </div>
      )}
    </div>
  )
}
