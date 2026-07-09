'use client'

import { useState } from 'react'
import { getProductDownloadUrl } from './actions'

// Download button for a file PRODUCT (ebook / PDF / meditation) the member owns. Asks the
// server for a short-lived, entitlement-gated signed URL, then triggers the download.
export default function ProductDownloadButton({ productSlug, accent }: { productSlug: string; accent: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onClick() {
    setErr('')
    setBusy(true)
    try {
      const res = await getProductDownloadUrl(productSlug)
      if (!res.ok) { setErr(res.error); return }
      window.location.href = res.url
    } catch {
      setErr('Couldn’t prepare that download. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <button
        onClick={onClick}
        disabled={busy}
        className="font-label transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent, border: `1px solid ${accent}55`, borderRadius: 9, padding: '8px 16px' }}
      >
        {busy ? 'Preparing…' : 'Download'}
      </button>
      {err && <p className="font-body mt-2" style={{ color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>{err}</p>}
    </div>
  )
}
