'use client'
import { useState, useEffect, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { SitePopup } from './types'

// A one-time modal on a published page: appears after a delay, dismissible, and shown
// only once per visitor (localStorage; reappears if the owner changes the content).
function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function Popup({ popup, safeHref, paletteVars }: { popup: SitePopup; safeHref: (h: string) => string | null; paletteVars?: CSSProperties }) {
  const key = 'cvpopup:' + hash(popup.text + '|' + (popup.title || ''))
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === '1') return
    } catch {
      /* private mode */
    }
    const delay = Math.min(Math.max(popup.delay ?? 2, 0), 60)
    const t = setTimeout(() => setShow(true), delay * 1000)
    return () => clearTimeout(t)
  }, [key, popup.delay])

  const close = () => {
    try {
      localStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }
  if (!show) return null

  const href = popup.ctaHref ? safeHref(popup.ctaHref.trim()) : null
  // Portal to <body> so a page-transition transform on an ancestor can never become the
  // containing block for this fixed overlay (which would offset it during the animation).
  return createPortal(
    <div
      onClick={close}
      role="dialog"
      aria-modal="true"
      style={{ ...paletteVars, position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: popup.bg || '#ffffff', color: popup.color || '#1a1612', borderRadius: 14, padding: '2rem 1.75rem', maxWidth: 420, width: '100%', position: 'relative', textAlign: 'center', boxShadow: '0 12px 48px rgba(0,0,0,0.28)' }}
      >
        <button
          onClick={close}
          aria-label="Close"
          style={{ position: 'absolute', top: 10, right: 12, background: 'transparent', border: 'none', color: 'inherit', fontSize: 22, lineHeight: 1, cursor: 'pointer', opacity: 0.55 }}
        >
          ×
        </button>
        {popup.title && <div style={{ fontSize: 22, fontWeight: 600, marginBottom: '0.6rem', lineHeight: 1.2 }}>{popup.title}</div>}
        <div style={{ fontSize: 15, lineHeight: 1.5, opacity: 0.92, whiteSpace: 'pre-wrap' }}>{popup.text}</div>
        {popup.ctaLabel && href && (
          <a href={href} style={{ display: 'inline-block', marginTop: '1.2rem', background: popup.color || '#1a1612', color: popup.bg || '#ffffff', padding: '0.6em 1.5em', borderRadius: 8, textDecoration: 'none', fontWeight: 600 }}>
            {popup.ctaLabel}
          </a>
        )}
      </div>
    </div>,
    document.body
  )
}
