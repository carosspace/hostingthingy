'use client'

import { useState } from 'react'
import { getWorkbookCompanionUrl } from './actions'

// Download button for an interactive workbook's COMPANION file (the printable PDF the buyer
// also gets). Asks the server for a short-lived, entitlement-gated signed URL, then downloads.
export default function CompanionDownloadButton({
  workbookSlug,
  accent,
  label = 'Download printable',
}: {
  workbookSlug: string
  accent: string
  label?: string
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function onClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setErr('')
    setBusy(true)
    try {
      const res = await getWorkbookCompanionUrl(workbookSlug)
      if (!res.ok) { setErr(res.error); return }
      window.location.href = res.url
    } catch {
      setErr('Couldn’t prepare that download. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        onClick={onClick}
        disabled={busy}
        className="font-label transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent, border: `1px solid ${accent}55`, borderRadius: 9, padding: '7px 14px' }}
      >
        {busy ? 'Preparing…' : `⤓ ${label}`}
      </button>
      {err && <p className="font-body mt-2" style={{ color: '#f87171', fontSize: 12, lineHeight: 1.5 }}>{err}</p>}
    </div>
  )
}
