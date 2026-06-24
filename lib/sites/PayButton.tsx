'use client'
import { useState, type CSSProperties } from 'react'

// A published "Pay" button. Looks exactly like a normal canvas button (the caller passes the
// same resolved fill/color/radius/font CSS via `style`), but instead of being a link it POSTs
// to the checkout endpoint and forwards the visitor to Stripe.
//
// SECURITY: the only thing sent is { elementId } + the slug in the URL — NEVER the amount. The
// price is read server-side from the saved element, so the visitor can't change what they pay.
//
// Dormant/error-safe: a 'not_setup' response (owner hasn't connected Stripe) or any failure shows
// a gentle inline message; nothing throws and the button returns to its normal state.
export function PayButton({
  slug,
  elementId,
  label,
  style,
}: {
  slug: string
  elementId: string
  label: string
  style: CSSProperties
}) {
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'notsetup'>('idle')

  async function onClick() {
    if (state === 'loading') return
    setState('loading')
    try {
      const res = await fetch(`/api/pay/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // ONLY the element id — the amount is server-authoritative.
        body: JSON.stringify({ elementId }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.url) {
        window.location.href = data.url as string
        return
      }
      setState(data?.error === 'not_setup' ? 'notsetup' : 'error')
    } catch {
      setState('error')
    }
  }

  // The button fills its absolute wrapper just like renderInner's button div. We render a <button>
  // (not an <a>) so there's no navigable href; the click handler drives the checkout.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'loading'}
      style={{ ...style, border: 'none', cursor: state === 'loading' ? 'wait' : 'pointer', opacity: state === 'loading' ? 0.75 : 1 }}
    >
      {state === 'loading' ? 'One moment…' : state === 'notsetup' ? 'Payments not set up' : state === 'error' ? 'Try again' : label}
    </button>
  )
}
