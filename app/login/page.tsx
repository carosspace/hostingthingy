'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

function Sigil({ size = 50 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="block mx-auto">
      <circle cx="30" cy="30" r="27" stroke="#c9a84c" strokeWidth="1" />
      <circle cx="30" cy="30" r="3" fill="#c9a84c" />
      <line x1="30" y1="3" x2="30" y2="13" stroke="#c9a84c" strokeWidth="0.75" />
      <line x1="30" y1="47" x2="30" y2="57" stroke="#c9a84c" strokeWidth="0.75" />
      <line x1="3" y1="30" x2="13" y2="30" stroke="#c9a84c" strokeWidth="0.75" />
      <line x1="47" y1="30" x2="57" y2="30" stroke="#c9a84c" strokeWidth="0.75" />
    </svg>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) return
    setLoading(true)
    setError('')
    try {
      const supabase = createSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) setError(error.message)
      else setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-lg px-4 py-3 rounded-sm outline-none transition-colors placeholder:text-ash/40'

  return (
    <main className="bg-background min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <Sigil size={50} />
          <p className="font-label text-[10px] tracking-[5px] text-gold uppercase mt-4">Anima Temple</p>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <h1 className="font-display text-3xl italic text-parchment">Check your email</h1>
            <p className="font-body text-ash text-sm">
              We sent a sacred link to <span className="text-parchment">{email}</span>. Open it on this
              device to enter your temple.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail('') }}
              className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors mt-4"
            >
              ← Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="text-center mb-2">
              <h1 className="font-display text-3xl italic text-parchment mb-2">Enter your temple</h1>
              <p className="font-body text-ash text-sm">We&apos;ll email you a link to sign in — no password needed.</p>
            </div>
            <div>
              <label className="font-label text-[10px] tracking-[3px] text-gold/70 uppercase block mb-2">Email Address</label>
              <input
                type="email"
                className={inputClass}
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
              />
            </div>

            {error && (
              <div className="p-4 border border-red-500/30 bg-red-500/10 rounded-sm">
                <p className="font-body text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.includes('@')}
              className={`w-full font-label text-[11px] tracking-[4px] uppercase px-8 py-3 rounded-sm transition-all duration-200 ${
                !loading && email.includes('@')
                  ? 'bg-gold text-background hover:bg-goldLight'
                  : 'bg-gold/20 text-gold/40 cursor-not-allowed'
              }`}
            >
              {loading ? 'Sending…' : 'Send my link →'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
