'use client'

import { useState } from 'react'

type Theme = { bg: string; text: string; accent: string }

// Posts ONLY the tierId to the subscribe API, then redirects to the returned Stripe Checkout URL.
// The price is read server-side from the tier, never sent from here. On any error it surfaces a calm
// inline message and re-enables the button so the visitor can retry.
export default function SubscribeButton({ slug, tierId, theme, label }: { slug: string; tierId: string; theme: Theme; label: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function subscribe() {
    if (busy) return
    setBusy(true)
    setErr(null)
    try {
      const res = await fetch(`/api/membership/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      })
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null
      if (res.ok && data?.url) {
        window.location.assign(data.url)
        return // keep the spinner while the browser navigates to Stripe
      }
      setErr(
        data?.error === 'not_setup'
          ? "Subscriptions aren't available right now."
          : 'Something went wrong. Please try again.',
      )
    } catch {
      setErr('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={subscribe}
        disabled={busy}
        className="w-full font-label transition-opacity"
        style={{
          background: theme.accent,
          color: theme.bg,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          padding: 14,
          borderRadius: 11,
          opacity: busy ? 0.5 : 1,
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? 'Taking you to checkout…' : label}
      </button>
      {err && (
        <p className="font-body mt-2 text-center" style={{ color: theme.text, fontSize: 12, opacity: 0.8 }}>
          {err}
        </p>
      )}
    </div>
  )
}
