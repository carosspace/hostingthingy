'use client'

import { useState } from 'react'
import { getResourceDownloadUrl } from './actions'

// A client-side Download button. On click it asks the server for a short-lived, entitlement-gated
// signed URL (the path/bucket are never exposed here), then triggers the download. The button is
// fully themed from props so it inherits the portal's accent. Any failure (no entitlement, dormant
// storage) surfaces as a gentle inline message rather than a crash.
export default function DownloadButton({
  slug,
  resourceId,
  accent,
}: {
  slug: string
  resourceId: string
  accent: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onClick() {
    setErr('')
    setBusy(true)
    try {
      const res = await getResourceDownloadUrl(slug, resourceId)
      if (!res.ok) {
        setErr(res.error)
        return
      }
      // Navigate to the short-lived signed URL — the browser downloads the file. A private bucket's
      // signed URL serves the object with a content-disposition that prompts a download/open.
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
        style={{
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: accent,
          border: `1px solid ${accent}55`,
          borderRadius: 9,
          padding: '8px 16px',
        }}
      >
        {busy ? 'Preparing…' : 'Download'}
      </button>
      {err && (
        <p className="font-body mt-2" style={{ color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>
          {err}
        </p>
      )}
    </div>
  )
}
