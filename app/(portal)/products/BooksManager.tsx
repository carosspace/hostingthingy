'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { resizeToDataUrl } from '@/lib/sites/image'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { createResourceUploadUrl } from '../resources/actions'

export interface ProductInput {
  slug: string
  title: string
  kind: 'workbook' | 'download'
  access: 'free' | 'members' | 'paid'
  tierId: string | null
  priceCents: number
  salePriceCents: number | null
  currency: string
  description: string
  coverImage: string
  tagline: string
  landingMode: 'form' | 'html'
  landingBody: string
  landingHtml: string
  fileName: string | null
  mime: string | null
  companionFileName: string | null
  hasCompanion: boolean
  hidden: boolean
  hasContent: boolean
  updatedAt: string | null
}

// Download file types (mirror of the resources allowlist) + a content-type per extension.
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf', epub: 'application/epub+zip', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', mov: 'video/quicktime', zip: 'application/zip',
}
const FILE_EXTS = Object.keys(CONTENT_TYPES)
const MAX_FILE_BYTES = 104857600 // 100 MB

const input = 'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none'
const label = 'font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1'
const btn = 'font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:opacity-90 disabled:opacity-50 px-5 py-3 rounded-sm transition-opacity'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}
function blank(): ProductInput {
  return { slug: '', title: '', kind: 'workbook', access: 'paid', tierId: null, priceCents: 2200, salePriceCents: null, currency: 'eur', description: '', coverImage: '', tagline: '', landingMode: 'form', landingBody: '', landingHtml: '', fileName: null, mime: null, companionFileName: null, hasCompanion: false, hidden: false, hasContent: false, updatedAt: null }
}

