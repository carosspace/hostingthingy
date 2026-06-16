'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { THEMES } from '@/lib/sites/types'
import type { SiteContent, SiteTheme, CtaType, SiteLayout } from '@/lib/sites/types'
import { FONT_SYSTEMS, fontVars } from '@/lib/sites/fonts'
import { saveSiteContentJsonAction, aiSectionAction } from '../../actions'

interface EdSection {
  id: string
  heading: string
  body: string
  image: string
  bgImage: string
  ctaLabel: string
  ctaType: CtaType
  ctaHref: string
}

interface BtnPatch {
  type?: CtaType
  label?: string
  href?: string
}

const edStyle: CSSProperties = { outline: 'none', cursor: 'text', minHeight: '1em' }
const urlInput: CSSProperties = {
  background: 'rgba(255,255,255,0.65)',
  color: '#222',
  border: '1px solid rgba(0,0,0,0.1)',
}

// Resize an uploaded image in the browser and return a compact data URL.
// Keeps the page self-contained (no storage bucket needed) while staying small.
function resizeToDataUrl(file: File, maxW = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const img = new window.Image()
      img.onerror = () => reject(new Error('decode failed'))
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width)
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('no canvas'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  async function handle(file?: File | null) {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    try {
      onChange(await resizeToDataUrl(file))
    } catch {
      /* ignore bad image */
    } finally {
      setBusy(false)
    }
  }
  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault()
        setDrag(false)
        handle(e.dataTransfer.files?.[0])
      }}
      className="rounded-sm text-center"
      style={{
        border: `1.5px dashed ${drag ? '#a85c36' : 'rgba(0,0,0,0.18)'}`,
        background: drag ? 'rgba(201,168,76,0.1)' : 'rgba(255,255,255,0.5)',
        padding: 10,
      }}
    >
      {value ? (
        <div className="flex items-center justify-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" style={{ height: 40, width: 60, objectFit: 'cover', borderRadius: 3 }} />
          <label style={{ cursor: 'pointer', fontSize: 11, color: '#444', textDecoration: 'underline' }}>
            {busy ? 'replacing…' : 'replace'}
            <input type="file" accept="image/*" hidden onChange={e => handle(e.target.files?.[0])} />
          </label>
          <button type="button" onClick={() => onChange('')} style={{ fontSize: 11, color: '#b3402f' }}>
            remove
          </button>
        </div>
      ) : (
        <label style={{ cursor: 'pointer', fontSize: 11, color: '#555', display: 'block' }}>
          {busy ? 'Adding…' : 'Drag an image here, or click to upload'}
          <input type="file" accept="image/*" hidden onChange={e => handle(e.target.files?.[0])} />
        </label>
      )}
    </div>
  )
}

// A small reusable "button" editor (target + label + custom link). Used for the
// hero button and for every section button.
function ButtonControl({
  title,
  type,
  label,
  href,
  siteSlug,
  onChange,
}: {
  title: string
  type: CtaType
  label: string
  href: string
  siteSlug: string
  onChange: (patch: BtnPatch) => void
}) {
  return (
    <div className="rounded-sm" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(0,0,0,0.1)', padding: 10 }}>
      <div className="flex items-center justify-between gap-2">
        <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>{title}</span>
        <select
          value={type}
          onChange={e => onChange({ type: e.target.value as CtaType })}
          style={{ ...urlInput, fontSize: 12, padding: '5px 6px', borderRadius: 3 }}
        >
          <option value="none">No button</option>
          <option value="booking">→ Booking page</option>
          <option value="email">→ Email me</option>
          <option value="link">→ Custom link</option>
        </select>
      </div>
      {type !== 'none' && (
        <>
          <input
            value={label}
            onChange={e => onChange({ label: e.target.value })}
            placeholder="Button text"
            className="w-full mt-2"
            style={{ ...urlInput, fontSize: 13, padding: '7px 10px', borderRadius: 3 }}
          />
          {type === 'link' && (
            <input
              value={href}
              onChange={e => onChange({ href: e.target.value })}
              placeholder="https://example.com  or  mailto:you@email.com"
              className="w-full mt-2"
              style={{ ...urlInput, fontSize: 12, padding: '7px 10px', borderRadius: 3 }}
            />
          )}
          <p style={{ fontSize: 11, color: '#666', marginTop: 6 }}>
            {type === 'booking' && `Goes to your booking page (/book/${siteSlug}).`}
            {type === 'email' && 'Opens an email to your contact address.'}
            {type === 'link' && 'Goes to the link above.'}
          </p>
        </>
      )}
    </div>
  )
}

