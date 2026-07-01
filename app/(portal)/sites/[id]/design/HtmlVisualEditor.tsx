'use client'

import { useEffect, useRef, useState } from 'react'
import 'grapesjs/dist/css/grapes.min.css'

// A CODE-BASED visual editor for a full-page HTML design: loads the page's raw HTML
// into GrapesJS so the owner can click text to edit it, drag elements, and restyle —
// then exports the edited HTML and saves it back. This is the editor for full-page
// HTML pages inside the free-canvas flow (the block editor is being retired).

// Split a full HTML document into its font/CSS <link>s, the CSS from <style> tags,
// and the <body> markup (what GrapesJS edits).
function split(html: string) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  const head = headMatch ? headMatch[1] : ''
  const links = (head.match(/<link[^>]*>/gi) || [])
    .filter(l => /rel=["']stylesheet["']/i.test(l))
    .map(l => (l.match(/href=["']([^"']+)["']/i) || [])[1])
    .filter(Boolean) as string[]
  const css = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [])
    .map(s => s.replace(/<\/?style[^>]*>/gi, ''))
    .join('\n')
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : html
  return { links, css, body }
}

export default function HtmlVisualEditor({
  siteId,
  pageSlug,
  initialHtml,
}: {
  siteId: string
  pageSlug: string
  initialHtml: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const edRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const grapesjs: any = (await import('grapesjs')).default
      const preset: any = (await import('grapesjs-preset-webpage')).default
      if (cancelled || !ref.current || edRef.current) return
      const { links, css, body } = split(initialHtml)
      edRef.current = grapesjs.init({
        container: ref.current,
        height: '80vh',
        fromElement: false,
        storageManager: false,
        plugins: [preset],
        canvas: { styles: links }, // load the design's fonts into the editing canvas
        components: body,
        style: css,
      })
      if (!cancelled) setReady(true)
    })()
    return () => {
      cancelled = true
      try {
        edRef.current?.destroy()
      } catch {}
      edRef.current = null
    }
  }, [initialHtml])

  async function save() {
    const ed = edRef.current
    if (!ed) return
    setBusy(true)
    setMsg('')
    // Rebuild the full document from the edited body + CSS, keeping the font links.
    const { links } = split(initialHtml)
    const linkTags = links.map(h => `<link href="${h}" rel="stylesheet">`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${linkTags}<style>${ed.getCss()}</style></head><body>${ed.getHtml()}</body></html>`
    try {
      const r = await fetch('/api/sites/full-html', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, pageSlug, html }),
      })
      setMsg(r.ok ? '✓ Saved — your changes are live.' : 'Couldn’t save — try again.')
    } catch {
      setMsg('Couldn’t save — try again.')
    }
    setBusy(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !ready}
          className="font-label text-[10px] tracking-[2px] uppercase bg-gold text-background hover:bg-goldLight px-5 py-2 rounded-sm disabled:opacity-50"
        >
          {busy ? 'Saving…' : '✓ Save changes'}
        </button>
        <span className="font-body text-ash/60 text-xs">
          Click text to edit · drag to move · use the right-hand panels to restyle
        </span>
        {msg && <span className="font-body text-ash text-xs">{msg}</span>}
      </div>
      {!ready && <p className="font-body text-ash/50 text-xs">Loading the visual editor…</p>}
      <div ref={ref} className="border border-gold/20 rounded-sm overflow-hidden" />
    </div>
  )
}