function ItemCard({ initial, siteBase, tiers }: { initial: ProductInput; siteBase: string; tiers: { id: string; name: string }[] }) {
  const router = useRouter()
  const isNew = !initial.slug
  const [p, setP] = useState<ProductInput>(initial)
  const [priceStr, setPriceStr] = useState(String((initial.priceCents || 0) / 100))
  const [saleStr, setSaleStr] = useState(initial.salePriceCents ? String(initial.salePriceCents / 100) : '')
  const [newHtml, setNewHtml] = useState<string | null>(null)
  const [newFile, setNewFile] = useState<File | null>(null)
  const [newCompanion, setNewCompanion] = useState<File | null>(null)
  const [removeCompanion, setRemoveCompanion] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const companionRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(isNew)
  // gift + unlock codes (existing products only)
  const [giftEmail, setGiftEmail] = useState('')
  const [giftMsg, setGiftMsg] = useState('')
  const [codeCount, setCodeCount] = useState('10')
  const [madeCodes, setMadeCodes] = useState<string[]>([])
  const [codesMsg, setCodesMsg] = useState('')
  const [gcBusy, setGcBusy] = useState(false)

  const set = (patch: Partial<ProductInput>) => setP(prev => ({ ...prev, ...patch }))
  const slug = p.slug || slugify(p.title)

  async function onCover(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    try { set({ coverImage: await resizeToDataUrl(f, 900, 0.82) }) } catch { setMsg('Couldn’t read that image.') }
  }
  async function onWorkbook(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    setNewHtml(await f.text())
  }
  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setNewFile(e.target.files?.[0] || null)
  }
  function onCompanion(e: React.ChangeEvent<HTMLInputElement>) {
    setNewCompanion(e.target.files?.[0] || null)
    if (e.target.files?.[0]) setRemoveCompanion(false)
  }

  async function save() {
    if (!p.title.trim()) { setMsg('Give it a title.'); return }
    if (!slug) { setMsg('That title can’t be turned into a web address — add some letters.'); return }
    let priceCents = 0, salePriceCents: number | null = null
    if (p.access === 'paid') {
      priceCents = Math.round(parseFloat(priceStr) * 100)
      if (!Number.isFinite(priceCents) || priceCents < 100) { setMsg('Enter a price (at least 1).'); return }
      if (saleStr.trim()) {
        salePriceCents = Math.round(parseFloat(saleStr) * 100)
        if (!Number.isFinite(salePriceCents) || salePriceCents < 100 || salePriceCents >= priceCents) { setMsg('The reduced price must be lower than the price.'); return }
      }
    }
    if (p.access === 'members' && !p.tierId) { setMsg('Pick the membership that unlocks this.'); return }

    setBusy(true); setMsg('')
    try {
      // For a download, the file must be in storage before we save (save records its path).
      let filePath: string | undefined, fileName: string | undefined, fileSize: number | undefined, mime: string | undefined
      if (p.kind === 'download' && newFile) {
        const ext = (newFile.name.split('.').pop() || '').toLowerCase()
        if (!FILE_EXTS.includes(ext)) { setMsg('Use a PDF, ebook, doc, audio, video or zip file.'); setBusy(false); return }
        if (newFile.size > MAX_FILE_BYTES) { setMsg('That file is over 100 MB.'); setBusy(false); return }
        const up = await createResourceUploadUrl(ext)
        if (!up.ok) { setMsg(up.error); setBusy(false); return }
        const supabase = createSupabaseBrowserClient()
        const contentType = CONTENT_TYPES[ext] || newFile.type || 'application/octet-stream'
        const put = await supabase.storage.from('site-resources').uploadToSignedUrl(up.path, up.token, newFile, { contentType })
        if (put.error) { setMsg('The file didn’t upload — try again.'); setBusy(false); return }
        filePath = up.path; fileName = newFile.name; fileSize = newFile.size; mime = contentType
      }

      // Companion printable for an interactive workbook (buyers get both) — upload before save.
      let companionFilePath: string | undefined, companionFileName: string | undefined, companionFileSize: number | undefined, companionMime: string | undefined
      if (p.kind === 'workbook' && newCompanion) {
        const ext = (newCompanion.name.split('.').pop() || '').toLowerCase()
        if (!FILE_EXTS.includes(ext)) { setMsg('The companion must be a PDF, ebook, doc, audio, video or zip file.'); setBusy(false); return }
        if (newCompanion.size > MAX_FILE_BYTES) { setMsg('That companion file is over 100 MB.'); setBusy(false); return }
        const up = await createResourceUploadUrl(ext)
        if (!up.ok) { setMsg(up.error); setBusy(false); return }
        const supabase = createSupabaseBrowserClient()
        const contentType = CONTENT_TYPES[ext] || newCompanion.type || 'application/octet-stream'
        const put = await supabase.storage.from('site-resources').uploadToSignedUrl(up.path, up.token, newCompanion, { contentType })
        if (put.error) { setMsg('The companion file didn’t upload — try again.'); setBusy(false); return }
        companionFilePath = up.path; companionFileName = newCompanion.name; companionFileSize = newCompanion.size; companionMime = contentType
      }

      const r = await fetch('/api/products/save', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug, kind: p.kind, access: p.access, tierId: p.tierId, priceCents, salePriceCents,
          currency: p.currency, title: p.title.trim(), description: p.description, tagline: p.tagline,
          coverImage: p.coverImage, landingMode: p.landingMode, landingBody: p.landingBody, landingHtml: p.landingHtml,
          hidden: p.hidden, filePath, fileName, fileSize, mime,
          companionFilePath, companionFileName, companionFileSize, companionMime,
          removeCompanion: p.kind === 'workbook' && removeCompanion && !newCompanion,
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d?.error || 'Couldn’t save — try again.'); setBusy(false); return }

      // For an interactive workbook, upload the HTML after save (avoids clobbering the row).
      if (p.kind === 'workbook' && newHtml) {
        const upl = await fetch('/api/workbooks/upload', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug, html: newHtml }),
        })
        if (!upl.ok) { const e = await upl.json().catch(() => ({})); setMsg(`Saved — but the workbook file didn’t upload (${e?.error || 'try again'}). Click Save once more.`); setBusy(false); return }
      }
      setMsg(d?.warn || '✓ Saved — it’s live.'); setNewHtml(null); setNewFile(null); setNewCompanion(null); setRemoveCompanion(false)
      if (fileRef.current) fileRef.current.value = ''; if (companionRef.current) companionRef.current.value = ''
      router.refresh()
    } catch { setMsg('Couldn’t save — try again.') }
    setBusy(false)
  }

  async function del() {
    if (!p.slug) return
    if (!confirm(`Delete “${p.title}”? This removes it from your library, its sales page, and anyone’s access. This can’t be undone.`)) return
    setBusy(true); setMsg('')
    try {
      const r = await fetch('/api/products/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: p.slug }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setMsg(d?.error || 'Couldn’t delete — try again.'); setBusy(false); return }
      router.refresh()
    } catch { setMsg('Couldn’t delete — try again.'); setBusy(false) }
  }

  async function gift() {
    const email = giftEmail.trim().toLowerCase()
    if (!email) return
    setGcBusy(true); setGiftMsg('')
    try {
      const r = await fetch('/api/workbooks/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'grant', email, slug: p.slug }) })
      const d = await r.json().catch(() => ({}))
      setGiftMsg(r.ok ? `✓ Gifted to ${email} — it appears when they sign in with that email.` : (d?.error || 'Couldn’t gift it.'))
      if (r.ok) setGiftEmail('')
    } catch { setGiftMsg('Couldn’t gift it — try again.') }
    setGcBusy(false)
  }
  async function genCodes() {
    setGcBusy(true); setCodesMsg(''); setMadeCodes([])
    try {
      const r = await fetch('/api/workbooks/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: parseInt(codeCount, 10) || 1, slug: p.slug }) })
      const d = await r.json().catch(() => ({}))
      if (r.ok && Array.isArray(d.codes)) setMadeCodes(d.codes)
      else setCodesMsg(d?.error || 'Couldn’t generate codes.')
    } catch { setCodesMsg('Couldn’t generate codes — try again.') }
    setGcBusy(false)
  }
  async function copyCodes() {
    try { await navigator.clipboard.writeText(madeCodes.join('\n')); setCodesMsg(`Copied ${madeCodes.length} codes.`) }
    catch { setCodesMsg('Select + copy them manually.') }
  }

  const accessLabel = p.access === 'free' ? 'Free' : p.access === 'members' ? 'Members only' : (p.priceCents ? `€${p.priceCents / 100}${p.salePriceCents ? ` (sale €${p.salePriceCents / 100})` : ''}` : 'no price')

  return (
    <div className="border border-gold/15 rounded-sm overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-gold/5 transition-colors">
        <div className="w-12 h-16 rounded-sm flex-shrink-0 bg-cover bg-center border border-gold/15" style={{ background: p.coverImage ? `url('${p.coverImage}') center/cover` : 'linear-gradient(160deg,#241307,#3D2415)' }} />
        <div className="min-w-0 flex-1">
          <p className="font-body text-parchment truncate">{p.title || 'Untitled'}</p>
          <p className="font-body text-ash/60 text-xs mt-0.5">
            {p.kind === 'download' ? 'File' : 'Interactive'} · {accessLabel} · {p.hasContent ? 'ready' : (p.kind === 'download' ? 'no file yet' : 'no workbook yet')}{p.hidden ? ' · hidden' : ''}
          </p>
        </div>
        <span className="font-label text-[9px] tracking-[2px] uppercase text-gold/60">{open ? 'Close' : 'Edit'}</span>
      </button>

      {open && (
        <div className="p-5 pt-0 space-y-4 border-t border-gold/10">
          {/* Type */}
          <div className="pt-4">
            <span className={label}>Type</span>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.kind === 'workbook'} onChange={() => set({ kind: 'workbook' })} /> <span className="text-parchment">Interactive workbook</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.kind === 'download'} onChange={() => set({ kind: 'download' })} /> <span className="text-parchment">File (ebook / PDF / meditation)</span></label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block sm:col-span-2"><span className={label}>Title</span>
              <input value={p.title} onChange={e => set({ title: e.target.value })} className={input} placeholder="Meeting Yourself" />
              {isNew && p.title && <span className="font-body text-ash/40 text-[11px] mt-1 block">web address: {siteBase}/{slug}</span>}
            </label>
            <label className="block sm:col-span-2"><span className={label}>Short line (shown on the library card)</span>
              <input value={p.description} onChange={e => set({ description: e.target.value })} className={input} placeholder="A book and ten quiet rooms for the slow walk home to yourself." />
            </label>
            <label className="block"><span className={label}>Cover picture</span>
              <input type="file" accept="image/*" onChange={onCover} className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer" />
              {p.coverImage && <button type="button" onClick={() => set({ coverImage: '' })} className="font-label text-[9px] tracking-[1px] uppercase text-ash/50 hover:text-red-400 mt-1">Remove cover</button>}
            </label>
          </div>

          {/* Pricing / access */}
          <div className="border border-gold/10 rounded-sm p-4 space-y-3">
            <span className={label} style={{ marginBottom: 6 }}>Pricing</span>
            <div className="flex flex-wrap gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.access === 'free'} onChange={() => set({ access: 'free' })} /> <span className="text-parchment">Free</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.access === 'members'} onChange={() => set({ access: 'members' })} /> <span className="text-parchment">Members only</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.access === 'paid'} onChange={() => set({ access: 'paid' })} /> <span className="text-parchment">Sell it (price)</span></label>
            </div>
            {p.access === 'members' && (
              <label className="block"><span className={label}>Which membership unlocks it</span>
                <select value={p.tierId || ''} onChange={e => set({ tierId: e.target.value || null })} className={input}>
                  <option value="">Choose a membership…</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                {tiers.length === 0 && <span className="font-body text-ash/40 text-[11px] mt-1 block">You have no memberships yet — create one under Memberships first.</span>}
              </label>
            )}
            {p.access === 'paid' && (
              <div className="flex items-end gap-3">
                <label className="block"><span className={label}>Price</span>
                  <div className="flex items-center gap-2">
                    <select value={p.currency} onChange={e => set({ currency: e.target.value })} className={input} style={{ width: 64 }}><option value="eur">€</option><option value="usd">$</option><option value="gbp">£</option></select>
                    <input value={priceStr} onChange={e => setPriceStr(e.target.value)} className={input} inputMode="decimal" placeholder="22" style={{ width: 90 }} />
                  </div>
                </label>
                <label className="block"><span className={label}>Reduced price (optional)</span>
                  <input value={saleStr} onChange={e => setSaleStr(e.target.value)} className={input} inputMode="decimal" placeholder="—" style={{ width: 100 }} />
                </label>
              </div>
            )}
          </div>

          {/* Content */}
          {p.kind === 'workbook' ? (
            <div className="space-y-4">
              <label className="block"><span className={label}>{p.hasContent ? 'Replace the workbook file (optional)' : 'Upload the workbook file (the interactive .html)'}</span>
                <input type="file" accept=".html,text/html" onChange={onWorkbook} className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer" />
                {newHtml && <span className="font-body text-emerald-400/80 text-[11px] mt-1 block">Ready — click Save to publish it.</span>}
              </label>
              <label className="block"><span className={label}>Companion printable (optional) — a PDF buyers also get</span>
                <input ref={companionRef} type="file" accept=".pdf,.epub,.zip" onChange={onCompanion} className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer" />
                {newCompanion
                  ? <span className="font-body text-emerald-400/80 text-[11px] mt-1 block">Ready: {newCompanion.name} — click Save.</span>
                  : p.hasCompanion && !removeCompanion
                    ? <span className="font-body text-ash/40 text-[11px] mt-1 block">Current: {p.companionFileName || 'attached'} · <button type="button" onClick={() => setRemoveCompanion(true)} className="text-red-400/80 hover:text-red-400 uppercase tracking-wider">Remove</button></span>
                    : removeCompanion
                      ? <span className="font-body text-red-400/70 text-[11px] mt-1 block">Will be removed on Save. · <button type="button" onClick={() => setRemoveCompanion(false)} className="text-ash hover:text-gold uppercase tracking-wider">Keep</button></span>
                      : <span className="font-body text-ash/40 text-[11px] mt-1 block">Everyone who owns this gets the interactive book plus this file.</span>}
              </label>
            </div>
          ) : (
            <label className="block"><span className={label}>{p.hasContent ? 'Replace the file (optional)' : 'Upload the file (PDF, ebook, audio, video…)'}</span>
              <input ref={fileRef} type="file" accept={FILE_EXTS.map(e => `.${e}`).join(',')} onChange={onFile} className="font-body text-sm text-ash file:mr-3 file:py-1.5 file:px-3 file:rounded-sm file:border-0 file:bg-gold file:text-background file:font-label file:text-[10px] file:uppercase file:tracking-wider file:cursor-pointer" />
              {newFile && <span className="font-body text-emerald-400/80 text-[11px] mt-1 block">Ready: {newFile.name} — click Save.</span>}
              {!newFile && p.fileName && <span className="font-body text-ash/40 text-[11px] mt-1 block">Current: {p.fileName}</span>}
            </label>
          )}

          {/* Landing page */}
          <div className="border border-gold/10 rounded-sm p-4 space-y-3">
            <span className={label} style={{ marginBottom: 6 }}>Its page {p.access === 'paid' ? '(the sales page)' : ''}</span>
            <div className="flex gap-4 text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.landingMode === 'form'} onChange={() => set({ landingMode: 'form' })} /> <span className="text-parchment">Simple — build it for me</span></label>
              <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={p.landingMode === 'html'} onChange={() => set({ landingMode: 'html' })} /> <span className="text-parchment">My own HTML</span></label>
            </div>
            {p.landingMode === 'form' ? (
              <>
                <label className="block"><span className={label}>Tagline (optional)</span>
                  <input value={p.tagline} onChange={e => set({ tagline: e.target.value })} className={input} placeholder="the quiet work of finding your way back" /></label>
                <label className="block"><span className={label}>The words (one thought per paragraph — leave a blank line between)</span>
                  <textarea value={p.landingBody} onChange={e => set({ landingBody: e.target.value })} className={input} rows={6} /></label>
              </>
            ) : (
              <label className="block"><span className={label}>Paste your page HTML</span>
                <textarea value={p.landingHtml} onChange={e => set({ landingHtml: e.target.value })} className={`${input} font-mono text-[11px]`} rows={7} placeholder="<!DOCTYPE html>…" /></label>
            )}
          </div>

          {/* Gift + unlock codes (existing items only) */}
          {p.slug && (
            <div className="border border-gold/10 rounded-sm p-4 space-y-3">
              <span className={label} style={{ marginBottom: 2 }}>Gift &amp; unlock codes</span>
              <div className="flex items-end gap-2">
                <label className="block flex-1"><span className={label}>Gift it to an email (free, no code)</span>
                  <input type="email" value={giftEmail} onChange={e => setGiftEmail(e.target.value)} className={input} placeholder="name@email.com" /></label>
                <button type="button" onClick={gift} disabled={gcBusy} className="font-label text-[10px] tracking-[2px] uppercase text-gold border border-gold/40 rounded-sm px-3 py-2 hover:bg-gold/10 disabled:opacity-50">Gift</button>
              </div>
              {giftMsg && <p className="font-body text-ash text-xs">{giftMsg}</p>}
              <div className="flex items-end gap-2">
                <label className="block"><span className={label}>Unlock codes (for Etsy / off-site)</span>
                  <input type="number" min={1} max={200} value={codeCount} onChange={e => setCodeCount(e.target.value)} className={input} style={{ width: 80 }} /></label>
                <button type="button" onClick={genCodes} disabled={gcBusy} className="font-label text-[10px] tracking-[2px] uppercase text-gold border border-gold/40 rounded-sm px-3 py-2 hover:bg-gold/10 disabled:opacity-50">Generate</button>
              </div>
              {madeCodes.length > 0 && (
                <div className="border border-gold/25 bg-gold/5 rounded-sm p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-label text-[9px] tracking-[2px] uppercase text-gold">Just created — copy them now</span>
                    <button type="button" onClick={copyCodes} className="font-label text-[9px] tracking-[1px] uppercase text-gold hover:opacity-80">Copy all</button>
                  </div>
                  <div className="font-mono text-parchment text-xs leading-relaxed break-all">{madeCodes.join('  ·  ')}</div>
                </div>
              )}
              {codesMsg && <p className="font-body text-ash text-xs">{codesMsg}</p>}
              <p className="font-body text-ash/40 text-[11px]">Buyers enter a code in your portal to unlock this — works for workbooks and downloads.</p>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-1.5 cursor-pointer text-xs"><input type="checkbox" checked={p.hidden} onChange={e => set({ hidden: e.target.checked })} /> <span className="text-ash">Hide from the library</span></label>
            {p.slug && <a href={`${siteBase}/${p.slug}`} target="_blank" rel="noreferrer" className="font-label text-[9px] tracking-[2px] uppercase text-ash hover:text-gold">View page ↗</a>}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <button type="button" onClick={save} disabled={busy} className={btn}>{busy ? 'Saving…' : 'Save'}</button>
            {p.slug && <button type="button" onClick={del} disabled={busy} className="font-label text-[10px] tracking-[2px] uppercase text-red-400/80 hover:text-red-400 disabled:opacity-40">Delete</button>}
            {msg && <span className="font-body text-ash text-xs">{msg}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BooksManager({ products, siteBase, tiers = [] }: { products: ProductInput[]; siteBase: string; tiers?: { id: string; name: string }[] }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-4 max-w-2xl">
      {products.map(p => <ItemCard key={p.slug} initial={p} siteBase={siteBase} tiers={tiers} />)}
      {adding
        ? <ItemCard initial={blank()} siteBase={siteBase} tiers={tiers} />
        : <button type="button" onClick={() => setAdding(true)} className="w-full border border-dashed border-gold/25 rounded-sm py-4 font-label text-[10px] tracking-[3px] uppercase text-gold/70 hover:text-gold hover:border-gold/50 transition-colors">+ Add a resource</button>}
    </div>
  )
}
