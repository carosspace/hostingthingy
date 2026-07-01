'use client'

import { useState } from 'react'

const labelCls = 'font-label text-[9px] tracking-[2px] uppercase text-gold/50'
const inputCls =
  'mt-1 block w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-xs px-3 py-2 rounded-sm outline-none'

// Make THIS page render as a complete pasted HTML design (full-page, no site
// header/footer), or clear it to go back to the canvas editor. Owner-only via the
// /api/sites/full-html route. Reloads after a change so the editor reflects it.
export default function FullHtmlPanel({
  siteId,
  pageSlug,
  hasFullHtml,
  initialHtml,
}: {
  siteId: string
  pageSlug: string
  hasFullHtml: boolean
  initialHtml?: string
}) {
  const [html, setHtml] = useState(initialHtml ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) {
      setHtml(await f.text())
      setMsg(`Loaded ${f.name} (${Math.round(f.size / 1024)} KB). Click "Use as full page".`)
    }
  }

  async function apply(value: string, okMsg: string) {
    setBusy(true)
    setMsg('')
    try {
      const r = await fetch('/api/sites/full-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, pageSlug, html: value }),
      })
      if (r.ok) {
        setMsg(okMsg)
        setTimeout(() => window.location.reload(), 700)
      } else {
        const d = await r.json().catch(() => ({}))
        setMsg(d?.error || 'Couldn’t save — try again.')
        setBusy(false)
      }
    } catch {
      setMsg('Couldn’t save — try again.')
      setBusy(false)
    }
  }

  return (
    <div className="border-t border-gold/10 pt-4 mt-1 space-y-2">
      <p className={labelCls}>
        Full-page HTML
        {hasFullHtml && (
          <span style={{ color: '#8FA888' }} className="normal-case tracking-normal"> · active on this page</span>
        )}
      </p>

      {hasFullHtml ? (
        <p className="font-body text-ash/60 text-xs leading-relaxed">
          This whole page <em>is</em> your own HTML design (no site header/footer). Edit the code below and press
          Save — the preview updates. Or paste an updated design over it. Remove it to return to the canvas editor.
        </p>
      ) : (
        <p className="font-body text-ash/60 text-xs leading-relaxed">
          Paste a complete HTML design (e.g. from an AI design tool) to make this whole page <em>be</em> that design —
          your HTML, full-page, with no site header or footer.
        </p>
      )}

      <textarea
        value={html}
        onChange={e => setHtml(e.target.value)}
        placeholder="Paste your full-page HTML here…"
        spellCheck={false}
        className={inputCls}
        style={{ minHeight: hasFullHtml ? 340 : 120, fontFamily: 'monospace', resize: 'vertical', lineHeight: 1.5 }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".html,text/html"
          onChange={onFile}
          className="font-body text-[11px] text-ash file:mr-2 file:py-1 file:px-2 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[9px] file:uppercase file:cursor-pointer"
        />
        <button
          type="button"
          disabled={busy || !html.trim()}
          onClick={() => apply(html, hasFullHtml ? '✓ Saved — your changes are live.' : '✓ Set — this is now your full page.')}
          className="font-label text-[9px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2 rounded-sm disabled:opacity-50"
        >
          {busy ? 'Saving…' : hasFullHtml ? 'Save changes' : 'Use as full page'}
        </button>
        {hasFullHtml && (
          <button
            type="button"
            disabled={busy}
            onClick={() => apply('', 'Removed — back to the canvas.')}
            className="font-label text-[9px] tracking-[2px] uppercase border border-red-400/40 text-red-400 hover:bg-red-400/10 px-3 py-2 rounded-sm disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {msg && <p className="font-body text-ash text-xs">{msg}</p>}
    </div>
  )
}
