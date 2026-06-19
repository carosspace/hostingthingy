'use client'
import { useState, useEffect } from 'react'
import type { SiteBanner } from './types'

// A thin announcement bar above a published page. Dismissible per visitor (localStorage),
// and it reappears when the owner changes the text (the key is derived from the text).
function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function Banner({ banner, safeHref }: { banner: SiteBanner; safeHref: (h: string) => string | null }) {
  const key = 'cvbanner:' + hash(banner.text)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    try {
      if (localStorage.getItem(key) === '1') setDismissed(true)
    } catch {
      /* private mode / unavailable */
    }
  }, [key])
  if (dismissed) return null

  const href = banner.href ? safeHref(banner.href.trim()) : null
  const label = (
    <span style={{ flex: 1, textAlign: 'center', padding: '0 2.5rem' }}>{banner.text}</span>
  )
  return (
    <div
      style={{
        background: banner.bg || '#141414',
        color: banner.color || '#ffffff',
        fontSize: 14,
        lineHeight: 1.3,
        padding: '9px 12px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {href ? (
        <a href={href} style={{ flex: 1, textAlign: 'center', padding: '0 2.5rem', color: 'inherit', textDecoration: 'underline' }}>
          {banner.text}
        </a>
      ) : (
        label
      )}
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(key, '1')
          } catch {
            /* ignore */
          }
          setDismissed(true)
        }}
        aria-label="Dismiss"
        style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'inherit', fontSize: 18, lineHeight: 1, cursor: 'pointer', opacity: 0.8 }}
      >
        ×
      </button>
    </div>
  )
}
