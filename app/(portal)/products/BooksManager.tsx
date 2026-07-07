'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { resizeToDataUrl } from '@/lib/sites/image'

export interface ProductInput {
  slug: string
  title: string
  priceCents: number
  currency: string
  description: string
  coverImage: string
  tagline: string
  landingMode: 'form' | 'html'
  landingBody: string
  landingHtml: string
  hidden: boolean
  hasContent: boolean
  updatedAt: string | null
}

const input = 'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'
const label = 'font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1'
const btn = 'font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:opacity-90 disabled:opacity-50 px-5 py-3 rounded-sm transition-opacity'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

function blank(): ProductInput {
  return { slug: '', title: '', priceCents: 2200, currency: 'eur', description: '', coverImage: '', tagline: '', landingMode: 'form', landingBody: '', landingHtml: '', hidden: false, hasContent: false, updatedAt: null }
}

function BookCard({ initial, siteBase }: { initial: ProductInput; siteBase: string }) {
  const router = useRouter()
  const isNew = !initial.slug
  const [p, setP] = useState<ProductInput>(initial)
  const [priceStr, setPriceStr] = useState(String((initial.priceCents || 0) / 100))
  const [newHtml, setNewHtml] = useState<string | null>(null) // freshly chosen workbook file
  const [newHtmlName, setNewHtmlName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(isNew)

  const set = (patch: Partial<ProductInput>) => setP(prev => ({ ...prev, ...patch }))
  const slug = p.slug || slugify(p.title)

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    try { set({ coverImage: await resizeToDataUrl(f, 900, 0.82) }) } catch { setMsg('Couldn’t read that image.') }
  }
  async function onWorkbook(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setNewHtml(await f.text())
    setNewHtmlName(f.name)
  }

  async function save() {
    const priceCents = Math.round(parseFloat(priceStr) * 100)
    if (!p.title.trim()) { setMsg('Give the book a title.'); return }
    if (!slug) { setMsg('That title can’t be turned into a web address — please add some letters or numbers.'); return }
    if (!Number.isFinite(priceCents) || priceCents < 100) { setMsg('Enter a price (at least 1).'); return }
    setBusy(true); setMsg('')
    try {
      // 1) save metadata + landing + library card FIRST. This validates the web address, so
      //    a rejected save never leaves an orphan file or overwrites another book's upload.
      const r = await fetch('/api/products/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, title: p.title.trim(), priceCents, currency: p.currency,
          description: p.description, tagline: p.tagline, coverImage: p.coverImage,
          landingMode: p.landingMode, landingBody: p.landingBody, landingHtml: p.landingHtml, hidden: p.hidden,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d?.error || 'Couldn’t save — try again.'); setBusy(false); return }
      // 2) then upload the interactive workbook file, if a new one was chosen.
      if (newHtml) {
        const up = await fetch('/api/workbooks/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, title: p.title.trim(), html: newHtml }),
        })
        if (!up.ok) { const e = await up.json().catch(() => ({})); setMsg(`Saved — but the workbook file didn’t upload (${e?.error || 'try again'}). Click Save once more.`); setBusy(false); return }
      }
      setMsg('✓ Saved — it’s live.')
      setNewHtml(null); setNewHtmlName('')
      router.refresh()
    } catch {
      setMsg('Couldn’t save — try again.')
    }
    setBusy(false)
  }

  return (
    <div className="border border-gold/15 rounded-sm overflow-hidden">
      {/* header row */}
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-gold/5 transition-colors">
        <div className="w-12 h-16 rounded-sm flex-shrink-0 bg-cover bg-center border border-gold/15"
          style={{ background: p.coverImage ? `url('${p.coverImage}') center/cover` : 'linear-gradient(160deg,#241307,#3D2415)' }} />
        <div className="min-w-0 flex-1">
          <p className="font-body text-parchment truncate">{p.title || 'Untitled book'}</p>
          <p className="font-body text-ash/60 text-xs mt-0.5">
            {p.priceCents ? `€${(p.priceCents / 100)}` : 'no price'} · {p.hasContent ? 'workbook uploaded' : 'no workbook yet'}{p.hidden ? ' · hidden' : ''}
          </p>
        </div>
        <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">{open ? 'Close' : 'Edit'}</span>
      </button>

      {open && (
        <div className="p-5 pt-0 space-y-4 border-t border-gold/10">
          <div className="grid sm:grid-cols-2 gap-4 pt-4">
            <label className="block sm:col-span-2"><span className={label}>Title</span>
              <input value={p.title} onChange={e => set({ title: e.target.value })} className={input} placeholder="Meeting Yourself" />
              {isNew && p.title && <span className="font-body text-ash/40 text-[11px] mt-1 block">web address: {siteBase}/{slug}</span>}
            </label>
            <label className="block"><span className={label}>Price</span>
              <div className="flex items-center gap-2">
                <select value={p.currency} onChange={e => set({ currency: e.target.value })} className={input} style={{ width: 70 }}>
                  <option value="eur">€</option><option value="usd">$</option><option value="gbp">£</option>
                </select>
                <input value={priceStr} onChange={e => setPriceStr(e.target.value)} className={input} inputMode="decimal" placeholder="22" />
              </div>
            </label>
            <label className="block"><span className={label}>Cover picture</span>
              <input type="file" accept="image/*" onChange={onCover}
                className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer" />
              {p.coverImage && <button type="button" onClick={() => set({ coverImage: '' })} className="font-label text-[9px] tracking-[1px] uppercase text-ash/50 hover:text-red-400 mt-1">Remove cover</button>}
            </label>
            <label className="block sm:col-span-2"><span className={label}>Short line (shown on the library card)</span>
              <input value={p.description} onChange={e => set({ description: e.target.value })} className={input} placeholder="A book and ten quiet rooms for the slow walk home to yourself." />
            </label>
          </div>

          {/* workbook file */}
          <label className="block"><span className={label}>{p.hasContent ? 'Replace the workbook file (optional)' : 'Upload the workbook file (the interactive .html)'}</span>
            <input type="file" accept=".html,text/html" onChange={onWorkbook}
              className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer" />
            {newHtmlName && <span className="font-body text-emerald-400/80 text-[11px] mt-1 block">Ready: {newHtmlName} — click Save to publish it.</span>}
          </label>

          {/* landing page */}
          <div className="border border-gold/10 rounded-sm p-4 space-y-3">
            <span className={label} style={{ marginBottom: 6 }}>Landing page (the sales page)</span>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.landingMode === 'form'} onChange={() => set({ landingMode: 'form' })} /> <span className="text-parchment">Simple — build it for me</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.landingMode === 'html'} onChange={() => set({ landingMode: 'html' })} /> <span className="text-parchment">My own HTML</span></label>
            </div>
            {p.landingMode === 'form' ? (
              <>
                <label className="block"><span className={label}>Tagline (optional)</span>
                  <input value={p.tagline} onChange={e => set({ tagline: e.target.value })} className={input} placeholder="the quiet work of finding your way back" /></label>
                <label className="block"><span className={label}>The words (one thought per paragraph — leave a blank line between)</span>
                  <textarea value={p.landingBody} onChange={e => set({ landingBody: e.target.value })} className={input} rows={7} placeholder={'You have probably done this before…\n\nThis is not more of that.'} /></label>
              </>
            ) : (
              <label className="block"><span className={label}>Paste your landing HTML (I’ll wire the Buy button + fix sizing)</span>
                <textarea value={p.landingHtml} onChange={e => set({ landingHtml: e.target.value })} className={`${input} font-mono text-[11px]`} rows={8} placeholder="<!DOCTYPE html>…" />
                <span className="font-body text-ash/40 text-[11px] mt-1 block">Tip: put <code className="text-gold/70">{'{{BUY}}'}</code> where you want the Buy button. If you don’t, one is added at the bottom.</span></label>
            )}
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" checked={p.hidden} onChange={e => set({ hidden: e.target.checked })} /> <span className="text-ash">Hide from the library</span></label>
            {p.slug && <a href={`${siteBase}/${p.slug}`} target="_blank" rel="noreferrer" className="font-label text-[9px] tracking-[2px] uppercase text-ash hover:text-gold">View page ↗</a>}
          </div>

          <div className="flex items-center gap-4">
            <button type="button" onClick={save} disabled={busy} className={btn}>{busy ? 'Saving…' : 'Save'}</button>
            {msg && <span className="font-body text-ash text-xs">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BooksManager({ products, siteBase }: { products: ProductInput[]; siteBase: string }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-4 max-w-2xl">
      {products.map(p => <BookCard key={p.slug} initial={p} siteBase={siteBase} />)}
      {adding
        ? <BookCard initial={blank()} siteBase={siteBase} />
        : <button type="button" onClick={() => setAdding(true)} className="w-full border border-dashed border-gold/25 rounded-sm py-4 font-label text-[10px] tracking-[3px] uppercase text-gold/70 hover:text-gold hover:border-gold/50 transition-colors">+ Add a book</button>}
    </div>
  )
}
