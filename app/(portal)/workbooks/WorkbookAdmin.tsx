'use client'

import { useState } from 'react'

const inputCls =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'
const labelCls = 'font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1'

// Owner uploader for the portal workbook. Reads the chosen .html file's text in
// the browser and POSTs it (plus title + gating tier) to /api/workbooks/upload.
export default function WorkbookAdmin({
  initialTitle,
  initialTierId,
  hasContent,
  updatedAt,
  tiers,
}: {
  initialTitle: string
  initialTierId: string
  hasContent: boolean
  updatedAt: string | null
  tiers: { id: string; name: string }[]
}) {
  const [title, setTitle] = useState(initialTitle)
  const [tierId, setTierId] = useState(initialTierId)
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const text = await f.text()
    setHtml(text)
    setMsg(`Loaded ${f.name} (${Math.round(f.size / 1024)} KB). Click Save to publish it.`)
  }

  async function save() {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch('/api/workbooks/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, tierId, html }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok) {
        setMsg('✓ Saved — your workbook is live in the portal.')
        setHtml(null)
      } else {
        setMsg(d?.error || 'Couldn’t save — try again.')
      }
    } catch {
      setMsg('Couldn’t save — try again.')
    }
    setBusy(false)
  }

  return (
    <div className="border border-gold/15 rounded-sm p-6 max-w-xl space-y-5">
      <p className="font-body text-sm text-parchment">
        {hasContent
          ? `✦ A workbook is published${updatedAt ? ` — updated ${new Date(updatedAt).toLocaleDateString()}` : ''}.`
          : 'No workbook uploaded yet.'}
      </p>

      <label className="block">
        <span className={labelCls}>Title</span>
        <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
      </label>

      <label className="block">
        <span className={labelCls}>Who can open it</span>
        <select value={tierId} onChange={e => setTierId(e.target.value)} className={inputCls}>
          <option value="">Everyone with an account (free)</option>
          {tiers.map(t => (
            <option key={t.id} value={t.id}>
              Only buyers of: {t.name}
            </option>
          ))}
        </select>
        <span className="font-body text-ash/60 text-[11px] mt-1 block">
          Pick the tier buyers receive when they purchase or redeem a code. Leave “free” to give it to every
          logged-in member.
        </span>
      </label>

      <label className="block">
        <span className={labelCls}>{hasContent ? 'Replace the HTML file (optional)' : 'Upload the workbook HTML file'}</span>
        <input
          type="file"
          accept=".html,text/html"
          onChange={onFile}
          className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer"
        />
      </label>

      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:opacity-90 disabled:opacity-50 px-5 py-3 rounded-sm transition-opacity"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>

      {msg && <p className="font-body text-ash text-xs">{msg}</p>}
    </div>
  )
}
