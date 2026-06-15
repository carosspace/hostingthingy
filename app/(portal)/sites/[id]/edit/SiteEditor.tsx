'use client'

import { useState } from 'react'
import { THEMES } from '@/lib/sites/types'
import type { SiteContent, SiteSection, SiteTheme } from '@/lib/sites/types'
import { saveSiteContentAction } from '../../actions'

const inputCls =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40'
const labelCls = 'font-label text-[9px] tracking-[3px] uppercase text-gold/60 block mb-2'

export default function SiteEditor({
  siteId,
  siteName,
  initial,
}: {
  siteId: string
  siteName: string
  initial: SiteContent | null
}) {
  const [theme, setTheme] = useState<SiteTheme>(initial?.theme ?? 'sand')
  const [headline, setHeadline] = useState(initial?.headline ?? '')
  const [subheadline, setSubheadline] = useState(initial?.subheadline ?? '')
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? '')
  const [sections, setSections] = useState<SiteSection[]>(
    initial?.sections?.length ? initial.sections : [{ heading: '', body: '' }],
  )

  function setSection(i: number, field: 'heading' | 'body', val: string) {
    setSections(prev => prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s)))
  }
  function addSection() {
    setSections(prev => [...prev, { heading: '', body: '' }])
  }
  function removeSection(i: number) {
    setSections(prev => prev.filter((_, idx) => idx !== i))
  }
  function move(i: number, dir: -1 | 1) {
    setSections(prev => {
      const j = i + dir
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const tmp = next[i]
      next[i] = next[j]
      next[j] = tmp
      return next
    })
  }

  return (
    <form action={saveSiteContentAction} className="space-y-6">
      <input type="hidden" name="id" value={siteId} />
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />

      <div>
        <label className={labelCls}>Headline</label>
        <input name="headline" value={headline} onChange={e => setHeadline(e.target.value)} placeholder={siteName} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Subheadline</label>
        <input name="subheadline" value={subheadline} onChange={e => setSubheadline(e.target.value)} placeholder="A short line about what you offer" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Theme</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(Object.keys(THEMES) as Array<keyof typeof THEMES>).map(key => {
            const t = THEMES[key]
            const active = theme === key
            return (
              <button
                type="button"
                key={key}
                onClick={() => setTheme(key)}
                className={`border rounded-sm p-3 flex items-center gap-2 transition-colors ${active ? 'border-gold bg-gold/10' : 'border-gold/20 hover:border-gold/40'}`}
              >
                <span className="w-4 h-4 rounded-full shrink-0" style={{ background: t.accent, border: `1px solid ${t.bg}` }} />
                <span className="font-body text-parchment text-sm">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        <label className={labelCls}>Sections</label>
        {sections.map((s, i) => (
          <div key={i} className="border border-gold/10 rounded-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/50">Section {i + 1}</p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-ash hover:text-gold disabled:opacity-30" aria-label="Move up">↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="text-ash hover:text-gold disabled:opacity-30" aria-label="Move down">↓</button>
                <button type="button" onClick={() => removeSection(i)} className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">Remove</button>
              </div>
            </div>
            <input value={s.heading} onChange={e => setSection(i, 'heading', e.target.value)} placeholder="Section heading" className={inputCls} />
            <textarea value={s.body} onChange={e => setSection(i, 'body', e.target.value)} placeholder="Write something…" rows={4} className={`${inputCls} resize-none`} />
          </div>
        ))}
        <button
          type="button"
          onClick={addSection}
          className="font-label text-[10px] tracking-[3px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-4 py-2 rounded-sm transition-colors"
        >
          + Add section
        </button>
      </div>

      <div>
        <label className={labelCls}>Contact email (optional)</label>
        <input name="contactEmail" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="hello@animatemple.com" className={inputCls} />
      </div>

      <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors">
        Save &amp; publish
      </button>
    </form>
  )
}
