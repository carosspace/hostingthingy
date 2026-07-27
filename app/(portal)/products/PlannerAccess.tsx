'use client'

import { useState } from 'react'

// The planner is sold OFF-site (Etsy) as well as here, so it needs the same two levers the
// books have — gift access to an email, or generate unlock codes to hand out with a download.
// It isn't a workbook row, so it doesn't appear in the Books manager: this is its own card.
// The product slug matches lib/portal/planner-access.ts (PLANNER_SLUG).
const PLANNER_SLUG = 'aligned'

const input = 'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'
const label = 'font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1'
const ghostBtn = 'font-label text-[10px] tracking-[2px] uppercase text-gold border border-gold/40 rounded-sm px-3 py-2 hover:bg-gold/10 disabled:opacity-50'

export default function PlannerAccess({ plannerUrl }: { plannerUrl: string }) {
  const [busy, setBusy] = useState(false)
  const [giftEmail, setGiftEmail] = useState('')
  const [giftMsg, setGiftMsg] = useState('')
  const [codeCount, setCodeCount] = useState('10')
  const [codes, setCodes] = useState<string[]>([])
  const [codesMsg, setCodesMsg] = useState('')

  async function gift() {
    const email = giftEmail.trim().toLowerCase()
    if (!email) return
    setBusy(true); setGiftMsg('')
    try {
      const r = await fetch('/api/workbooks/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'grant', email, slug: PLANNER_SLUG }),
      })
      const d = await r.json().catch(() => ({}))
      setGiftMsg(r.ok ? `✓ ${email} can now use the planner — it unlocks when they sign in with that email.` : (d?.error || 'Couldn’t give access.'))
      if (r.ok) setGiftEmail('')
    } catch { setGiftMsg('Couldn’t give access — try again.') }
    setBusy(false)
  }

  async function generate() {
    setBusy(true); setCodesMsg(''); setCodes([])
    try {
      const r = await fetch('/api/workbooks/codes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(codeCount, 10) || 1, slug: PLANNER_SLUG }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(d.codes)) setCodes(d.codes)
      else setCodesMsg(d?.error || 'Couldn’t generate codes.')
    } catch { setCodesMsg('Couldn’t generate codes — try again.') }
    setBusy(false)
  }

  async function copyCodes() {
    try { await navigator.clipboard.writeText(codes.join('\n')); setCodesMsg(`Copied ${codes.length} codes.`) }
    catch { setCodesMsg('Select + copy them manually.') }
  }

  return (
    <section className="border border-gold/15 rounded-sm p-5 space-y-5">
      <div>
        <h2 className="font-display text-2xl italic text-parchment">The planner</h2>
        <p className="font-body text-ash text-sm leading-relaxed mt-2">
          Sold here and on Etsy. Whoever holds it can sync it across their phone, laptop and tablet, and connect with
          other planners. Give someone access by email, or generate unlock codes to include with an Etsy download.
        </p>
        <p className="font-body text-ash/60 text-xs mt-2">
          They open <span className="text-gold/80">{plannerUrl}</span>, sign in with their email, and enter the code.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 items-end">
          <label className="block flex-1">
            <span className={label}>Give it to an email (free, no code)</span>
            <input type="email" value={giftEmail} onChange={e => setGiftEmail(e.target.value)} className={input} placeholder="name@email.com" />
          </label>
          <button type="button" onClick={gift} disabled={busy} className={ghostBtn}>Give access</button>
        </div>
        {giftMsg && <p className="font-body text-ash text-xs">{giftMsg}</p>}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 items-end">
          <label className="block">
            <span className={label}>Unlock codes (for Etsy / off-site)</span>
            <input type="number" min={1} max={200} value={codeCount} onChange={e => setCodeCount(e.target.value)} className={`${input} w-24`} />
          </label>
          <button type="button" onClick={generate} disabled={busy} className={ghostBtn}>Generate</button>
        </div>
        {codes.length > 0 && (
          <div className="border border-gold/20 rounded-sm p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className={label} style={{ marginBottom: 0 }}>{codes.length} new codes — each works once</span>
              <button type="button" onClick={copyCodes} className="font-label text-[9px] tracking-[1px] uppercase text-gold hover:opacity-80">Copy all</button>
            </div>
            <pre className="font-body text-parchment text-xs whitespace-pre-wrap break-all">{codes.join('\n')}</pre>
          </div>
        )}
        {codesMsg && <p className="font-body text-ash text-xs">{codesMsg}</p>}
      </div>
    </section>
  )
}
