'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { THEMES } from '@/lib/sites/types'
import type { SiteContent, SiteTheme } from '@/lib/sites/types'
import { saveSiteContentJsonAction } from '../../actions'

interface EdSection {
  id: string
  heading: string
  body: string
  image: string
}

const edStyle: CSSProperties = { outline: 'none', cursor: 'text', minHeight: '1em' }
const urlInput: CSSProperties = {
  background: 'rgba(255,255,255,0.65)',
  color: '#222',
  border: '1px solid rgba(0,0,0,0.1)',
}

export default function LiveEditor({
  siteId,
  siteSlug,
  siteName,
  siteStatus,
  initial,
}: {
  siteId: string
  siteSlug: string
  siteName: string
  siteStatus: string
  initial: SiteContent | null
}) {
  const idc = useRef(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<SiteTheme>(initial?.theme ?? 'sand')
  const [accentColor, setAccentColor] = useState(initial?.accentColor ?? '')
  const [heroImage, setHeroImage] = useState(initial?.heroImage ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '')
  const [sections, setSections] = useState<EdSection[]>(
    (initial?.sections ?? []).map((s, i) => ({ id: 'i' + i, heading: s.heading, body: s.body, image: s.image ?? '' })),
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const t = THEMES[theme]
  const accent = accentColor || t.accent

  function touched() {
    setSaved(false)
  }
  function newId() {
    idc.current += 1
    return 'n' + idc.current
  }
  function addSection() {
    setSections(p => [...p, { id: newId(), heading: 'New section', body: 'Tell your story here…', image: '' }])
    touched()
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
  function setSectionImage(id: string, val: string) {
    setSections(p => p.map(s => (s.id === id ? { ...s, image: val } : s)))
    touched()
  }

  async function save() {
    setSaving(true)
    const root = rootRef.current
    const read = (f: string) =>
      ((root?.querySelector(`[data-field="${f}"]`) as HTMLElement | null)?.innerText ?? '').trim()
    const built = sections
      .map(s => ({ heading: read('h-' + s.id), body: read('b-' + s.id), image: s.image.trim() || undefined }))
      .filter(s => s.heading || s.body || s.image)
    const content: SiteContent = {
      theme,
      accentColor: accentColor || undefined,
      headline: read('headline'),
      subheadline: read('subheadline'),
      heroImage: heroImage.trim() || undefined,
      sections: built,
      contactEmail: contactEmail.trim(),
    }
    const fd = new FormData()
    fd.set('id', siteId)
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
        style={{ background: 'rgba(13,11,8,0.96)' }}
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
          onClick={save}
          disabled={saving}
          className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2 rounded-sm disabled:opacity-50"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & publish'}
        </button>
        {siteStatus === 'live' && (
          <a
            href={`/s/${siteSlug}`}
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

      <div ref={rootRef} className="rounded-sm overflow-hidden border border-gold/15" style={{ background: t.bg, color: t.text }}>
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
            <div className="mx-auto mt-6 h-px w-16" style={{ background: accent }} />
          </div>
        )}

        <div className="px-6 py-2 flex justify-center" style={{ background: 'rgba(128,128,128,0.06)' }}>
          <input
            value={heroImage}
            onChange={e => {
              setHeroImage(e.target.value)
              touched()
            }}
            placeholder="Hero image link (drag-drop upload coming soon)"
            className="w-full max-w-md text-xs px-3 py-1.5 rounded-sm"
            style={urlInput}
          />
        </div>

        <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
          {sections.map(s => (
            <div key={s.id} className="group relative">
              <div className="absolute right-0 -top-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button type="button" onClick={() => move(s.id, -1)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>↑</button>
                <button type="button" onClick={() => move(s.id, 1)} className="text-xs px-2 py-0.5 rounded" style={{ background: accent, color: t.bg }}>↓</button>
                <button type="button" onClick={() => removeSection(s.id)} className="text-xs px-2 py-0.5 rounded" style={{ background: '#b3402f', color: '#fff' }}>✕</button>
              </div>
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
              <input
                value={s.image}
                onChange={e => setSectionImage(s.id, e.target.value)}
                placeholder="Image link for this section (optional)"
                className="mt-3 w-full text-xs px-3 py-1.5 rounded-sm"
                style={urlInput}
              />
            </div>
          ))}
          {sections.length === 0 && (
            <button type="button" onClick={addSection} className="w-full py-10 rounded-sm text-sm" style={{ border: `2px dashed ${accent}`, color: accent }}>
              + Add your first section
            </button>
          )}
        </div>

        <div className="px-6 pb-16 text-center">
          <span style={{ background: accent, color: t.bg, padding: '11px 26px', borderRadius: 3, display: 'inline-block', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
            Get in touch
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
      </div>
    </div>
  )
}