export default function LiveEditor({
  siteId,
  siteSlug,
  siteName,
  siteStatus,
  pageSlug,
  initial,
}: {
  siteId: string
  siteSlug: string
  siteName: string
  siteStatus: string
  pageSlug: string
  initial: SiteContent | null
}) {
  const idc = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<SiteTheme>(initial?.theme ?? 'sand')
  const [accentColor, setAccentColor] = useState(initial?.accentColor ?? '')
  const [layout, setLayout] = useState<SiteLayout>(initial?.layout ?? 'contained')
  const [fontSystem, setFontSystem] = useState(initial?.fontSystem ?? 'serif')
  const [heroImage, setHeroImage] = useState(initial?.heroImage ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '')
  const [seoTitle, setSeoTitle] = useState(initial?.seoTitle ?? '')
  const [seoDescription, setSeoDescription] = useState(initial?.seoDescription ?? '')
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel ?? '')
  const [ctaType, setCtaType] = useState<CtaType>(initial?.ctaType ?? 'none')
  const [ctaHref, setCtaHref] = useState(initial?.ctaHref ?? '')
  const [sections, setSections] = useState<EdSection[]>(
    (initial?.sections ?? []).map((s, i) => ({
      id: 'i' + i,
      heading: s.heading,
      body: s.body,
      image: s.image ?? '',
      bgImage: s.bgImage ?? '',
      ctaLabel: s.ctaLabel ?? '',
      ctaType: s.ctaType ?? 'none',
      ctaHref: s.ctaHref ?? '',
    })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [aiFor, setAiFor] = useState('')
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [addAiOpen, setAddAiOpen] = useState(false)
  const [addAiText, setAddAiText] = useState('')

  const t = THEMES[theme]
  const accent = accentColor || t.accent

  const ctaPreview =
    ctaType !== 'none' ? (
      <div className="mt-6">
        <span
          className="font-label inline-block"
          style={{ background: accent, color: t.bg, padding: '12px 28px', borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}
        >
          {ctaLabel || 'Book a session'}
        </span>
      </div>
    ) : null

  function touched() {
    setSaved(false)
  }
  function newId() {
    idc.current += 1
    return 'n' + idc.current
  }
  function addSection() {
    setSections(p => [...p, { id: newId(), heading: 'New section', body: 'Tell your story here…', image: '', bgImage: '', ctaLabel: '', ctaType: 'none', ctaHref: '' }])
    touched()
  }
  function duplicate(id: string) {
    const root = rootRef.current
    const read = (f: string) => ((root?.querySelector(`[data-field="${f}"]`) as HTMLElement | null)?.innerText ?? '')
    setSections(p => {
      const i = p.findIndex(s => s.id === id)
      if (i < 0) return p
      const src = p[i]
      const copy: EdSection = { ...src, id: newId(), heading: read('h-' + id) || src.heading, body: read('b-' + id) || src.body }
      const n = [...p]
      n.splice(i + 1, 0, copy)
      return n
    })
    touched()
  }
  function setSectionField(id: string, patch: Partial<EdSection>) {
    setSections(p => p.map(s => (s.id === id ? { ...s, ...patch } : s)))
    touched()
  }
  function sectionBtnChange(id: string, patch: BtnPatch) {
    setSectionField(id, {
      ...(patch.type !== undefined ? { ctaType: patch.type } : {}),
      ...(patch.label !== undefined ? { ctaLabel: patch.label } : {}),
      ...(patch.href !== undefined ? { ctaHref: patch.href } : {}),
    })
  }
  function heroBtnChange(patch: BtnPatch) {
    if (patch.type !== undefined) setCtaType(patch.type)
    if (patch.label !== undefined) setCtaLabel(patch.label)
    if (patch.href !== undefined) setCtaHref(patch.href)
    touched()
  }
  function domText(field: string) {
    return (rootRef.current?.querySelector(`[data-field="${field}"]`) as HTMLElement | null)?.innerText ?? ''
  }
  async function runSectionAi(id: string, instruction: string) {
    setAiBusy(true)
    try {
      const res = await aiSectionAction({ siteId, instruction, heading: domText('h-' + id), body: domText('b-' + id) })
      const h = rootRef.current?.querySelector(`[data-field="h-${id}"]`) as HTMLElement | null
      const b = rootRef.current?.querySelector(`[data-field="b-${id}"]`) as HTMLElement | null
      if (h && res.heading) h.innerText = res.heading
      if (b && res.body) b.innerText = res.body
      touched()
    } finally {
      setAiBusy(false)
      setAiFor('')
      setAiText('')
    }
  }
  async function addAiSection() {
    const prompt = addAiText.trim()
    if (!prompt) return
    setAiBusy(true)
    try {
      const res = await aiSectionAction({ siteId, instruction: prompt, heading: '', body: '' })
      setSections(p => [...p, { id: newId(), heading: res.heading || 'New section', body: res.body || '', image: '', bgImage: '', ctaLabel: '', ctaType: 'none', ctaHref: '' }])
      touched()
    } finally {
      setAiBusy(false)
      setAddAiOpen(false)
      setAddAiText('')
    }
  }
  function removeSection(id: string) {
    setSections(p => p.filter(s => s.id !== id))
    touched()
  }
  function move(id: string, dir: -1 | 1) {
    setSections(p => {
      const i = p.findIndex(s => s.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= p.length) return p
      const n = [...p]
      const tmp = n[i]
      n[i] = n[j]
      n[j] = tmp
      return n
    })
    touched()
  }
  async function save() {
    setSaving(true)
    const root = rootRef.current
    const read = (f: string) =>
      ((root?.querySelector(`[data-field="${f}"]`) as HTMLElement | null)?.innerText ?? '').trim()
    const built = sections
      .map(s => ({
        heading: read('h-' + s.id),
        body: read('b-' + s.id),
        image: s.image.trim() || undefined,
        bgImage: s.bgImage.trim() || undefined,
        ctaType: s.ctaType === 'none' ? undefined : s.ctaType,
        ctaLabel: s.ctaType === 'none' ? undefined : s.ctaLabel.trim() || 'Learn more',
        ctaHref: s.ctaType === 'link' ? s.ctaHref.trim() || undefined : undefined,
      }))
      .filter(s => s.heading || s.body || s.image || s.bgImage)
    const content: SiteContent = {
      theme,
      accentColor: accentColor || undefined,
      layout,
      fontSystem,
      brand: read('brand') || undefined,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      headline: read('headline'),
      subheadline: read('subheadline'),
      heroImage: heroImage.trim() || undefined,
      sections: built,
      ctaType: ctaType === 'none' ? undefined : ctaType,
      ctaLabel: ctaType === 'none' ? undefined : ctaLabel.trim() || 'Book a session',
      ctaHref: ctaType === 'link' ? ctaHref.trim() || undefined : undefined,
      contactLabel: read('contactLabel') || undefined,
      contactEmail: contactEmail.trim(),
      footer: read('footer') || undefined,
    }
    const fd = new FormData()
    fd.set('id', siteId)
    fd.set('pageSlug', pageSlug)
    fd.set('content', JSON.stringify(content))
    try {
      await saveSiteContentJsonAction(fd)
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <style>{`.ht-ed[contenteditable]:hover{background:rgba(128,128,128,0.14);border-radius:4px}.ht-ed[contenteditable]:empty:before{content:'Click to edit';opacity:.4}`}</style>

      <div
        className="sticky top-0 z-20 -mx-6 px-6 py-3 mb-3 border-b border-gold/15 flex flex-wrap items-center gap-3"
        style={{ background: 'rgba(246,240,230,0.97)', backdropFilter: 'blur(4px)' }}
      >
        <span className="font-label text-[10px] tracking-[2px] uppercase text-gold/70">Look</span>
        {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(key => (
          <button
            key={key}
            type="button"
            aria-label={THEMES[key].label}
            title={THEMES[key].label}
            onClick={() => {
              setTheme(key)
              touched()
            }}
            className={`w-6 h-6 rounded-full ${theme === key ? 'ring-2 ring-gold' : ''}`}
            style={{ background: THEMES[key].bg, boxShadow: `inset 0 0 0 3px ${THEMES[key].accent}` }}
          />
        ))}
        <label className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          accent
          <input
            type="color"
            value={accent}
            onChange={e => {
              setAccentColor(e.target.value)
              touched()
            }}
            className="w-7 h-7 rounded cursor-pointer bg-transparent"
            style={{ border: '1px solid rgba(201,168,76,0.3)' }}
          />
        </label>
        <span className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          width
          <button
            type="button"
            onClick={() => { setLayout('contained'); touched() }}
            className={`px-2 py-1 rounded-sm ${layout === 'contained' ? 'bg-gold text-background' : 'border border-gold/30 text-gold'}`}
          >
            Middle
          </button>
          <button
            type="button"
            onClick={() => { setLayout('full'); touched() }}
            className={`px-2 py-1 rounded-sm ${layout === 'full' ? 'bg-gold text-background' : 'border border-gold/30 text-gold'}`}
          >
            Full
          </button>
        </span>
        <label className="flex items-center gap-1.5 font-label text-[9px] tracking-[2px] uppercase text-ash ml-1">
          font
          <select
            value={fontSystem}
            onChange={e => { setFontSystem(e.target.value); touched() }}
            className="bg-surface border border-gold/30 text-parchment rounded-sm px-1.5 py-1"
            style={{ fontSize: 11 }}
          >
            {FONT_SYSTEMS.map(f => (
              <option key={f.key} value={f.key}>{f.name}</option>
            ))}
          </select>
        </label>
        <div className="flex-1" />
        <button
          type="button"
          onClick={addSection}
          className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm"
        >
          + Section
        </button>
        <button
          type="button"
          onClick={() => setAddAiOpen(o => !o)}
          className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm"
        >
          ✨ AI section
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2 rounded-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & publish'}
        </button>
        {siteStatus === 'live' && (
          <a
            href={pageSlug ? `/s/${siteSlug}/${pageSlug}` : `/s/${siteSlug}`}
            target="_blank"
            rel="noreferrer"
            className="font-label text-[10px] tracking-[2px] uppercase text-gold hover:text-goldLight"
          >
            View ↗
          </a>
        )}
      </div>

      <p className="font-body text-ash/60 text-xs mb-3 text-center">
        Click any text below to edit it. Recolour with the swatches above. Then Save &amp; publish.
      </p>

      <details className="border border-gold/15 rounded-sm p-4 mb-4">
        <summary className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 cursor-pointer">Search &amp; social (SEO)</summary>
        <div className="space-y-3 mt-3">
          <input
            value={seoTitle}
            onChange={e => { setSeoTitle(e.target.value); touched() }}
            placeholder="Page title for Google & the browser tab (e.g. Anima Temple — Reiki & Soul Readings)"
            className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none placeholder:text-ash/40"
          />
          <textarea
            value={seoDescription}
            onChange={e => { setSeoDescription(e.target.value); touched() }}
            rows={2}
            placeholder="Short description shown in Google results and link previews (1–2 sentences)"
            className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-sm px-3 py-2 rounded-sm outline-none resize-none placeholder:text-ash/40"
          />
        </div>
      </details>

      <div ref={rootRef} className="rounded-sm overflow-hidden border border-gold/15" style={{ background: t.bg, color: t.text, ...fontVars(fontSystem) } as unknown as CSSProperties}>
        <div className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${accent}33` }}>
          <div className="ht-ed inline-block" contentEditable suppressContentEditableWarning data-field="brand" style={{ ...edStyle, fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
            {initial?.brand || siteName}
          </div>
        </div>

        {heroImage ? (
          <div className="relative" style={{ minHeight: 300 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.42)' }} />
            <div className="relative px-6 py-24 text-center">
              <div className="ht-ed font-display text-4xl md:text-5xl italic" contentEditable suppressContentEditableWarning data-field="headline" style={{ ...edStyle, color: '#fff' }}>
                {initial?.headline || siteName}
              </div>
              <div className="ht-ed font-body text-lg mt-4" contentEditable suppressContentEditableWarning data-field="subheadline" style={{ ...edStyle, color: 'rgba(255,255,255,0.9)' }}>
                {initial?.subheadline ?? ''}
              </div>
              {ctaPreview}
            </div>
          </div>
        ) : (
          <div className="px-6 pt-16 pb-10 text-center">
            <div className="ht-ed font-display text-4xl md:text-5xl italic" contentEditable suppressContentEditableWarning data-field="headline" style={{ ...edStyle, color: t.text }}>
              {initial?.headline || siteName}
            </div>
            <div className="ht-ed font-body text-lg mt-4" contentEditable suppressContentEditableWarning data-field="subheadline" style={{ ...edStyle, color: t.muted }}>
              {initial?.subheadline ?? ''}
            </div>
            {ctaPreview}
            <div className="mx-auto mt-6 h-px w-16" style={{ background: accent }} />
          </div>
        )}

        <div className="px-6 py-2" style={{ background: 'rgba(128,128,128,0.06)' }}>
          <div className="max-w-md mx-auto">
            <ImageField
              value={heroImage}
              onChange={v => {
                setHeroImage(v)
                touched()
              }}
            />
          </div>
        </div>

        <div className="px-6 py-3" style={{ background: 'rgba(128,128,128,0.06)' }}>
          <div className="max-w-md mx-auto">
            <ButtonControl title="Hero button" type={ctaType} label={ctaLabel} href={ctaHref} siteSlug={siteSlug} onChange={heroBtnChange} />
          </div>
        </div>

        <div className={`${layout === 'full' ? 'max-w-5xl' : 'max-w-2xl'} mx-auto px-6 py-10 space-y-10`}>
          {sections.map(s => {
            const onBg = Boolean(s.bgImage)
            const btnPreview =
              s.ctaType !== 'none' ? (
                <div className="mt-4">
                  <span className="font-label inline-block" style={{ background: accent, color: t.bg, padding: '10px 24px', borderRadius: 3, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
                    {s.ctaLabel || 'Learn more'}
                  </span>
                </div>
              ) : null
            return (
              <div key={s.id} className="group relative">
                <div className="absolute right-0 -top-3 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" title="Move up" onClick={() => move(s.id, -1)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>↑</button>
                  <button type="button" title="Move down" onClick={() => move(s.id, 1)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>↓</button>
                  <button type="button" title="Duplicate" onClick={() => duplicate(s.id)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>⧉</button>
                  <button type="button" title="Improve with AI" onClick={() => { setAiFor(aiFor === s.id ? '' : s.id); setAiText('') }} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>✨</button>
                  <button type="button" title="Delete" onClick={() => removeSection(s.id)} className="text-xs px-2 py-0.5 rounded" style={{ background: '#b3402f', color: '#fff' }}>✕</button>
                </div>

                {onBg ? (
                  <div className="relative rounded-sm overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
                    <div className="relative px-6 py-16 text-center">
                      <div className="ht-ed font-display text-2xl md:text-3xl italic mb-2" contentEditable suppressContentEditableWarning data-field={'h-' + s.id} style={{ ...edStyle, color: '#fff' }}>
                        {s.heading}
                      </div>
                      <div className="ht-ed font-body leading-relaxed whitespace-pre-wrap" contentEditable suppressContentEditableWarning data-field={'b-' + s.id} style={{ ...edStyle, color: 'rgba(255,255,255,0.92)' }}>
                        {s.body}
                      </div>
                      {btnPreview}
                    </div>
                  </div>
                ) : (
                  <>
                    {s.image && (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image} alt="" className="w-full rounded-sm mb-4" style={{ maxHeight: 360, objectFit: 'cover' }} />
                      </>
                    )}
                    <div className="ht-ed font-display text-2xl md:text-3xl italic mb-2" contentEditable suppressContentEditableWarning data-field={'h-' + s.id} style={{ ...edStyle, color: accent }}>
                      {s.heading}
                    </div>
                    <div className="ht-ed font-body leading-relaxed whitespace-pre-wrap" contentEditable suppressContentEditableWarning data-field={'b-' + s.id} style={{ ...edStyle, color: t.text, opacity: 0.88 }}>
                      {s.body}
                    </div>
                    {btnPreview}
                  </>
                )}

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>Inline image</p>
                    <ImageField value={s.image} onChange={v => setSectionField(s.id, { image: v })} />
                  </div>
                  <div>
                    <p style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>Background photo</p>
                    <ImageField value={s.bgImage} onChange={v => setSectionField(s.id, { bgImage: v })} />
                  </div>
                </div>
                <div className="mt-2">
                  <ButtonControl title="Section button" type={s.ctaType} label={s.ctaLabel} href={s.ctaHref} siteSlug={siteSlug} onChange={patch => sectionBtnChange(s.id, patch)} />
                </div>
                {aiFor === s.id && (
                  <div className="mt-2 rounded-sm" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.12)', padding: 10 }}>
                    <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>✨ Ask AI</span>
                    <input
                      value={aiText}
                      onChange={e => setAiText(e.target.value)}
                      placeholder="How should AI change this section? (e.g. shorter and warmer)"
                      className="w-full mt-2"
                      style={{ ...urlInput, fontSize: 13, padding: '7px 10px', borderRadius: 3 }}
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        disabled={aiBusy}
                        onClick={() => runSectionAi(s.id, 'Improve the writing — clearer, warmer and more professional, same meaning.')}
                        style={{ fontSize: 12, background: accent, color: t.bg, padding: '6px 12px', borderRadius: 3, opacity: aiBusy ? 0.5 : 1 }}
                      >
                        {aiBusy ? 'AI…' : 'Improve writing'}
                      </button>
                      <button
                        type="button"
                        disabled={aiBusy || !aiText.trim()}
                        onClick={() => runSectionAi(s.id, aiText.trim())}
                        style={{ fontSize: 12, border: `1px solid ${accent}`, color: accent, padding: '6px 12px', borderRadius: 3, opacity: aiBusy || !aiText.trim() ? 0.5 : 1 }}
                      >
                        Apply
                      </button>
                      <button type="button" onClick={() => { setAiFor(''); setAiText('') }} style={{ fontSize: 12, color: '#888' }}>
                        cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {addAiOpen && (
            <div className="rounded-sm" style={{ background: 'rgba(255,255,255,0.65)', border: `1px dashed ${accent}`, padding: 12 }}>
              <span style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#555' }}>✨ New section with AI</span>
              <input
                value={addAiText}
                onChange={e => setAddAiText(e.target.value)}
                placeholder="Describe the section (e.g. a testimonials section with two short client quotes)"
                className="w-full mt-2"
                style={{ ...urlInput, fontSize: 13, padding: '7px 10px', borderRadius: 3 }}
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  disabled={aiBusy || !addAiText.trim()}
                  onClick={addAiSection}
                  style={{ fontSize: 12, background: accent, color: t.bg, padding: '7px 14px', borderRadius: 3, opacity: aiBusy || !addAiText.trim() ? 0.5 : 1 }}
                >
                  {aiBusy ? 'Writing…' : 'Generate section ✨'}
                </button>
                <button type="button" onClick={() => { setAddAiOpen(false); setAddAiText('') }} style={{ fontSize: 12, color: '#888' }}>
                  cancel
                </button>
              </div>
            </div>
          )}
          {sections.length === 0 && !addAiOpen && (
            <button type="button" onClick={addSection} className="w-full py-10 rounded-sm text-sm" style={{ border: `2px dashed ${accent}`, color: accent }}>
              + Add your first section
            </button>
          )}
        </div>

        <div className="px-6 pb-12 text-center">
          <span className="ht-ed" contentEditable suppressContentEditableWarning data-field="contactLabel" style={{ background: accent, color: t.bg, padding: '11px 26px', borderRadius: 3, display: 'inline-block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', outline: 'none', cursor: 'text' }}>
            {initial?.contactLabel || 'Get in touch'}
          </span>
          <div className="mt-3 flex justify-center">
            <input
              value={contactEmail}
              onChange={e => {
                setContactEmail(e.target.value)
                touched()
              }}
              placeholder="contact email (the button links here)"
              className="text-xs px-3 py-1.5 rounded-sm"
              style={{ ...urlInput, width: 300 }}
            />
          </div>
        </div>

        <div className="py-8 text-center" style={{ borderTop: `1px solid ${accent}22` }}>
          <div className="ht-ed inline-block" contentEditable suppressContentEditableWarning data-field="footer" style={{ ...edStyle, fontSize: 13, color: t.muted }}>
            {initial?.footer || siteName}
          </div>
        </div>
      </div>
    </div>
  )
}
