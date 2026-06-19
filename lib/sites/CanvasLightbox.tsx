'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// Opens any image marked data-lightbox full-screen on click; Esc or a click
// anywhere closes it. Rendered once per free-canvas page (alongside CanvasMotion).
export default function CanvasLightbox() {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-lightbox]') as HTMLElement | null
      if (!el) return
      const s = el.getAttribute('data-lightbox')
      if (s) { e.preventDefault(); setSrc(s) }
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [])

  useEffect(() => {
    if (!src) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSrc(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [src])

  if (!src) return null
  // Portal to <body> so a page-transition transform on an ancestor can never become
  // the containing block for this fixed overlay (which would offset/clip it).
  return createPortal(
    <div onClick={() => setSrc(null)} role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out', padding: 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" style={{ maxWidth: '96%', maxHeight: '96%', objectFit: 'contain', boxShadow: '0 10px 60px rgba(0,0,0,0.5)' }} />
    </div>,
    document.body
  )
}
