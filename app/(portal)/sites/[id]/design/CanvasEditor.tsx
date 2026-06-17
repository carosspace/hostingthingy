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
  navPages,
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
  navPages: { slug: string; label: string }[]
  initial: PageCanvas | null
}) {
  const t = THEMES[theme] ?? THEMES.sand
  const [els, setEls] = useState<CanvasElement[]>(initial?.elements ?? [])
  const [bg, setBg] = useState(initial?.bg ?? '')
  const [bgImage, setBgImage] = useState(initial?.bgImage ?? '')
  const [pageWidth, setPageWidth] = useState<'full' | 'contained'>(initial?.width === 'contained' ? 'contained' : 'full')
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
  const elsRef = useRef(els)
  elsRef.current = els
  const history = useRef<CanvasElement[][]>([])
  const future = useRef<CanvasElement[][]>([])
  const clip = useRef<CanvasElement | null>(null)
  const lastSnap = useRef(0)
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })

  const sel = els.find(e => e.id === selectedId) || null
  const canvasH = Math.max(900, ...els.map(e => e.y + e.h + 80), 0)

  const touch = () => { dirty.current = true; setSaved(false) }
  // Push the current state onto the undo stack. Rapid edits within 500ms coalesce into one.
  const snapshot = (force = false) => {
    const now = Date.now()
    if (!force && now - lastSnap.current < 500) return
    lastSnap.current = now
    history.current.push(elsRef.current)
    if (history.current.length > 60) history.current.shift()
    future.current = []
  }
  const undo = () => {
    const prev = history.current.pop()
    if (prev === undefined) return
    setEls(cur => { future.current.push(cur); return prev })
    setSelectedId('')
    dirty.current = true
    setSaved(false)
  }
  const redo = () => {
    const next = future.current.pop()
    if (next === undefined) return
    setEls(cur => { history.current.push(cur); return next })
    dirty.current = true
    setSaved(false)
  }
  const update = (id: string, patch: Partial<CanvasElement>) => { snapshot(); setEls(p => p.map(e => (e.id === id ? { ...e, ...patch } : e))); touch() }
  const remove = (id: string) => { snapshot(true); setEls(p => p.filter(e => e.id !== id)); setSelectedId(''); touch() }
  const layer = (id: string, dir: 1 | -1) => {
    snapshot(true)
    setEls(p => {
      const sorted = [...p].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
      return p.map(e => (e.id === id ? { ...e, z: (e.z ?? 0) + dir * (sorted.length + 1) } : e))
    })
    touch()
  }
  const duplicate = (id: string) => {
    const el = elsRef.current.find(e => e.id === id)
    if (!el) return
    snapshot(true)
    const maxZ = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const copy: CanvasElement = { ...el, id: 'e' + idc.current++, x: el.x + 16, y: el.y + 16, z: maxZ + 1 }
    setEls(p => [...p, copy])
    setSelectedId(copy.id)
    touch()
  }

  const place = (partial: Partial<CanvasElement> & { type: CanvasElementType }) => {
    snapshot(true)
    const maxZ = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const n = els.length
    const el: CanvasElement = { id: 'e' + idc.current++, x: 120 + (n % 5) * 24, y: 120 + (n % 8) * 24, w: 400, h: 80, z: maxZ + 1, opacity: 100, ...partial }
    setEls(p => [...p, el])
    setSelectedId(el.id)
    touch()
    if (el.type === 'image' && !el.src) setTimeout(() => imgPick(el.id), 50)
    return el
  }
  // Preset "Add" buttons.
  const PRESETS: Record<string, Partial<CanvasElement> & { type: CanvasElementType }> = {
    title: { type: 'text', w: 580, h: 92, text: 'Your title', fontSize: 56, fontFamily: 'display', italic: true, color: t.text },
    subtitle: { type: 'text', w: 480, h: 54, text: 'A subtitle', fontSize: 26, fontFamily: 'display', color: t.text },
    body: { type: 'text', w: 460, h: 120, text: 'Your text goes here…', fontSize: 18, fontFamily: 'body', color: t.text },
    link: { type: 'text', w: 200, h: 34, text: 'A link', fontSize: 16, fontFamily: 'label', color: accent, ctaType: 'link' },
    button: { type: 'button', w: 210, h: 56, text: 'Click me', fontSize: 18, fill: accent, ctaType: 'none', radius: 6, fontFamily: 'label' },
    contact: { type: 'button', w: 220, h: 56, text: 'Email me', fontSize: 18, fill: accent, ctaType: 'email', radius: 6, fontFamily: 'label' },
    image: { type: 'image', w: 380, h: 260, fit: 'cover', radius: 0 },
    menu: { type: 'menu', w: 600, h: 44, fontSize: 16, fontFamily: 'label', color: accent, align: 'left' },
    box: { type: 'box', w: 340, h: 220, fill: '#e8dcc0', radius: 10 },
    line: { type: 'box', w: 440, h: 4, fill: accent, radius: 0 },
    section: { type: 'box', x: 0, y: 80, w: CANVAS_W, h: 240, fill: '#f1ece3', radius: 0 },
  }
  // Drop a small group of pre-arranged elements.
  const addTemplate = (kind: 'card' | 'faq' | 'header' | 'footer') => {
    snapshot(true)
    let z = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const mk = (p: Partial<CanvasElement> & { type: CanvasElementType }): CanvasElement => ({ id: 'e' + idc.current++, x: 0, y: 0, w: 100, h: 60, opacity: 100, z: ++z, ...p })
    const bx = 150, by = 150
    if (kind === 'header') {
      const group = [
        mk({ type: 'box', x: 0, y: 0, w: CANVAS_W, h: 96, fill: '#ffffff' }),
        mk({ type: 'text', x: 40, y: 30, w: 320, h: 40, text: 'Your brand', fontSize: 24, fontFamily: 'display', italic: true, color: t.text }),
        mk({ type: 'menu', x: CANVAS_W - 500, y: 38, w: 460, h: 30, fontSize: 15, fontFamily: 'label', color: accent, align: 'right' }),
      ]
      setEls(p => [...p, ...group])
      setSelectedId(group[0].id)
      touch()
      return
    }
    if (kind === 'footer') {
      const fy = els.reduce((m, e) => Math.max(m, e.y + e.h), 200) + 60
      const group = [
        mk({ type: 'box', x: 0, y: fy, w: CANVAS_W, h: 110, fill: t.text }),
        mk({ type: 'text', x: 40, y: fy + 40, w: 360, h: 30, text: '© Your name', fontSize: 14, fontFamily: 'body', color: '#ffffff' }),
        mk({ type: 'menu', x: CANVAS_W - 500, y: fy + 42, w: 460, h: 28, fontSize: 13, fontFamily: 'label', color: '#ffffff', align: 'right' }),
      ]
      setEls(p => [...p, ...group])
      setSelectedId(group[0].id)
      touch()
      return
    }
    if (kind === 'card') {
      const group = [
        mk({ type: 'box', x: bx, y: by, w: 320, h: 384, fill: '#ffffff', radius: 12, borderColor: '#e8dcc0', borderWidth: 2 }),
        mk({ type: 'image', x: bx + 18, y: by + 18, w: 284, h: 172, fit: 'cover', radius: 6 }),
        mk({ type: 'text', x: bx + 18, y: by + 204, w: 284, h: 40, text: 'Card title', fontSize: 24, fontFamily: 'display', italic: true, color: t.text }),
        mk({ type: 'text', x: bx + 18, y: by + 248, w: 284, h: 116, text: 'A short description goes here.', fontSize: 15, fontFamily: 'body', color: t.text }),
      ]
      setEls(p => [...p, ...group])
      setSelectedId(group[1].id)
      touch()
      setTimeout(() => imgPick(group[1].id), 60)
    } else {
      const group = [
        mk({ type: 'text', x: bx, y: by, w: 500, h: 42, text: 'Your question?', fontSize: 22, fontFamily: 'display', italic: true, color: t.text }),
        mk({ type: 'text', x: bx, y: by + 48, w: 500, h: 96, text: 'The answer goes here.', fontSize: 16, fontFamily: 'body', color: t.text }),
      ]
      setEls(p => [...p, ...group])
      setSelectedId(group[1].id)
      touch()
    }
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
      if (d.mode === 'resize') {
        setEls(p => p.map(el => (el.id !== d.id ? el : { ...el, w: Math.max(24, Math.round(d.w + dx)), h: Math.max(20, Math.round(d.h + dy)) })))
        return
      }
      // Move with snapping to the canvas centre and other elements' edges/centres.
      let nx = Math.round(d.x + dx)
      let ny = Math.max(0, Math.round(d.y + dy))
      const others = elsRef.current.filter(el => el.id !== d.id)
      const T = 8
      let gx: number | null = null
      let gy: number | null = null
      const vlines = [CANVAS_W / 2, ...others.flatMap(el => [el.x, el.x + el.w / 2, el.x + el.w])]
      const mx = [nx, nx + d.w / 2, nx + d.w]
      for (const line of vlines) {
        const hit = mx.findIndex(m => Math.abs(m - line) <= T)
        if (hit >= 0) { nx += line - mx[hit]; gx = line; break }
      }
      const hlines = others.flatMap(el => [el.y, el.y + el.h / 2, el.y + el.h])
      const my = [ny, ny + d.h / 2, ny + d.h]
      for (const line of hlines) {
        const hit = my.findIndex(m => Math.abs(m - line) <= T)
        if (hit >= 0) { ny = Math.max(0, ny + line - my[hit]); gy = line; break }
      }
      setGuides({ x: gx, y: gy })
      setEls(p => p.map(el => (el.id !== d.id ? el : { ...el, x: nx, y: ny })))
    }
    const up = () => { if (dragRef.current) { dragRef.current = null; setGuides({ x: null, y: null }); touch() } }
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

  // Keyboard: undo/redo, duplicate, copy/paste, nudge with arrows, delete.
  // All ignored while typing in a field so normal text editing/undo still works.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (mod && k === 'y') { e.preventDefault(); redo(); return }
      if (mod && k === 'd' && selectedId) { e.preventDefault(); duplicate(selectedId); return }
      if (mod && k === 'c' && selectedId) { e.preventDefault(); clip.current = elsRef.current.find(x => x.id === selectedId) ?? null; return }
      if (mod && k === 'v' && clip.current) {
        e.preventDefault()
        const src = clip.current
        snapshot(true)
        const maxZ = elsRef.current.reduce((m, x) => Math.max(m, x.z ?? 0), 0)
        const copy: CanvasElement = { ...src, id: 'e' + idc.current++, x: src.x + 20, y: src.y + 20, z: maxZ + 1 }
        setEls(p => [...p, copy])
        setSelectedId(copy.id)
        touch()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); remove(selectedId); return }
      if (selectedId && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const s = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0
        snapshot()
        setEls(p => p.map(el => (el.id === selectedId ? { ...el, x: el.x + dx, y: Math.max(0, el.y + dy) } : el)))
        touch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId])

  const startDrag = (e: RPointerEvent, el: CanvasElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    setSelectedId(el.id)
    snapshot(true)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = { mode, id: el.id, px: e.clientX, py: e.clientY, x: el.x, y: el.y, w: el.w, h: el.h, scale: rect.width / CANVAS_W }
  }

  async function save() {
    setSaving(true)
    const canvas: PageCanvas = { h: canvasH, width: pageWidth === 'contained' ? 'contained' : undefined, bg: bg.trim() || undefined, bgImage: bgImage.trim() || undefined, elements: els }
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
    if (el.type === 'menu')
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: cq(26), justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start', overflow: 'hidden', pointerEvents: 'none' }}>
          {(navPages.length ? navPages : [{ slug: '', label: 'Home' }, { slug: 'x', label: 'About' }]).map(p => (
            <span key={p.slug} style={{ fontFamily: fontVar(el.fontFamily || 'label'), fontSize: cq(el.fontSize || 18), color: el.color || accent, textTransform: 'uppercase', letterSpacing: cq(2) }}>{p.label}</span>
          ))}
        </div>
      )
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
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={undo} title="Undo (Ctrl+Z)" className="flex-1 font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">↩ Undo</button>
          <button type="button" onClick={redo} title="Redo (Ctrl+Shift+Z)" className="flex-1 font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">↪ Redo</button>
        </div>

        <div className="space-y-2">
          {([
            ['Text', [['title', 'Title'], ['subtitle', 'Subtitle'], ['body', 'Body'], ['link', 'Link']]],
            ['Media & buttons', [['image', 'Picture'], ['button', 'Button'], ['contact', 'Contact'], ['menu', 'Page menu']]],
            ['Shapes', [['box', 'Box'], ['line', 'Line'], ['section', 'Section']]],
          ] as [string, [string, string][]][]).map(([group, items]) => (
            <div key={group}>
              <p style={labelCss}>{group}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {items.map(([key, lbl]) => (
                  <button key={key} type="button" onClick={() => place(PRESETS[key])} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p style={labelCss}>Starters</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {([['header', 'Header'], ['footer', 'Footer'], ['card', 'Card'], ['faq', 'FAQ']] as const).map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => addTemplate(k)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Page width</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {(['full', 'contained'] as const).map(w => (
              <button key={w} type="button" onClick={() => { setPageWidth(w); touch() }} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 10px', borderRadius: 3, border: `1px solid ${pageWidth === w ? accent : 'rgba(0,0,0,0.15)'}`, background: pageWidth === w ? accent : 'transparent', color: pageWidth === w ? '#fff' : '#666' }}>{w === 'full' ? 'Full width' : 'Contained'}</button>
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
              <span style={labelCss}>{sel.type === 'text' ? 'Text' : sel.type === 'image' ? 'Picture' : sel.type === 'button' ? 'Button' : sel.type === 'menu' ? 'Page menu' : 'Box'}</span>
              <div className="flex items-center gap-2">
                <button type="button" title="Duplicate (Ctrl+D)" onClick={() => duplicate(sel.id)} style={{ fontSize: 13, color: accent }}>⧉</button>
                <button type="button" title="Bring forward" onClick={() => layer(sel.id, 1)} style={{ fontSize: 13, color: accent }}>▲</button>
                <button type="button" title="Send back" onClick={() => layer(sel.id, -1)} style={{ fontSize: 13, color: accent }}>▼</button>
                <button type="button" title="Delete (Del)" onClick={() => remove(sel.id)} style={{ fontSize: 12, color: '#b3402f' }}>✕</button>
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
                {sel.type === 'text' && (
                  <div className="flex items-center gap-2">
                    <span style={labelCss}>Link</span>
                    <select value={sel.ctaType || 'none'} onChange={e => update(sel.id, { ctaType: e.target.value as CtaType })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                      <option value="none">No link</option>
                      <option value="booking">Booking page</option>
                      <option value="email">Email me</option>
                      <option value="link">Custom link</option>
                    </select>
                    {sel.ctaType === 'link' && <input value={sel.href || ''} onChange={e => update(sel.id, { href: e.target.value })} placeholder="https://…" style={{ ...inputCss, width: 130 }} />}
                  </div>
                )}
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
            {sel.type === 'menu' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Size</span>
                  <input type="range" min={10} max={48} value={sel.fontSize || 18} onChange={e => update(sel.id, { fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span style={labelCss}>Colour</span>
                  <input type="color" value={sel.color || accent} onChange={e => update(sel.id, { color: e.target.value })} style={{ width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0 }} />
                  {(['left', 'center', 'right'] as SiteAlign[]).map(a => (
                    <button key={a} type="button" onClick={() => update(sel.id, { align: a })} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, border: `1px solid ${sel.align === a ? accent : 'rgba(0,0,0,0.15)'}`, background: sel.align === a ? accent : 'transparent', color: sel.align === a ? '#fff' : '#666' }}>{a[0].toUpperCase()}</button>
                  ))}
                </div>
                <p className="font-body text-ash/50" style={{ fontSize: 11 }}>Shows links to all your pages. Manage pages in the Pages bar above the editor.</p>
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
        <p className="font-body text-ash/60 text-xs mb-3 text-center">Drag to move (it snaps to line things up) · corner ◢ to resize · arrows nudge · Ctrl+D duplicate · Ctrl+Z undo · Del removes. On phones everything stacks automatically.</p>
        <div className={`rounded-sm overflow-hidden border border-gold/15 ${pageWidth === 'contained' ? 'max-w-3xl mx-auto' : ''}`} style={{ ...fontVars(fontSystem) } as CSSProperties}>
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
            {guides.x !== null && <div style={{ position: 'absolute', left: cq(guides.x), top: 0, width: 1, height: '100%', background: '#3b82f6', pointerEvents: 'none', zIndex: 5 }} />}
            {guides.y !== null && <div style={{ position: 'absolute', top: cq(guides.y), left: 0, height: 1, width: '100%', background: '#3b82f6', pointerEvents: 'none', zIndex: 5 }} />}
          </div>
        </div>
      </div>
    </div>
  )
}
