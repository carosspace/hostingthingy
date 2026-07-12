'use client'

import { useState, type CSSProperties } from 'react'

// A small, opt-in "set a sign-in PIN" panel for the member portal. Sets the person's
// 6-digit PIN (their Supabase password) so they can sign in with it next time instead of
// waiting for an email link. The magic link always still works + resets a forgotten PIN.
export default function SetPin({ accent, text, muted }: { accent: string; text: string; muted: string }) {
  const [open, setOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const clean = (v: string) => v.replace(/\D/g, '').slice(0, 6)

  async function save() {
    if (!/^\d{6}$/.test(pin)) { setMsg('Choose a 6-digit PIN.'); return }
    if (pin !== pin2) { setMsg('The two PINs don’t match.'); return }
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/account/set-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      const d = await r.json().catch(() => ({}))
      setMsg(r.ok ? '✓ PIN set — use it to sign in next time.' : (d?.error || 'Couldn’t set it.'))
      if (r.ok) { setPin(''); setPin2('') }
    } catch { setMsg('Couldn’t set it — try again.') }
    setBusy(false)
  }

  const inputStyle: CSSProperties = { background: `${accent}0d`, border: `1px solid ${accent}33`, color: text, letterSpacing: '0.4em' }
  const lbl: CSSProperties = { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: `${accent}b3` }

  return (
    <div className="mt-6">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="font-label" style={{ ...lbl, color: muted }}>
          Set a sign-in PIN →
        </button>
      ) : (
        <div className="rounded-2xl p-5 space-y-3" style={{ border: `1px solid ${accent}26`, background: `${accent}08` }}>
          <p className="font-body" style={{ color: text, fontSize: 14 }}>Set a 6-digit PIN</p>
          <p className="font-body" style={{ color: muted, fontSize: 12, lineHeight: 1.5 }}>
            So you can sign in with a PIN instead of waiting for an email. The email link always still works, and resets it if you forget.
          </p>
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Choose a PIN" value={pin}
            onChange={e => setPin(clean(e.target.value))} className="w-full font-body px-4 py-2.5 rounded-xl outline-none" style={inputStyle} />
          <input type="password" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="Repeat it" value={pin2}
            onChange={e => setPin2(clean(e.target.value))} className="w-full font-body px-4 py-2.5 rounded-xl outline-none" style={inputStyle} />
          {msg && <p className="font-body" style={{ color: msg[0] === '✓' ? '#3f7a52' : '#ef4444', fontSize: 13 }}>{msg}</p>}
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={busy} className="font-label rounded-xl" style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', padding: '10px 22px', background: accent, color: '#fff', opacity: busy ? 0.5 : 1 }}>
              {busy ? 'Saving…' : 'Save PIN'}
            </button>
            <button type="button" onClick={() => { setOpen(false); setMsg('') }} className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: muted }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
