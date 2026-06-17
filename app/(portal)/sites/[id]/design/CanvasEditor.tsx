'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import { CANVAS_W, THEMES, type PageCanvas, type CanvasElement, type CanvasElementType, type SiteTheme, type CtaType, type ImageFit, type SiteAlign } from '@/lib/sites/types'
import { fontVars } from '@/lib/sites/fonts'
import { resizeToDataUrl } from '@/lib/sites/image'
import { saveCanvasAction } from '../../actions'

const cq = (px: number) => `${(px / CANVAS_W) * 100}cqw`
const fontVar = (f?: string) => (f === 'body' ? 'var(--font-body)' : f === 'label' ? 'var(--font-label)' : 'var(--font-display)')
const inputCss: CSSProperties = { background: 'rgba(255,255,255,0.7)', color: '#222', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4, fontSize: 13, padding: '6px 8px', width: '100%' }
const labelCss: CSSProperties = { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#9a7d2e' }

type Drag = { mode: 'move' | 'resize'; id: string; px: number; py: number; x: number; y: number; w: number; h: number; scale: number } | null

export default function CanvasEditor({
  siteId,
  siteSlug,
  siteStatus,
  pageSlug,
  theme,
  accent,
  fontSystem,
  contactEmail,
  initial,
}: {
  siteId: string
  siteSlug: string
  siteStatus: string
  pageSlug: string
  theme: SiteTheme
  accent: string
  fontSystem: string
  contactEmail: string
  initial: PageCanvas | null
}) {
  const t = THEMES[theme] ?? THEMES.sand
  const [els, setEls] = useState<CanvasElement[]>(initial?.elements ?? [])
  const [bg, setBg] = useState(initial?.bg ?? '')
  const [bgImage, setBgImage] = useState(initial?.bgImage ?? '')
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag>(null)
  const idc = useRef(
    (initial?.elements ?? []).reduce((m, e) => {
      const n = parseInt(String(e.id).replace(/\D/g, ''), 10)
      return Number.isFinite(n) ? Math.max(m, n + 1) : m
    }, 1),
  )
  const dirty = useRef(false)

  const sel = els.find(e => e.id === selectedId) || null
  const canvasH = Math.max(900, ...els.map(e => e.y + e.h + 80), 0)

  const touch = () => { dirty.current = true; setSaved(false) }
  const update = (id: string, patch: Partial<CanvasElement>) => { setEls(p => p.map(e => (e.id === id ? { ...e, ...patch } : e))); touch() }
  const remove = (id: string) => { setEls(p => p.filter(e => e.id !== id)); setSelectedId(''); touch() }
  const layer = (id: string, dir: 1 | -1) => {
    setEls(p => {
      const sorted = [...p].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
      return p.map(e => (e.id === id ? { ...e, z: (e.z ?? 0) + dir * (sorted.length + 1) } : e))
    })
    touch()
  }

  const addEl = (type: CanvasElementType) => {
    const maxZ = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const n = els.length
    const base: CanvasElement = { id: 'e' + idc.current++, type, x: 120 + (n % 5) * 24, y: 120 + (n % 8) * 24, w: 400, h: 80, z: maxZ + 1, opacity: 100 }
    let el: CanvasElement = base
    if (type === 'text') el = { ...base, w: 460, h: 70, text: 'Your text', fontSize: 40, color: t.text, align: 'left', fontFamily: 'display', italic: true }
    if (type === 'button') el = { ...base, w: 210, h: 56, text: 'Click me', fontSize: 18, fill: accent, ctaType: 'none', radius: 6, fontFamily: 'label' }
    if (type === 'box') el = { ...base, w: 340, h: 220, fill: '#e8dcc0', radius: 10 }
    if (type === 'image') el = { ...base, w: 380, h: 260, fit: 'cover', radius: 0 }
    setEls(p => [...p, el])
    setSelectedId(el.id)
    touch()
    if (type === 'image') setTimeout(() => imgPick(el.id), 50)
  }

  // shared hidden file input per element image upload
  function imgPick(id: string) {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (f && f.type.startsWith('image/')) update(id, { src: await resizeToDataUrl(f) })
    }
    inp.click()
  }
  async function pickBg() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.onchange = async () => {
      const f = inp.files?.[0]
      if (f && f.type.startsWith('image/')) { setBgImage(await resizeToDataUrl(f)); touch() }
    }
    inp.click()
  }

  // Drag / resize via window-level pointer tracking (works for mouse + touch).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = (e.clientX - d.px) / d.scale
      const dy = (e.clientY - d.py) / d.scale
      setEls(p =>
        p.map(el =>
          el.id !== d.id
            ? el
            : d.mode === 'move'
              ? { ...el, x: Math.round(d.x + dx), y: Math.max(0, Math.round(d.y + dy)) }
              : { ...el, w: Math.max(24, Math.round(d.w + dx)), h: Math.max(20, Math.round(d.h + dy)) },
        ),
      )
    }
    const up = () => { if (dragRef.current) { dragRef.current = null; touch() } }
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('beforeunload', warn)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('beforeunload', warn)
    }
  }, [])

  const startDrag = (e: RPointerEvent, el: CanvasElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(el.id)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { mode, id: el.id, px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h, scale: rect.width / CANVAS_W }
  }

  async function save() {
    setSaving(true)
    const canvas: PageCanvas = { h: canvasH, bg: bg.trim() || undefined, bgImage: bgImage.trim() || undefined, elements: els }
    const fd = new FormData()
    fd.set('id', siteId)
    fd.set('pageSlug', pageSlug)
    fd.set('canvas', JSON.stringify(canvas))
    try {
      await saveCanvasAction(fd)
      dirty.current = false
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  // Visual for one element inside the canvas.
  const elInner = (el: CanvasElement) => {
    if (el.type === 'image')
      return el.src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: el.fit || 'cover', borderRadius: cq(el.radius || 0), display: 'block', pointerEvents: 'none' }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ border: `1.5px dashed ${accent}`, borderRadius: cq(el.radius || 0), color: accent, fontSize: cq(16) }}>+ photo</div>
      )
    if (el.type === 'box') return <div style={{ width: '100%', height: '100%', background: el.fill || 'transparent', borderRadius: cq(el.radius || 0), border: el.borderColor && el.borderWidth ? `${cq(el.borderWidth)} solid ${el.borderColor}` : undefined }} />
    const isBtn = el.type === 'button'
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isBtn ? 'center' : el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
          fontFamily: fontVar(el.fontFamily),
          fontSize: cq(el.fontSize || 24),
          color: isBtn ? '#fff' : el.color || t.text,
          background: isBtn ? el.fill || accent : undefined,
          borderRadius: isBtn ? cq(el.radius ?? 6) : undefined,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : undefined,
          textAlign: el.align || (isBtn ? 'center' : 'left'),
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          padding: isBtn ? `0 ${cq(18)}` : undefined,
          lineHeight: 1.25,
        }}
      >
        {el.text || (isBtn ? 'Button' : 'Text')}
      </div>
    )
  }

  return (
    <div className="lg:flex lg:gap-5 lg:items-start bg-white rounded-xl p-3 md:p-4 shadow-sm lg:w-[92vw] lg:ml-[calc(50%-46vw)]">
      {/* LEFT PANEL */}
      <div className="lg:sticky lg:top-2 lg:w-[300px] lg:shrink-0 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto rounded-sm border border-gold/15 px-4 py-4 mb-4 lg:mb-0 flex flex-col gap-4" style={{ background: 'rgba(246,240,230,0.97)' }}>
        <div className="flex items-center justify-between">
          <span className="font-label text-[11px] tracking-[3px] uppercase text-gold">Canvas</span>
          {siteStatus === 'live' && (
            <a href={pageSlug ? `/s/${siteSlug}/${pageSlug}` : `/s/${siteSlug}`} target="_blank" rel="noreferrer" className="font-label text-[9px] tracking-[2px] uppercase text-gold hover:text-goldLight">View ↗</a>
          )}
        </div>
        <button type="button" onClick={save} disabled={saving} className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2.5 rounded-sm disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & publish'}
        </button>

        <div>
          <p style={labelCss}>Add</p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {([['text', 'Text'], ['image', 'Picture'], ['button', 'Button'], ['box', 'Box']] as const).map(([type, lbl]) => (
              <button key={type} type="button" onClick={() => addEl(type)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">+ {lbl}</button>
            ))}
          </div>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Page background</p>
          <div className="flex items-center gap-2 mt-1.5">
            <input type="color" value={bg || '#faf7f2'} onChange={e => { setBg(e.target.value); touch() }} style={{ width: 30, height: 26, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0, cursor: 'pointer' }} title="Background colour" />
            {bg && <button type="button" onClick={() => { setBg(''); touch() }} style={{ fontSize: 11, color: '#999' }}>×</button>}
            <button type="button" onClick={pickBg} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">{bgImage ? 'Change photo' : '+ Photo'}</button>
            {bgImage && <button type="button" onClick={() => { setBgImage(''); touch() }} style={{ fontSize: 11, color: '#b3402f' }}>remove</button>}
          </div>
        </div>

        <div className="h-px bg-gold/15" />
        {/* INSPECTOR */}
        {sel ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span style={labelCss}>{sel.type === 'text' ? 'Text' : sel.type === 'image' ? 'Picture' : sel.type === 'button' ? 'Button' : 'Box'}</span>
              <div className="flex items-center gap-2">
                <button type="button" title="Bring forward" onClick={() => layer(sel.id, 1)} style={{ fontSize: 13, color: accent }}>▲</button>
                <button type="button" title="Send back" onClick={() => layer(sel.id, -1)} style={{ fontSize: 13, color: accent }}>▼</button>
                <button type="button" title="Delete" onClick={() => remove(sel.id)} style={{ fontSize: 12, color: '#b3402f' }}>✕</button>
              </div>
            </div>

            {(sel.type === 'text' || sel.type === 'button') && (
              <>
                <textarea value={sel.text || ''} onChange={e => update(sel.id, { text: e.target.value })} rows={2} placeholder="Type here…" style={{ ...inputCss, resize: 'none' }} />
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Size</span>
                  <input type="range" min={12} max={120} value={sel.fontSize || 24} onChange={e => update(sel.id, { fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#666', width: 28 }}>{sel.fontSize || 24}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {sel.type === 'text' && (
                    <>
                      <span style={labelCss}>Colour</span>
                      <input type="color" value={sel.color || '#1a1612'} onChange={e => update(sel.id, { color: e.target.value })} style={{ width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0 }} />
                    </>
                  )}
                  <button type="button" onClick={() => update(sel.id, { bold: !sel.bold })} style={{ fontWeight: 700, fontSize: 13, color: sel.bold ? accent : '#888', width: 24 }}>B</button>
                  <button type="button" onClick={() => update(sel.id, { italic: !sel.italic })} style={{ fontStyle: 'italic', fontSize: 13, color: sel.italic ? accent : '#888', width: 24 }}>I</button>
                  {(['left', 'center', 'right'] as SiteAlign[]).map(a => (
                    <button key={a} type="button" onClick={() => update(sel.id, { align: a })} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, border: `1px solid ${sel.align === a ? accent : 'rgba(0,0,0,0.15)'}`, background: sel.align === a ? accent : 'transparent', color: sel.align === a ? '#fff' : '#666' }}>{a[0].toUpperCase()}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Font</span>
                  <select value={sel.fontFamily || 'display'} onChange={e => update(sel.id, { fontFamily: e.target.value as 'display' | 'body' | 'label' })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value="display">Title font</option>
                    <option value="body">Body font</option>
                    <option value="label">Label font</option>
                  </select>
                </div>
              </>
            )}
            {sel.type === 'button' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Fill</span>
                  <input type="color" value={sel.fill || accent} onChange={e => update(sel.id, { fill: e.target.value })} style={{ width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0 }} />
                  <span style={labelCss}>Link</span>
                  <select value={sel.ctaType || 'none'} onChange={e => update(sel.id, { ctaType: e.target.value as CtaType })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value="none">No link</option>
                    <option value="booking">Booking page</option>
                    <option value="email">Email me</option>
                    <option value="link">Custom link</option>
                  </select>
                </div>
                {sel.ctaType === 'link' && <input value={sel.href || ''} onChange={e => update(sel.id, { href: e.target.value })} placeholder="https://…" style={inputCss} />}
              </>
            )}
            {sel.type === 'image' && (
              <>
                <button type="button" onClick={() => imgPick(sel.id)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">{sel.src ? 'Replace photo' : 'Upload photo'}</button>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Fit</span>
                  <select value={sel.fit || 'cover'} onChange={e => update(sel.id, { fit: e.target.value as ImageFit })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value="cover">Fill (crop)</option>
                    <option value="contain">Whole image</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Round</span>
                  <input type="range" min={0} max={120} value={sel.radius || 0} onChange={e => update(sel.id, { radius: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
              </>
            )}
            {sel.type === 'box' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Fill</span>
                  <input type="color" value={sel.fill || '#e8dcc0'} onChange={e => update(sel.id, { fill: e.target.value })} style={{ width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0 }} />
                  {sel.fill && <button type="button" onClick={() => update(sel.id, { fill: '' })} style={{ fontSize: 11, color: '#999' }}>×</button>}
                  <span style={labelCss}>Round</span>
                  <input type="range" min={0} max={120} value={sel.radius || 0} onChange={e => update(sel.id, { radius: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Border</span>
                  <input type="color" value={sel.borderColor || '#a85c36'} onChange={e => update(sel.id, { borderColor: e.target.value, borderWidth: sel.borderWidth || 2 })} style={{ width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0 }} />
                  <select value={sel.borderWidth || 0} onChange={e => update(sel.id, { borderWidth: Number(e.target.value) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value={0}>none</option>
                    <option value={2}>thin</option>
                    <option value={4}>medium</option>
                    <option value={8}>thick</option>
                  </select>
                </div>
              </>
            )}
            <div className="flex items-center gap-2">
              <span style={labelCss}>Opacity</span>
              <input type="range" min={10} max={100} value={sel.opacity ?? 100} onChange={e => update(sel.id, { opacity: Number(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#666', width: 32 }}>{sel.opacity ?? 100}%</span>
            </div>
          </div>
        ) : (
          <p className="font-body text-ash/50 text-[11px] leading-relaxed">Add something above, or click any element on the canvas to edit it here. Drag to move, drag the corner to resize.</p>
        )}
      </div>

      {/* CANVAS */}
      <div className="flex-1 min-w-0">
        <p className="font-body text-ash/60 text-xs mb-3 text-center">Drag to move · drag the corner ◢ to resize · click an element to edit it on the left. On phones everything stacks automatically.</p>
        <div className="rounded-sm overflow-hidden border border-gold/15" style={{ ...fontVars(fontSystem) } as CSSProperties}>
          <div
            ref={canvasRef}
            onPointerDown={() => setSelectedId('')}
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: `${CANVAS_W} / ${canvasH}`,
              containerType: 'inline-size',
              background: bg || t.bg,
              backgroundImage: bgImage ? `url('${bgImage}')` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            } as CSSProperties}
          >
            {[...els].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(el => (
              <div
                key={el.id}
                onPointerDown={e => startDrag(e, el, 'move')}
                style={{ position: 'absolute', left: cq(el.x), top: cq(el.y), width: cq(el.w), height: cq(el.h), opacity: (el.opacity ?? 100) / 100, cursor: 'move', touchAction: 'none', outline: selectedId === el.id ? `2px solid ${accent}` : undefined, outlineOffset: 1 }}
              >
                {elInner(el)}
                {selectedId === el.id && (
                  <div
                    onPointerDown={e => startDrag(e, el, 'resize')}
                    style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: 3, background: accent, border: '2px solid #fff', cursor: 'nwse-resize', touchAction: 'none', zIndex: 2 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
