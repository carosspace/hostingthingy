'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { redeemCodeAction, type RedeemResult } from './actions'

export default function RedeemForm({ accent, text, muted }: { accent: string; text: string; muted: string }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<RedeemResult | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setResult(null)
    const r = await redeemCodeAction(code)
    setResult(r)
    setBusy(false)
    if (r === 'ok') {
      // Give the success note a beat, then open the workbook.
      setTimeout(() => router.push('/me/workbook'), 1200)
    }
  }

  const message: Record<RedeemResult, string> = {
    ok: '✓ Unlocked! Opening your workbook…',
    already: 'That code has already been used by someone else.',
    invalid: 'We couldn’t find that code. Please check it and try again.',
    error: 'Something went wrong. Please try again in a moment.',
  }

  return (
    <form onSubmit={submit} className="mt-10 mx-auto" style={{ maxWidth: 380 }}>
      <input
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase())}
        placeholder="TUNED-XXXXXX"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="w-full text-center font-mono outline-none"
        style={{
          background: `${accent}0f`,
          border: `1px solid ${accent}40`,
          color: text,
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 18,
          letterSpacing: 2,
        }}
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full mt-3 font-label transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          background: accent,
          color: '#1A1108',
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
        }}
      >
        {busy ? 'Checking…' : 'Unlock'}
      </button>
      {result && (
        <p
          className="font-body mt-4 text-center"
          style={{ color: result === 'ok' ? accent : muted, fontSize: 14, lineHeight: 1.5 }}
        >
          {message[result]}
        </p>
      )}
    </form>
  )
}
