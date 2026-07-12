'use client'

import { useState, type CSSProperties } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

// A calm, BRANDED magic-link login for clients. Mirrors app/login/page.tsx's
// signInWithOtp mechanism, but themed to the portal's site and routed back to
// /me after sign-in (next=/me). All colours come from props so it works on every
// theme (incl. midnight) + any accent.
export default function ClientLogin({
  brand,
  logoImage,
  theme,
  initialError,
}: {
  brand: string
  logoImage?: string
  theme: { bg: string; text: string; muted: string; accent: string }
  initialError?: string
}) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [mode, setMode] = useState<'link' | 'pin'>('link')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(initialError ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return
    setLoading(true)
    setError('')
    try {
      const supabase = createSupabaseBrowserClient()
      if (mode === 'pin') {
        if (!/^\d{6}$/.test(pin)) { setError('Your PIN is 6 digits.'); setLoading(false); return }
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pin })
        if (error) setError('That email + PIN didn’t match. Try again, or use an email link.')
        else window.location.href = '/me'
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/me` },
        })
        if (error) setError(error.message)
        else setSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const valid = mode === 'pin' ? (email.includes('@') && /^\d{6}$/.test(pin)) : email.includes('@')
  const inputStyle: CSSProperties = {
    background: `${theme.accent}0d`,
    border: `1px solid ${theme.accent}33`,
    color: theme.text,
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="text-center mb-10">
        {logoImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={logoImage} alt={brand} style={{ height: 44, maxWidth: 220, objectFit: 'contain', display: 'inline-block' }} />
        ) : (
          <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: theme.accent }}>
            {brand}
          </span>
        )}
      </div>

      {sent ? (
        <div className="text-center space-y-4">
          <h1 className="font-display italic" style={{ color: theme.text, fontSize: 34, lineHeight: 1.15 }}>
            Check your email
          </h1>
          <p className="font-body" style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6 }}>
            We sent a sign-in link to <span style={{ color: theme.text }}>{email}</span>. Open it on this device to enter your space.
          </p>
          <button
            type="button"
            onClick={() => { setSent(false); setEmail('') }}
            className="font-label transition-colors"
            style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: theme.muted }}
          >
            ← Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="text-center mb-2">
            <h1 className="font-display italic mb-2" style={{ color: theme.text, fontSize: 34, lineHeight: 1.15 }}>
              Your space
            </h1>
            <p className="font-body" style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6 }}>
              {mode === 'pin' ? `Enter your email and 6-digit PIN.` : `Sign in to ${brand}. We’ll email you a link, no password needed.`}
            </p>
          </div>
          <div>
            <label
              className="font-label block mb-2"
              style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: `${theme.accent}b3` }}
            >
              Email address
            </label>
            <input
              type="email"
              className="w-full font-body text-lg px-4 py-3 rounded-xl outline-none transition-colors"
              style={inputStyle}
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          {mode === 'pin' && (
            <div>
              <label
                className="font-label block mb-2"
                style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: `${theme.accent}b3` }}
              >
                Your PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                className="w-full font-body text-lg px-4 py-3 rounded-xl outline-none transition-colors tracking-[0.4em]"
                style={inputStyle}
                placeholder="••••••"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              />
            </div>
          )}

          {error && (
            <div className="px-4 py-3 rounded-xl" style={{ background: '#ef444415', border: '1px solid #ef444440' }}>
              <p className="font-body" style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !valid}
            className="w-full font-label rounded-xl transition-all duration-200"
            style={{
              fontSize: 11,
              letterSpacing: 4,
              textTransform: 'uppercase',
              padding: '14px 32px',
              background: valid && !loading ? theme.accent : `${theme.accent}33`,
              color: valid && !loading ? theme.bg : `${theme.accent}80`,
              cursor: valid && !loading ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? (mode === 'pin' ? 'Checking…' : 'Sending…') : (mode === 'pin' ? 'Enter →' : 'Send me a sign-in link →')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => { setMode(mode === 'pin' ? 'link' : 'pin'); setError('') }}
              className="font-label transition-colors"
              style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.muted }}
            >
              {mode === 'pin' ? 'Email me a link instead' : 'Prefer a PIN? Sign in with your PIN →'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
