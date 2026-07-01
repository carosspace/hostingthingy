'use client'

import { useState } from 'react'

interface Code {
  id: string
  code: string
  redeemedBy: string | null
  redeemedAt: string | null
}

const inputCls =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'
const labelCls = 'font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1'

export default function WorkbookAdmin({
  initialTitle,
  hasContent,
  updatedAt,
  initialCodes,
}: {
  initialTitle: string
  hasContent: boolean
  updatedAt: string | null
  initialCodes: Code[]
}) {
  const [title, setTitle] = useState(initialTitle)
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const [codes, setCodes] = useState<Code[]>(initialCodes)
  const [howMany, setHowMany] = useState('10')
  const [genBusy, setGenBusy] = useState(false)
  const [justMade, setJustMade] = useState<string[]>([])
  const [copyMsg, setCopyMsg] = useState('')

  const redeemed = codes.filter(c => c.redeemedBy).length
  const available = codes.filter(c => !c.redeemedBy)

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
        body: JSON.stringify({ title, html }),
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

  async function generate() {
    setGenBusy(true)
    setJustMade([])
    setCopyMsg('')
    try {
      const r = await fetch('/api/workbooks/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(howMany, 10) || 1 }),
      })
      const d = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(d.codes)) {
        const fresh: Code[] = d.codes.map((c: string) => ({ id: c, code: c, redeemedBy: null, redeemedAt: null }))
        setJustMade(d.codes)
        setCodes(prev => [...fresh, ...prev])
      } else {
        setCopyMsg(d?.error || 'Couldn’t generate codes — try again.')
      }
    } catch {
      setCopyMsg('Couldn’t generate codes — try again.')
    }
    setGenBusy(false)
  }

  async function copy(list: string[], label: string) {
    try {
      await navigator.clipboard.writeText(list.join('\n'))
      setCopyMsg(`Copied ${list.length} ${label}.`)
    } catch {
      setCopyMsg('Couldn’t copy — select and copy manually.')
    }
  }

  return (
    <div className="space-y-8 max-w-xl">
      {/* Upload */}
      <div className="border border-gold/15 rounded-sm p-6 space-y-5">
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

      {/* Unlock codes */}
      <div className="border border-gold/15 rounded-sm p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="font-label text-[10px] tracking-[3px] uppercase text-gold">Unlock codes</span>
          <span className="font-body text-ash/60 text-xs">
            {codes.length} total · {redeemed} redeemed · {available.length} unused
          </span>
        </div>
        <p className="font-body text-ash/70 text-[12px] leading-relaxed">
          Generate codes and give one to each buyer (website, Etsy, anywhere). They enter it in the portal to unlock
          the workbook on their own account.
        </p>

        <div className="flex items-end gap-3">
          <label className="block">
            <span className={labelCls}>How many</span>
            <input
              type="number"
              min="1"
              max="200"
              value={howMany}
              onChange={e => setHowMany(e.target.value)}
              className={inputCls}
              style={{ width: 90 }}
            />
          </label>
          <button
            type="button"
            onClick={generate}
            disabled={genBusy}
            className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:opacity-90 disabled:opacity-50 px-4 py-2.5 rounded-sm transition-opacity"
          >
            {genBusy ? 'Generating…' : 'Generate codes'}
          </button>
        </div>

        {justMade.length > 0 && (
          <div className="border border-gold/25 bg-gold/5 rounded-sm p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-label text-[9px] tracking-[2px] uppercase text-gold">Just created — copy these now</span>
              <button
                type="button"
                onClick={() => copy(justMade, 'codes')}
                className="font-label text-[9px] tracking-[1px] uppercase text-gold hover:opacity-80"
              >
                Copy all
              </button>
            </div>
            <div className="font-mono text-parchment text-xs leading-relaxed break-all">{justMade.join('  ·  ')}</div>
          </div>
        )}

        {available.length > 0 && (
          <button
            type="button"
            onClick={() => copy(available.map(c => c.code), 'unused codes')}
            className="font-label text-[9px] tracking-[1px] uppercase text-ash hover:text-gold transition-colors"
          >
            Copy all {available.length} unused codes
          </button>
        )}
        {copyMsg && <p className="font-body text-ash text-xs">{copyMsg}</p>}

        {codes.length > 0 && (
          <div className="max-h-64 overflow-y-auto space-y-1 pt-1">
            {codes.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-2 border-b border-gold/8 py-1.5">
                <span className="font-mono text-parchment text-xs">{c.code}</span>
                <span className="font-body text-[11px]" style={{ color: c.redeemedBy ? '#8FA888' : 'rgba(110,90,64,0.9)' }}>
                  {c.redeemedBy ? `used · ${c.redeemedBy}` : 'available'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
