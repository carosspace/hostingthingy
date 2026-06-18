'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type MouseEvent as ReactMouseEvent, type DragEvent as RDragEvent } from 'react'
import { CANVAS_W, MOBILE_W, THEMES, BLEND_MODES, REVEAL_KINDS, HOVER_KINDS, SHADOW_KINDS, SHAPE_KINDS, CURSOR_KINDS, MAX_PALETTE, MAX_FONTS, MAX_UPLOADS, canvasLayout, brandVar, isBrandToken, gradientCss, filterCss, shadowCss, shapePath, fontFaceCss, type PageCanvas, type CanvasElement, type CanvasElementType, type SiteTheme, type CtaType, type ImageFit, type SiteAlign, type Gradient, type BlendMode, type RevealKind, type HoverKind, type ShadowKind, type ShapeKind, type MenuStyle, type CursorKind, type ImageAdjust, type SiteFont, type SiteComponent } from '@/lib/sites/types'
import { fontVars, FONT_SYSTEMS } from '@/lib/sites/fonts'
import { canvasIcon, ICON_GROUPS } from '@/lib/sites/icons'
import { resizeToDataUrl } from '@/lib/sites/image'
import { MobileStack, renderInner, type RenderCtx } from '@/lib/sites/CanvasView'
import CropModal from './CropModal'
import StockPhotos from './StockPhotos'
import { saveCanvasAction, aiTextAction, aiCanvasAction, clearCanvasAction } from '../../actions'
const fontVar = (f?: string) => (f === 'body' ? 'var(--font-body)' : f === 'label' ? 'var(--font-label)' : f && f.startsWith('custom:') ? `'cvf-${f.slice(7)}', sans-serif` : 'var(--font-display)')
const inputCss: CSSProperties = { background: 'rgba(255,255,255,0.7)', color: '#222', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4, fontSize: 13, padding: '6px 8px', width: '100%' }
const labelCss: CSSProperties = { fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: '#9a7d2e' }
const swatchCss: CSSProperties = { width: 28, height: 24, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 4, background: 'transparent', padding: 0 }

// Resolve a typed colour — a hex (#abc / #aabbcc) or a CSS colour name like "tomato"
// or "rebeccapurple" — to a stored opaque hex. Names are resolved by the browser via
// a throwaway canvas (two sentinels: an invalid value leaves fillStyle unchanged, so
// the two reads differ). Returns null for anything that isn't a plain opaque colour,
// so only safe hex is ever stored (the save gate also only accepts hex / brand tokens).
function normalizeColor(input: string): string | null {
  const s = input.trim().toLowerCase()
  if (!s) return null
  // Expand a 3-digit hex to 6 digits so the stored value always passes the save gate.
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join('')
  if (/^#[0-9a-f]{6}$/.test(s)) return s
  if (typeof document === 'undefined') return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#000000'; ctx.fillStyle = s; const a = ctx.fillStyle
  ctx.fillStyle = '#ffffff'; ctx.fillStyle = s; const b = ctx.fillStyle
  if (a !== b) return null // invalid: fillStyle kept the (differing) sentinels
  return /^#[0-9a-f]{6}$/.test(b) ? b : null // canvas returns rgba() for translucent — store opaque hex only
}

// A colour control: native picker + brand-swatch chips + a text box that accepts a
// CSS name or hex (Canva-style). Stores a hex, or a var(--brand-N) token via a chip.
function ColorField({ value, onChange, fallback, palette }: { value?: string; onChange: (v: string) => void; fallback: string; palette: string[] }) {
  const resolved = value && isBrandToken(value) ? (palette[Number(value.slice(-2, -1))] || '#888888') : (value || '')
  const [text, setText] = useState(resolved)
  useEffect(() => { setText(resolved) }, [resolved])
  const commit = () => { const c = normalizeColor(text); if (c) onChange(c); else setText(resolved) }
  return (
    <span className="inline-flex items-center gap-1">
      <input type="color" value={(resolved && /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : fallback)} onChange={e => onChange(e.target.value)} style={swatchCss} />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); (e.currentTarget as HTMLInputElement).blur() } }}
        placeholder="name / #hex"
        spellCheck={false}
        style={{ width: 74, background: 'rgba(255,255,255,0.8)', color: '#222', border: '1px solid rgba(0,0,0,0.15)', borderRadius: 4, fontSize: 11, padding: '4px 5px', fontFamily: 'monospace' }}
        title="Type a colour name (e.g. tomato) or hex (#ff6347)"
      />
      {palette.map((c, i) => (
        <button key={i} type="button" title={`Brand ${i + 1}`} onClick={() => onChange(brandVar(i))} style={{ width: 15, height: 15, borderRadius: 3, background: c, cursor: 'pointer', border: value === brandVar(i) ? '2px solid #222' : '1px solid rgba(0,0,0,0.25)', padding: 0 }} />
      ))}
    </span>
  )
}

type Drag =
  | { kind: 'move'; px: number; py: number; scale: number; m: boolean; starts: { id: string; x: number; y: number }[] }
  | { kind: 'resize'; id: string; px: number; py: number; scale: number; m: boolean; w: number; h: number; ar: number }
  | { kind: 'marquee'; px: number; py: number; scale: number; m: boolean; ox: number; oy: number }
  | null

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
  const [bgGrad, setBgGrad] = useState<Gradient | null>(initial?.bgGradient ?? null)
  const [bgImage, setBgImage] = useState(initial?.bgImage ?? '')
  const [bgVideo, setBgVideo] = useState(initial?.bgVideo ?? '')
  const [palette, setPalette] = useState<string[]>(initial?.palette ?? [])
  const [fonts, setFonts] = useState<SiteFont[]>(initial?.fonts ?? [])
  const [components, setComponents] = useState<SiteComponent[]>(initial?.components ?? [])
  const [editingComp, setEditingComp] = useState<{ id: string; outsideIds: string[]; origX: number; origY: number; origW: number; origH: number; origOpacity: number; origZ: number } | null>(null) // editing a component master in place
  const [uploads, setUploads] = useState<string[]>(initial?.uploads ?? []) // reusable image/logo library to drag onto the canvas
  const [fontSys, setFontSys] = useState(initial?.fontSystem || fontSystem) // this page's font bundle
  const dragUploadSrc = useRef<string | null>(null) // the upload being dragged onto the canvas (HTML5 drag-and-drop)
  const [pageWidth, setPageWidth] = useState<'full' | 'contained'>(initial?.width === 'contained' ? 'contained' : 'full')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState('') // a text/button element being typed into directly
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [hasStyle, setHasStyle] = useState(false) // a style has been copied (format painter)
  const [cropId, setCropId] = useState('') // image element being cropped (modal open)
  const [stockId, setStockId] = useState('') // image element picking a stock photo (modal open)
  const [aiInstr, setAiInstr] = useState('') // the instruction for the AI text rewrite
  const [aiBusy, setAiBusy] = useState(false)
  // Which tool category the left panel shows (Canva-style). Selecting an element
  // overrides this with its properties (the inspector); deselect to see a tab again.
  const [panelTab, setPanelTab] = useState<'design' | 'text' | 'elements' | 'uploads' | 'layers'>('design')
  const [aiPageOpen, setAiPageOpen] = useState(false) // the "write this page with AI" prompt popover
  const [aiPageDesc, setAiPageDesc] = useState('')
  const [aiPageBusy, setAiPageBusy] = useState(false)
  const [zoom, setZoom] = useState(1) // desktop canvas zoom; pan by scrolling the viewport
  const setZoomClamped = (z: number) => setZoom(Math.min(3, Math.max(0.25, Math.round(z * 100) / 100)))
  const [showGrid, setShowGrid] = useState(false) // editor-only alignment grid overlay
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [mobileCustom, setMobileCustom] = useState(!!initial?.mobileCustom)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
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
  const paletteRef = useRef(palette)
  paletteRef.current = palette
  const componentsRef = useRef(components)
  componentsRef.current = components
  // History captures elements, palette AND components together so a single action
  // (removing a brand swatch, or deleting a component + its instances) undoes
  // atomically and never strands a token or an orphaned instance.
  type Snap = { els: CanvasElement[]; palette: string[]; components: SiteComponent[] }
  const history = useRef<Snap[]>([])
  const future = useRef<Snap[]>([])
  const clip = useRef<CanvasElement[]>([])
  const styleClip = useRef<Partial<CanvasElement> | null>(null) // format painter: copied style
  const lastSnap = useRef(0)
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })

  // The body grows continuously; footer-pinned elements then sit below it (see
  // canvasLayout). bodyBottom is where the footer band starts on the desktop canvas.
  const { bodyBottom, totalH: desktopH } = canvasLayout(els)
  // When editing the custom phone artboard, coordinates live in the m* fields on a
  // narrower canvas. These accessors/writers swap which set is active by device.
  const editingMobile = device === 'mobile' && mobileCustom
  const CW = editingMobile ? MOBILE_W : CANVAS_W
  // When an element has no explicit phone coords yet, fall back to its desktop
  // position/size uniformly scaled to phone width (a coherent shrunk-desktop layout)
  // rather than collapsing to the corner. MR must match CanvasView's custom branch.
  // Footer-pinned elements fall back to their DISPLAYED desktop y (bodyBottom + y),
  // so on the phone they land at the bottom, not the top.
  const MR = MOBILE_W / CANVAS_W
  const gx = (e: CanvasElement) => (editingMobile ? e.mx ?? Math.round(e.x * MR) : e.x)
  const gy = (e: CanvasElement) => (editingMobile ? e.my ?? Math.round((e.pin === 'footer' ? bodyBottom + e.y : e.y) * MR) : e.y)
  const gw = (e: CanvasElement) => (editingMobile ? e.mw ?? Math.round(e.w * MR) : e.w)
  const gh = (e: CanvasElement) => (editingMobile ? e.mh ?? Math.round(e.h * MR) : e.h)
  const patchXY = (x: number, y: number): Partial<CanvasElement> => (editingMobile ? { mx: x, my: y } : { x, y })
  const patchX = (x: number): Partial<CanvasElement> => (editingMobile ? { mx: x } : { x })
  const patchY = (y: number): Partial<CanvasElement> => (editingMobile ? { my: y } : { y })
  // Write a DISPLAYED y back into the element's own frame (footer y is band-local on
  // the desktop artboard). Pairs with topOf() so align/distribute work across frames.
  const patchYDisp = (e: CanvasElement, dispY: number): Partial<CanvasElement> => (editingMobile ? { my: Math.round(dispY) } : e.pin === 'footer' ? { y: Math.max(0, Math.round(dispY - bodyBottom)) } : { y: Math.max(0, Math.round(dispY)) })
  const cqv = (px: number) => `${(px / CW) * 100}cqw`
  const brandVars: CSSProperties = {}
  palette.forEach((c, i) => { (brandVars as Record<string, string>)[`--brand-${i}`] = c })
  // Read-only context for rendering component instances inside the editor.
  const renderCtx: RenderCtx = { accent, navPages, pageHref: () => '#', ctaHref: () => '', components }

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : ''
  const sel = selectedId ? els.find(e => e.id === selectedId) || null : null
  // Nothing selected → the left panel shows the active tool tab; otherwise the inspector.
  const lib = selectedIds.length === 0
  // A footer element's stored y is an offset down from bodyBottom on the desktop
  // artboard; everything else uses its own y. (gy already handles the phone fallback.)
  const topOf = (e: CanvasElement) => (!editingMobile && e.pin === 'footer' ? bodyBottom + e.y : gy(e))
  const mobileH = Math.max(700, ...els.filter(e => !(e.hidden || e.mHidden)).map(e => (e.my ?? Math.round((e.pin === 'footer' ? bodyBottom + e.y : e.y) * MR)) + (e.mh ?? Math.round(e.h * MR)) + 60), 0)
  const CH = editingMobile ? mobileH : desktopH

  const touch = () => { dirty.current = true; setSaved(false) }
  // Push the current state onto the undo stack. Rapid edits within 500ms coalesce into one.
  const snapshot = (force = false) => {
    const now = Date.now()
    if (!force && now - lastSnap.current < 500) return
    lastSnap.current = now
    history.current.push({ els: elsRef.current, palette: paletteRef.current, components: componentsRef.current })
    if (history.current.length > 60) history.current.shift()
    future.current = []
  }
  const undo = () => {
    const prev = history.current.pop()
    if (prev === undefined) return
    future.current.push({ els: elsRef.current, palette: paletteRef.current, components: componentsRef.current })
    setEls(prev.els)
    setPalette(prev.palette)
    setComponents(prev.components)
    setSelectedIds([])
    setEditingComp(null) // leaving component-edit mode cleanly: the edited elements may no longer exist
    dirty.current = true
    setSaved(false)
  }
  const redo = () => {
    const next = future.current.pop()
    if (next === undefined) return
    history.current.push({ els: elsRef.current, palette: paletteRef.current, components: componentsRef.current })
    setEls(next.els)
    setPalette(next.palette)
    setComponents(next.components)
    setEditingComp(null)
    dirty.current = true
    setSaved(false)
  }
  const update = (id: string, patch: Partial<CanvasElement>) => { snapshot(); setEls(p => p.map(e => (e.id === id ? { ...e, ...patch } : e))); touch() }
  const remove = (id: string) => { snapshot(true); setEls(p => p.filter(e => e.id !== id).map(e => (e.anchorTo === id ? { ...e, anchorTo: undefined } : e))); setSelectedIds([]); touch() }
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
    const copy: CanvasElement = { ...el, id: 'e' + idc.current++, z: maxZ + 1, locked: undefined, ...patchXY(gx(el) + 16, gy(el) + 16) }
    setEls(p => [...p, copy])
    setSelectedIds([copy.id])
    touch()
  }
  // --- Format painter: copy an element's look, paint it onto others ---
  const STYLE_KEYS: (keyof CanvasElement)[] = ['color', 'fontSize', 'fontFamily', 'bold', 'italic', 'align', 'letterSpacing', 'lineHeight', 'dropCap', 'fill', 'gradient', 'radius', 'borderColor', 'borderWidth', 'shadow', 'blend', 'opacity', 'reveal', 'revealDelay', 'hover', 'parallax', 'cursor', 'adjust', 'lightbox']
  const copyStyle = (el: CanvasElement) => {
    const s: Partial<CanvasElement> = {}
    for (const k of STYLE_KEYS) if (el[k] !== undefined) (s as Record<string, unknown>)[k] = el[k]
    styleClip.current = s
    setHasStyle(true)
  }
  const pasteStyle = (ids: string[]) => {
    const s = styleClip.current
    if (!s || !ids.length) return
    const set = new Set(ids)
    snapshot(true)
    setEls(p => p.map(e => (set.has(e.id) && !e.locked ? { ...e, ...s } : e)))
    touch()
  }

  // Move one element one step forward/back in the layer order, renormalising z to
  // the list position so the order never drifts. dir +1 = toward front, -1 = back.
  const reorderLayer = (id: string, dir: 1 | -1) => {
    snapshot(true)
    setEls(p => {
      const sorted = [...p].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
      const i = sorted.findIndex(e => e.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= sorted.length) return p
      ;[sorted[i], sorted[j]] = [sorted[j], sorted[i]]
      const zmap = new Map(sorted.map((e, idx) => [e.id, idx]))
      return p.map(e => ({ ...e, z: zmap.get(e.id) ?? e.z }))
    })
    touch()
  }
  // Pin an element to the bottom (footer) or release it. We convert its y between
  // absolute (body) and band-local (offset down from bodyBottom) so it stays put on
  // screen at the moment of toggling. Footer pinning is a desktop concept.
  const togglePin = (id: string) => {
    const el = elsRef.current.find(e => e.id === id)
    if (!el) return
    // Measure the body WITHOUT this element so converting its y keeps it visually put
    // (otherwise the element being pinned inflates bodyBottom and it jumps upward).
    const bb = canvasLayout(elsRef.current.filter(e => e.id !== id)).bodyBottom
    snapshot(true)
    setEls(p => p.map(e => e.id === id
      ? (e.pin === 'footer'
          ? { ...e, pin: undefined, y: Math.max(0, Math.round(bb + e.y)) }
          : { ...e, pin: 'footer', y: Math.max(0, Math.round(e.y - bb)) })
      : e))
    touch()
  }
  // --- Group / ungroup: elements sharing a groupId select and move together ---
  // Expand a set of ids to include every element in the same group as any of them.
  const withGroup = (ids: string[]): string[] => {
    const cur = elsRef.current
    const gids = new Set(ids.map(id => cur.find(e => e.id === id)?.groupId).filter((g): g is string => !!g))
    if (!gids.size) return ids
    const out = new Set(ids)
    cur.forEach(e => { if (e.groupId && gids.has(e.groupId)) out.add(e.id) })
    return Array.from(out)
  }
  // Toggle a whole group in/out of the selection (used by shift-click and the layers list).
  const toggleGroupInSelection = (ids: string[]) => {
    const g = withGroup(ids)
    setSelectedIds(prev => (g.every(id => prev.includes(id)) ? prev.filter(x => !g.includes(x)) : Array.from(new Set([...prev, ...g]))))
  }
  const groupSelected = () => {
    if (selectedIds.length < 2) return
    const set = new Set(selectedIds)
    const gid = 'g' + Math.random().toString(36).slice(2, 8)
    snapshot(true)
    setEls(p => p.map(e => (set.has(e.id) ? { ...e, groupId: gid } : e)))
    touch()
  }
  const ungroupSelected = () => {
    const set = new Set(selectedIds)
    if (!elsRef.current.some(e => set.has(e.id) && e.groupId)) return
    snapshot(true)
    setEls(p => p.map(e => (set.has(e.id) && e.groupId ? { ...e, groupId: undefined } : e)))
    touch()
  }
  // --- Multi-selection group operations ---
  const removeMany = (ids: string[]) => {
    const set = new Set(elsRef.current.filter(e => ids.includes(e.id) && !e.locked).map(e => e.id))
    if (!set.size) return
    snapshot(true)
    setEls(p => p.filter(e => !set.has(e.id)).map(e => (e.anchorTo && set.has(e.anchorTo) ? { ...e, anchorTo: undefined } : e)))
    setSelectedIds([])
    touch()
  }
  const duplicateMany = (ids: string[]) => {
    const set = new Set(ids)
    const src = elsRef.current.filter(e => set.has(e.id))
    if (!src.length) return
    snapshot(true)
    let z = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    // Re-id any shared group so the duplicated set is its own group, not merged with the original.
    const gmap = new Map<string, string>()
    const copies = src.map(e => {
      let gid = e.groupId
      if (gid) { let ng = gmap.get(gid); if (!ng) { ng = 'g' + Math.random().toString(36).slice(2, 8); gmap.set(gid, ng) } gid = ng }
      return { ...e, id: 'e' + idc.current++, z: ++z, groupId: gid, ...patchXY(gx(e) + 16, gy(e) + 16) }
    })
    setEls(p => [...p, ...copies])
    setSelectedIds(copies.map(c => c.id))
    touch()
  }
  const alignSelected = (how: 'left' | 'hcenter' | 'right' | 'top' | 'vmiddle' | 'bottom') => {
    const set = new Set(selectedIds)
    const sels = elsRef.current.filter(e => set.has(e.id) && !e.locked)
    if (sels.length < 2) return
    snapshot(true)
    // Read each element's DISPLAYED y (topOf) so a mixed body + footer selection
    // aligns by what's on screen, then write back into each element's own frame.
    const minX = Math.min(...sels.map(e => gx(e))), maxX = Math.max(...sels.map(e => gx(e) + gw(e)))
    const minY = Math.min(...sels.map(e => topOf(e))), maxY = Math.max(...sels.map(e => topOf(e) + gh(e)))
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    setEls(p => p.map(e => {
      if (!set.has(e.id) || e.locked) return e
      if (how === 'left') return { ...e, ...patchX(Math.round(minX)) }
      if (how === 'right') return { ...e, ...patchX(Math.round(maxX - gw(e))) }
      if (how === 'hcenter') return { ...e, ...patchX(Math.round(cx - gw(e) / 2)) }
      if (how === 'top') return { ...e, ...patchYDisp(e, minY) }
      if (how === 'bottom') return { ...e, ...patchYDisp(e, maxY - gh(e)) }
      return { ...e, ...patchYDisp(e, cy - gh(e) / 2) }
    }))
    touch()
  }
  const distributeSelected = (axis: 'h' | 'v') => {
    const set = new Set(selectedIds)
    const sels = elsRef.current.filter(e => set.has(e.id) && !e.locked)
    if (sels.length < 3) return
    snapshot(true)
    const ry = (e: CanvasElement) => topOf(e) // displayed y, so footers distribute with body correctly
    const sorted = [...sels].sort((a, b) => (axis === 'h' ? gx(a) - gx(b) : ry(a) - ry(b)))
    const first = sorted[0], last = sorted[sorted.length - 1]
    const start = axis === 'h' ? gx(first) : ry(first)
    const end = axis === 'h' ? gx(last) : ry(last)
    const gap = (end - start) / (sorted.length - 1)
    const pos = new Map(sorted.map((e, i) => [e.id, Math.round(start + gap * i)]))
    setEls(p => p.map(e => (pos.has(e.id) ? { ...e, ...(axis === 'h' ? patchX(pos.get(e.id)!) : patchYDisp(e, pos.get(e.id)!)) } : e)))
    touch()
  }

  // Auto-arrange every element into a single phone-width column (reading order),
  // seeding the m* fields, and switch the page to a custom phone layout.
  const seedMobile = () => {
    snapshot(true)
    setEls(p => {
      const margin = 20, gap = 18
      // Body first (top-to-bottom), then footer-pinned elements last so the footer
      // seeds at the bottom of the phone stack (its y is a band-local offset).
      const ordered = [...p].filter(e => !e.hidden).sort((a, b) => ((a.pin === 'footer' ? 1 : 0) - (b.pin === 'footer' ? 1 : 0)) || a.y - b.y || a.x - b.x)
      let y = 40
      const m = new Map<string, Partial<CanvasElement>>()
      for (const e of ordered) {
        const isBand = e.w >= CANVAS_W * 0.8
        const mw = isBand ? MOBILE_W : Math.min(MOBILE_W - margin * 2, e.w)
        const mh = Math.max(20, Math.round(e.h * (mw / Math.max(1, e.w))))
        m.set(e.id, { mx: isBand ? 0 : margin, my: y, mw, mh })
        y += mh + gap
      }
      return p.map(e => (m.has(e.id) ? { ...e, ...m.get(e.id) } : e))
    })
    setMobileCustom(true)
    touch()
  }
  const useAutoMobile = () => { setMobileCustom(false); setSelectedIds([]); touch() }

  // --- Reusable components ---
  // Turn the current selection into a reusable component + replace it with one instance.
  const makeComponent = (ids: string[]) => {
    if (editingComp) return // not while editing a master in place
    const set = new Set(ids)
    const sel = elsRef.current.filter(e => set.has(e.id) && e.type !== 'component')
    if (!sel.length) return
    // Use each element's DISPLAYED y so a selection mixing body + footer-pinned
    // elements is captured in one coordinate frame (footer y is band-local otherwise).
    const bb = canvasLayout(elsRef.current).bodyBottom
    const ey = (e: CanvasElement) => (e.pin === 'footer' ? bb + e.y : e.y)
    const minX = Math.min(...sel.map(e => e.x)), minY = Math.min(...sel.map(e => ey(e)))
    const maxX = Math.max(...sel.map(e => e.x + e.w)), maxY = Math.max(...sel.map(e => ey(e) + e.h))
    const w = Math.max(8, Math.round(maxX - minX)), h = Math.max(8, Math.round(maxY - minY))
    const cels: CanvasElement[] = [...sel].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(e => {
      const { mx: _mx, my: _my, mw: _mw, mh: _mh, mHidden: _mh2, mFontSize: _mf, componentId: _ci, pin: _pin, groupId: _gid, ...rest } = e
      void _mx; void _my; void _mw; void _mh; void _mh2; void _mf; void _ci; void _pin; void _gid
      return { ...rest, x: e.x - minX, y: ey(e) - minY }
    })
    const id = 'c' + Math.random().toString(36).slice(2, 9)
    snapshot(true)
    setComponents(p => [...p, { id, name: `Component ${p.length + 1}`, w, h, elements: cels }])
    const maxZ = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const inst: CanvasElement = { id: 'e' + idc.current++, type: 'component', componentId: id, x: minX, y: minY, w, h, z: maxZ + 1, opacity: 100 }
    setEls(p => [...p.filter(e => !set.has(e.id)), inst])
    setSelectedIds([inst.id])
    touch()
  }
  // Drop another instance of an existing component onto the page.
  const placeComponent = (compId: string) => {
    if (editingComp) return // not while editing a master in place
    const comp = components.find(c => c.id === compId)
    if (!comp) return
    snapshot(true)
    const maxZ = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const n = els.length
    const w = Math.min(comp.w, 480)
    const h = Math.max(8, Math.round((w * comp.h) / Math.max(1, comp.w)))
    const inst: CanvasElement = { id: 'e' + idc.current++, type: 'component', componentId: compId, x: 120 + (n % 5) * 24, y: 120 + (n % 8) * 24, w, h, z: maxZ + 1, opacity: 100 }
    setEls(p => [...p, inst])
    setSelectedIds([inst.id])
    touch()
  }
  // Unlink an instance back into its constituent elements (positioned/scaled in place).
  const detachComponent = (id: string) => {
    const inst = elsRef.current.find(e => e.id === id)
    if (!inst || inst.type !== 'component') return
    const comp = components.find(c => c.id === inst.componentId)
    if (!comp) return
    snapshot(true)
    const scale = inst.w / Math.max(1, comp.w)
    let z = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const newEls: CanvasElement[] = comp.elements.map(ce => ({ ...ce, id: 'e' + idc.current++, x: Math.round(inst.x + ce.x * scale), y: Math.round(inst.y + ce.y * scale), w: Math.max(8, Math.round(ce.w * scale)), h: Math.max(8, Math.round(ce.h * scale)), z: ++z }))
    setEls(p => [...p.filter(e => e.id !== id), ...newEls])
    setSelectedIds(newEls.map(e => e.id))
    touch()
  }
  const deleteComponent = (compId: string) => {
    if (editingComp) return // not while editing a master in place
    if (!confirm('Delete this component? Any instances of it on this page will disappear.')) return
    snapshot(true)
    setComponents(p => p.filter(c => c.id !== compId))
    setEls(p => p.filter(e => !(e.type === 'component' && e.componentId === compId)))
    touch()
  }
  // STAGE 2 — edit the master, propagate to every instance. "Edit" unlinks ONE
  // instance into real, fully-editable elements (like detach) and remembers which
  // component + which elements are being edited; "Save to all" writes them back to
  // the master and re-links, so every other instance updates at once.
  const editComponent = (id: string) => {
    if (editingComp) return
    const inst = elsRef.current.find(e => e.id === id)
    if (!inst || inst.type !== 'component' || !inst.componentId) return
    const comp = components.find(c => c.id === inst.componentId)
    if (!comp) return
    snapshot(true)
    // Edit the master at its OWN native size (scale 1), NOT the instance's possibly
    // shrunken footprint — committing back then can't rescale/distort the stored
    // master (font sizes, spacing, etc. stay in the master's own coordinate space).
    const baseX = Math.max(0, Math.min(Math.round(inst.x), CANVAS_W - comp.w))
    const baseY = Math.max(0, Math.round(inst.y))
    let z = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const newEls: CanvasElement[] = comp.elements.map(ce => ({ ...ce, id: 'e' + idc.current++, x: baseX + ce.x, y: baseY + ce.y, z: ++z }))
    // Everything already on the page (except this instance) is "outside" the edit;
    // anything that is NOT outside at commit time (the unlinked elements + anything
    // the user adds while editing) folds into the master.
    const outsideIds = elsRef.current.filter(e => e.id !== id).map(e => e.id)
    setEls(p => [...p.filter(e => e.id !== id), ...newEls])
    setSelectedIds(newEls.map(e => e.id))
    setEditingComp({ id: inst.componentId, outsideIds, origX: Math.round(inst.x), origY: Math.round(inst.y), origW: Math.max(8, Math.round(inst.w)), origH: Math.max(8, Math.round(inst.h)), origOpacity: inst.opacity ?? 100, origZ: inst.z ?? (z + 1) })
    setDevice('desktop') // master edits happen on the desktop canvas (elements are in desktop coords)
    touch()
  }
  // Commit the elements being edited back into the master + collapse them to one
  // instance. Every other instance re-renders from the updated master automatically.
  const finishEditComponent = () => {
    if (!editingComp) return
    const outside = new Set(editingComp.outsideIds)
    const sel = elsRef.current.filter(e => !outside.has(e.id) && e.type !== 'component')
    if (!sel.length) { setEditingComp(null); return }
    const bb = canvasLayout(elsRef.current).bodyBottom
    const ey = (e: CanvasElement) => (e.pin === 'footer' ? bb + e.y : e.y)
    const minX = Math.min(...sel.map(e => e.x)), minY = Math.min(...sel.map(e => ey(e)))
    const maxX = Math.max(...sel.map(e => e.x + e.w)), maxY = Math.max(...sel.map(e => ey(e) + e.h))
    const w = Math.max(8, Math.round(maxX - minX)), h = Math.max(8, Math.round(maxY - minY))
    const cels: CanvasElement[] = [...sel].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(e => {
      const { mx: _mx, my: _my, mw: _mw, mh: _mh, mHidden: _mh2, mFontSize: _mf, componentId: _ci, pin: _pin, groupId: _gid, ...rest } = e
      void _mx; void _my; void _mw; void _mh; void _mh2; void _mf; void _ci; void _pin; void _gid
      return { ...rest, x: e.x - minX, y: ey(e) - minY }
    })
    const compId = editingComp.id
    const selIds = new Set(sel.map(e => e.id))
    snapshot(true)
    setComponents(p => p.some(c => c.id === compId)
      ? p.map(c => c.id === compId ? { ...c, w, h, elements: cels } : c)
      : [...p, { id: compId, name: `Component ${p.length + 1}`, w, h, elements: cels }]) // master deleted mid-edit: recreate it rather than strand a dangling instance
    // Re-collapse to ONE instance, keeping the source instance's footprint, opacity
    // and stacking; only its content/proportions update. Height tracks the new aspect.
    const instW = Math.max(8, Math.round(editingComp.origW))
    const instH = Math.max(8, Math.round((instW * h) / Math.max(1, w)))
    const inst: CanvasElement = { id: 'e' + idc.current++, type: 'component', componentId: compId, x: editingComp.origX, y: editingComp.origY, w: instW, h: instH, z: editingComp.origZ, opacity: editingComp.origOpacity }
    setEls(p => [...p.filter(e => !selIds.has(e.id)), inst])
    setSelectedIds([inst.id])
    setEditingComp(null)
    touch()
  }
  // Leave edit mode without touching the master — the unlinked elements stay as
  // loose elements (Undo restores the original instance).
  const cancelEditComponent = () => setEditingComp(null)
  // Remove a brand swatch without breaking references: elements on the removed slot
  // freeze to its current colour, and higher slots shift down to match the new indices.
  const removePaletteColor = (i: number) => {
    const removedHex = palette[i] || '#888888'
    snapshot(true)
    const fix = (v?: string): string | undefined => {
      if (!v || !isBrandToken(v)) return v
      const j = Number(v.slice(-2, -1))
      if (j === i) return removedHex
      if (j > i) return brandVar(j - 1)
      return v
    }
    setEls(p => p.map(e => ({ ...e, color: fix(e.color), fill: fix(e.fill), borderColor: fix(e.borderColor) })))
    setPalette(p => p.filter((_, j) => j !== i))
    touch()
  }

  const place = (partial: Partial<CanvasElement> & { type: CanvasElementType }) => {
    snapshot(true)
    const maxZ = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const n = els.length
    const el: CanvasElement = { id: 'e' + idc.current++, x: 120 + (n % 5) * 24, y: 120 + (n % 8) * 24, w: 400, h: 80, z: maxZ + 1, opacity: 100, ...partial }
    // When the page has a custom phone layout, also give the new element sensible
    // phone coords so it lands on-screen there (it exists on both devices).
    if (mobileCustom) {
      const mw = Math.min(el.w, MOBILE_W - 40)
      el.mx = 20
      el.my = 40 + (n % 8) * 22
      el.mw = mw
      el.mh = el.h
    }
    setEls(p => [...p, el])
    setSelectedIds([el.id])
    touch()
    if (el.type === 'image' && !el.src) setTimeout(() => imgPick(el.id), 50)
    if (el.type === 'carousel' && !(el.slides && el.slides.length)) setTimeout(() => slidesPick(el.id), 50)
    return el
  }
  // Preset "Add" buttons.
  const PRESETS: Record<string, Partial<CanvasElement> & { type: CanvasElementType }> = {
    title: { type: 'text', w: 580, h: 92, text: 'Your title', fontSize: 56, fontFamily: 'display', italic: true, color: '#111111' },
    subtitle: { type: 'text', w: 480, h: 54, text: 'A subtitle', fontSize: 26, fontFamily: 'display', color: '#111111' },
    body: { type: 'text', w: 460, h: 120, text: 'Your text goes here…', fontSize: 18, fontFamily: 'body', color: '#111111' },
    link: { type: 'text', w: 200, h: 34, text: 'A link', fontSize: 16, fontFamily: 'label', color: '#111111', ctaType: 'link' },
    button: { type: 'button', w: 210, h: 56, text: 'Click me', fontSize: 18, fill: '#111111', ctaType: 'none', radius: 6, fontFamily: 'label' },
    contact: { type: 'button', w: 220, h: 56, text: 'Email me', fontSize: 18, fill: '#111111', ctaType: 'email', radius: 6, fontFamily: 'label' },
    image: { type: 'image', w: 380, h: 260, fit: 'cover', radius: 0 },
    carousel: { type: 'carousel', w: 480, h: 320, fit: 'cover', radius: 0, interval: 4, slides: [] },
    menu: { type: 'menu', w: 600, h: 44, fontSize: 16, fontFamily: 'label', color: '#111111', align: 'left' },
    box: { type: 'box', w: 340, h: 220, fill: '#e8dcc0', radius: 10 },
    line: { type: 'box', w: 440, h: 3, fill: '#111111', radius: 0 },
    section: { type: 'box', x: 0, y: 80, w: CANVAS_W, h: 240, fill: '#f1ece3', radius: 0 },
    shape: { type: 'shape', shape: 'line', x: 0, w: CANVAS_W, h: 60, fill: '#111111' },
  }
  // Drop a small group of pre-arranged elements.
  const addTemplate = (kind: 'card' | 'faq' | 'header' | 'footer' | 'banner' | 'bar') => {
    snapshot(true)
    let z = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const mk = (p: Partial<CanvasElement> & { type: CanvasElementType }): CanvasElement => ({ id: 'e' + idc.current++, x: 0, y: 0, w: 100, h: 60, opacity: 100, z: ++z, ...p })
    const bx = 150, by = 150
    if (kind === 'banner') {
      // A full-width hero banner placed below the current content.
      const fy = els.reduce((m, e) => Math.max(m, e.y + e.h), 80) + 40
      const group = [
        mk({ type: 'box', x: 0, y: fy, w: CANVAS_W, h: 360, fill: accent, radius: 0 }),
        mk({ type: 'text', x: 150, y: fy + 92, w: CANVAS_W - 300, h: 72, text: 'Your big headline', fontSize: 48, fontFamily: 'display', italic: true, color: '#ffffff', align: 'center' }),
        mk({ type: 'text', x: 220, y: fy + 172, w: CANVAS_W - 440, h: 44, text: 'A short supporting line goes here.', fontSize: 20, fontFamily: 'body', color: '#ffffff', align: 'center' }),
        mk({ type: 'button', x: Math.round((CANVAS_W - 220) / 2), y: fy + 240, w: 220, h: 54, text: 'Call to action', fontSize: 17, fontFamily: 'label', fill: t.text, ctaType: 'none', radius: 6, align: 'center' }),
      ]
      setEls(p => [...p, ...group])
      setSelectedIds([group[1].id])
      touch()
      return
    }
    if (kind === 'bar') {
      // A thin full-width announcement bar at the very top.
      const group = [
        mk({ type: 'box', x: 0, y: 0, w: CANVAS_W, h: 46, fill: t.text }),
        mk({ type: 'text', x: 100, y: 12, w: CANVAS_W - 200, h: 24, text: '✦ Free shipping over €50 — for a limited time', fontSize: 14, fontFamily: 'label', color: '#ffffff', align: 'center' }),
      ]
      setEls(p => [...p, ...group])
      setSelectedIds([group[1].id])
      touch()
      return
    }
    if (kind === 'header') {
      const group = [
        mk({ type: 'box', x: 0, y: 0, w: CANVAS_W, h: 96, fill: '#ffffff' }),
        mk({ type: 'image', x: 40, y: 26, w: 44, h: 44, fit: 'contain', radius: 0 }), // logo slot — click to upload or drag one in
        mk({ type: 'text', x: 98, y: 30, w: 280, h: 40, text: 'Your brand', fontSize: 24, fontFamily: 'display', italic: true, color: t.text }),
        mk({ type: 'menu', x: CANVAS_W - 500, y: 38, w: 460, h: 30, fontSize: 15, fontFamily: 'label', color: accent, align: 'right' }),
      ]
      setEls(p => [...p, ...group])
      setSelectedIds([group[1].id])
      touch()
      return
    }
    if (kind === 'footer') {
      // Pinned to the bottom: y is an offset within the footer band, so the footer
      // always sits at the very end of the page as content grows above it.
      const group = [
        mk({ type: 'box', pin: 'footer', x: 0, y: 0, w: CANVAS_W, h: 120, fill: t.text }),
        mk({ type: 'image', pin: 'footer', x: 40, y: 40, w: 40, h: 40, fit: 'contain', radius: 0 }), // footer logo slot
        mk({ type: 'text', pin: 'footer', x: 96, y: 48, w: 360, h: 30, text: '© Your name', fontSize: 14, fontFamily: 'body', color: '#ffffff' }),
        mk({ type: 'menu', pin: 'footer', x: CANVAS_W - 500, y: 50, w: 460, h: 28, fontSize: 13, fontFamily: 'label', color: '#ffffff', align: 'right' }),
      ]
      setEls(p => [...p, ...group])
      setSelectedIds([group[0].id])
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
      setSelectedIds([group[1].id])
      touch()
      setTimeout(() => imgPick(group[1].id), 60)
    } else {
      const group = [
        mk({ type: 'text', x: bx, y: by, w: 500, h: 42, text: 'Your question?', fontSize: 22, fontFamily: 'display', italic: true, color: t.text }),
        mk({ type: 'text', x: bx, y: by + 48, w: 500, h: 96, text: 'The answer goes here.', fontSize: 16, fontFamily: 'body', color: t.text }),
      ]
      setEls(p => [...p, ...group])
      setSelectedIds([group[1].id])
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
      if (!f || !f.type.startsWith('image/')) return
      if (f.type === 'image/svg+xml') {
        // Keep SVG vector-sharp (don't rasterise); it renders via <img>, so no scripts run.
        const reader = new FileReader()
        reader.onload = () => update(id, { src: String(reader.result) })
        reader.readAsDataURL(f)
      } else {
        update(id, { src: await resizeToDataUrl(f) })
      }
    }
    inp.click()
  }
  // Add one or more images to a carousel (up to 10 total).
  function slidesPick(id: string) {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.multiple = true
    inp.onchange = async () => {
      const files = Array.from(inp.files || []).filter(f => f.type.startsWith('image/'))
      if (!files.length) return
      const urls = await Promise.all(files.map(f => resizeToDataUrl(f)))
      snapshot(true)
      setEls(p => p.map(e => (e.id === id ? { ...e, slides: [...(e.slides || []), ...urls].slice(0, 10) } : e)))
      touch()
    }
    inp.click()
  }
  // Upload a brand font: encode it as a base64 data URL with a known MIME (so it
  // always passes the gate) and add it to the page's fonts.
  function fontPick() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = '.woff2,.woff,.ttf,.otf,font/*'
    inp.onchange = () => {
      const f = inp.files?.[0]
      if (!f) return
      const ext = (f.name.split('.').pop() || '').toLowerCase()
      const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'ttf' ? 'font/ttf' : ext === 'otf' ? 'font/otf' : ''
      if (!mime) { alert('Please choose a .woff2, .woff, .ttf or .otf font file.'); return }
      const reader = new FileReader()
      reader.onload = () => {
        const bytes = new Uint8Array(reader.result as ArrayBuffer)
        let bin = ''
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
        const src = `data:${mime};base64,${btoa(bin)}`
        const id = 'f' + Math.random().toString(36).slice(2, 9)
        const name = (f.name.replace(/\.(woff2?|ttf|otf)$/i, '') || 'Font').slice(0, 30)
        setFonts(p => (p.length >= MAX_FONTS ? p : [...p, { id, name, src }]))
        touch()
      }
      reader.readAsArrayBuffer(f)
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
  // Read a file straight to a data URL (used for SVGs, which we keep vector rather
  // than rasterising; they render via <img>, so no scripts run).
  const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => {
    const r = new FileReader(); r.onerror = () => rej(new Error('read failed')); r.onload = () => res(String(r.result)); r.readAsDataURL(f)
  })
  // Upload one or more logos/pictures into the reusable library.
  function uploadPick() {
    const inp = document.createElement('input')
    inp.type = 'file'
    inp.accept = 'image/*'
    inp.multiple = true
    inp.onchange = async () => {
      const files = Array.from(inp.files || []).filter(f => f.type.startsWith('image/'))
      if (!files.length) return
      const urls = await Promise.all(files.map(f => (f.type === 'image/svg+xml' ? fileToDataUrl(f) : resizeToDataUrl(f, 1200, 0.85))))
      setUploads(p => [...p, ...urls].slice(0, MAX_UPLOADS))
      touch()
    }
    inp.click()
  }
  // Work out a tidy on-canvas size for a logo/picture (cap the width, keep aspect).
  const sizeForSrc = (src: string) => new Promise<{ w: number; h: number }>(res => {
    const img = new window.Image()
    img.onload = () => { const w = Math.min(320, img.width || 320); res({ w, h: Math.max(20, Math.round(w * (img.height || 200) / (img.width || 320))) }) }
    img.onerror = () => res({ w: 240, h: 160 })
    img.src = src
  })
  // Place an uploaded image onto the canvas — at a drop point if given, else centred.
  const placeUpload = async (src: string, clientX?: number, clientY?: number) => {
    const { w, h } = await sizeForSrc(src)
    if (clientX !== undefined && clientY !== undefined && !editingMobile) {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (rect) {
        const scale = rect.width / CW
        const x = Math.max(0, Math.round((clientX - rect.left) / scale - w / 2))
        const y = Math.max(0, Math.round((clientY - rect.top) / scale - h / 2))
        place({ type: 'image', src, fit: 'contain', radius: 0, w, h, x, y })
        return
      }
    }
    place({ type: 'image', src, fit: 'contain', radius: 0, w, h })
  }
  const onCanvasDrop = (e: RDragEvent) => {
    const src = dragUploadSrc.current
    if (!src) return
    e.preventDefault()
    dragUploadSrc.current = null
    void placeUpload(src, e.clientX, e.clientY)
  }
  // Write/redesign this whole page with AI, then drop the laid-out result onto the
  // canvas (undoable — the owner reviews and saves). Keeps brand palette/fonts/uploads.
  const runAiCanvas = async () => {
    if (aiPageBusy) return
    const description = aiPageDesc.trim()
    if (!description) return
    setAiPageBusy(true)
    try {
      const r = await aiCanvasAction({ siteId, description })
      if (r.ok && r.canvas) {
        snapshot(true)
        setEls(r.canvas.elements)
        if (r.canvas.bg) setBg(r.canvas.bg)
        setSelectedIds([])
        setEditingId('')
        setAiPageOpen(false)
        setAiPageDesc('')
        touch()
      }
    } finally {
      setAiPageBusy(false)
    }
  }
  // Rewrite a text/button element's words with AI from a plain-language instruction.
  const runAiText = async (id: string, instruction: string) => {
    if (aiBusy) return
    const el = elsRef.current.find(e => e.id === id)
    if (!el) return
    setAiBusy(true)
    try {
      const res = await aiTextAction({ siteId, instruction, text: el.text || '' })
      const next = (res.text || '').trim()
      if (next && next !== (el.text || '')) { snapshot(true); setEls(p => p.map(e => (e.id === id ? { ...e, text: next } : e))); touch() }
    } finally {
      setAiBusy(false)
    }
  }

  // Drag / resize via window-level pointer tracking (works for mouse + touch).
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = (e.clientX - d.px) / d.scale
      const dy = (e.clientY - d.py) / d.scale
      // Coordinate field accessors for whichever device this drag started on,
      // with the same shrunk-desktop fallback as the component-scope accessors.
      const W = d.m ? MOBILE_W : CANVAS_W
      const R = MOBILE_W / CANVAS_W
      const ax = (el: CanvasElement) => (d.m ? el.mx ?? Math.round(el.x * R) : el.x)
      const ay = (el: CanvasElement) => (d.m ? el.my ?? Math.round(el.y * R) : el.y)
      const aw = (el: CanvasElement) => (d.m ? el.mw ?? Math.round(el.w * R) : el.w)
      const ah = (el: CanvasElement) => (d.m ? el.mh ?? Math.round(el.h * R) : el.h)
      if (d.kind === 'resize') {
        let nw = Math.max(24, Math.round(d.w + dx))
        let nh = Math.max(20, Math.round(d.h + dy))
        // Hold Shift to keep the element's proportions (no distortion).
        if (e.shiftKey && d.ar > 0) { nh = Math.max(20, Math.round(nw / d.ar)) }
        setEls(p => p.map(el => (el.id !== d.id ? el : { ...el, ...(d.m ? { mw: nw, mh: nh } : { w: nw, h: nh }) })))
        return
      }
      if (d.kind === 'marquee') {
        // Rubber-band selection: any element overlapping the box gets selected.
        const cx = d.ox + dx, cy = d.oy + dy
        const x = Math.min(d.ox, cx), y = Math.min(d.oy, cy), w = Math.abs(dx), h = Math.abs(dy)
        setMarquee({ x, y, w, h })
        // Footer-pinned elements are drawn below the body, so hit-test them at their
        // displayed top (bodyBottom + y), not their stored band-local y.
        const bb = d.m ? 0 : canvasLayout(elsRef.current).bodyBottom
        const ey = (el: CanvasElement) => (el.pin === 'footer' && !d.m ? bb + ay(el) : ay(el))
        const hits = elsRef.current.filter(el => !el.locked && ax(el) < x + w && ax(el) + aw(el) > x && ey(el) < y + h && ey(el) + ah(el) > y).map(el => el.id)
        setSelectedIds(withGroup(hits))
        return
      }
      // Move. With a single element selected we snap to the canvas centre and
      // other elements' edges/centres; a multi-selection moves as a rigid group.
      let sdx = dx, sdy = dy
      let gxLine: number | null = null
      let gyLine: number | null = null
      if (d.starts.length === 1) {
        const s0 = d.starts[0]
        const me = elsRef.current.find(el => el.id === s0.id)
        if (me) {
          let nx = Math.round(s0.x + dx)
          let ny = Math.max(0, Math.round(s0.y + dy))
          const allOthers = elsRef.current.filter(el => el.id !== s0.id)
          const T = 8
          // X-snap is universal — x is one shared frame for body and footer elements.
          const vlines = [W / 2, ...allOthers.flatMap(el => [ax(el), ax(el) + aw(el) / 2, ax(el) + aw(el)])]
          const mxs = [nx, nx + aw(me) / 2, nx + aw(me)]
          for (const line of vlines) {
            const hit = mxs.findIndex(m => Math.abs(m - line) <= T)
            if (hit >= 0) { nx += line - mxs[hit]; gxLine = line; break }
          }
          // Y-snap: on the phone artboard everything shares the my frame; on the desktop
          // artboard a footer element's y is band-local, so only same-frame targets snap
          // and footer-y-snap is skipped (its guide would render in the wrong place).
          const yOthers = d.m ? allOthers : allOthers.filter(el => (el.pin ?? '') === (me.pin ?? ''))
          if (d.m || me.pin !== 'footer') {
            const hlines = yOthers.flatMap(el => [ay(el), ay(el) + ah(el) / 2, ay(el) + ah(el)])
            const mys = [ny, ny + ah(me) / 2, ny + ah(me)]
            for (const line of hlines) {
              const hit = mys.findIndex(m => Math.abs(m - line) <= T)
              if (hit >= 0) { ny = Math.max(0, ny + line - mys[hit]); gyLine = line; break }
            }
          }
          sdx = nx - s0.x
          sdy = ny - s0.y
        }
      } else if (d.starts.length > 1) {
        // Multi-selection: snap the GROUP's bounding box (left/centre/right and
        // top/middle/bottom) to the canvas centre and to other elements' edges, then
        // move the whole group by that adjusted delta. Worked out in displayed coords
        // so it's correct even if the selection mixes body and footer-pinned elements.
        const T = 8
        const bb = d.m ? 0 : canvasLayout(elsRef.current).bodyBottom
        const selSet = new Set(d.starts.map(s => s.id))
        const elMap = new Map(elsRef.current.map(e => [e.id, e]))
        const wOf = (id: string) => { const e = elMap.get(id); return e ? aw(e) : 0 }
        const hOf = (id: string) => { const e = elMap.get(id); return e ? ah(e) : 0 }
        const sy = (s: { id: string; y: number }) => { const e = elMap.get(s.id); return e && e.pin === 'footer' && !d.m ? bb + s.y : s.y }
        const gMinX = Math.min(...d.starts.map(s => s.x)), gMaxX = Math.max(...d.starts.map(s => s.x + wOf(s.id)))
        const gMinY = Math.min(...d.starts.map(s => sy(s))), gMaxY = Math.max(...d.starts.map(s => sy(s) + hOf(s.id)))
        const others = elsRef.current.filter(e => !selSet.has(e.id))
        const oy = (e: CanvasElement) => (e.pin === 'footer' && !d.m ? bb + ay(e) : ay(e))
        const vlines = [W / 2, ...others.flatMap(e => [ax(e), ax(e) + aw(e) / 2, ax(e) + aw(e)])]
        const gxs = [gMinX + dx, (gMinX + gMaxX) / 2 + dx, gMaxX + dx]
        for (const line of vlines) { const hit = gxs.findIndex(m => Math.abs(m - line) <= T); if (hit >= 0) { sdx = dx + (line - gxs[hit]); gxLine = line; break } }
        const hlines = others.flatMap(e => [oy(e), oy(e) + ah(e) / 2, oy(e) + ah(e)])
        const gys = [gMinY + dy, (gMinY + gMaxY) / 2 + dy, gMaxY + dy]
        for (const line of hlines) { const hit = gys.findIndex(m => Math.abs(m - line) <= T); if (hit >= 0) { sdy = dy + (line - gys[hit]); gyLine = line; break } }
      }
      setGuides({ x: gxLine, y: gyLine })
      const startMap = new Map(d.starts.map(s => [s.id, s]))
      setEls(p => p.map(el => {
        const s = startMap.get(el.id)
        if (!s) return el
        const nx = Math.round(s.x + sdx), ny = Math.max(0, Math.round(s.y + sdy))
        return { ...el, ...(d.m ? { mx: nx, my: ny } : { x: nx, y: ny }) }
      }))
    }
    const up = () => { const d = dragRef.current; if (!d) return; dragRef.current = null; setGuides({ x: null, y: null }); setMarquee(null); if (d.kind !== 'marquee') touch() }
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
      if (mod && k === 'a') { e.preventDefault(); setSelectedIds(elsRef.current.map(x => x.id)); return }
      if (mod && k === 'd' && selectedIds.length) { e.preventDefault(); duplicateMany(selectedIds); return }
      // Group (Ctrl/Cmd+G) / ungroup (Ctrl/Cmd+Shift+G) the selection.
      if (mod && k === 'g' && selectedIds.length > 1) { e.preventDefault(); if (e.shiftKey) ungroupSelected(); else groupSelected(); return }
      // Format painter: Ctrl/Cmd+Shift+C copies the look, Ctrl/Cmd+Shift+V paints it.
      if (mod && e.shiftKey && k === 'c' && selectedId) { e.preventDefault(); const el = elsRef.current.find(x => x.id === selectedId); if (el) copyStyle(el); return }
      if (mod && e.shiftKey && k === 'v' && styleClip.current && selectedIds.length) { e.preventDefault(); pasteStyle(selectedIds); return }
      if (mod && !e.shiftKey && k === 'c' && selectedIds.length) { e.preventDefault(); const set = new Set(selectedIds); clip.current = elsRef.current.filter(x => set.has(x.id)); return }
      if (mod && !e.shiftKey && k === 'v' && clip.current.length) {
        e.preventDefault()
        snapshot(true)
        let z = elsRef.current.reduce((m, x) => Math.max(m, x.z ?? 0), 0)
        const gmap = new Map<string, string>()
        const copies = clip.current.map(s => {
          let gid = s.groupId
          if (gid) { let ng = gmap.get(gid); if (!ng) { ng = 'g' + Math.random().toString(36).slice(2, 8); gmap.set(gid, ng) } gid = ng }
          return { ...s, id: 'e' + idc.current++, z: ++z, groupId: gid, ...patchXY(gx(s) + 20, gy(s) + 20) }
        })
        setEls(p => [...p, ...copies])
        setSelectedIds(copies.map(c => c.id))
        touch()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) { e.preventDefault(); removeMany(selectedIds); return }
      if (selectedIds.length && e.key.startsWith('Arrow')) {
        e.preventDefault()
        const s = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0
        snapshot()
        const set = new Set(selectedIds)
        setEls(p => p.map(el => (set.has(el.id) && !el.locked ? { ...el, ...patchXY(gx(el) + dx, Math.max(0, gy(el) + dy)) } : el)))
        touch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, editingMobile])

  // Focus the element being inline-edited and drop the cursor at the end.
  useEffect(() => {
    if (!editingId) return
    const node = canvasRef.current?.querySelector(`[data-edit="${editingId}"]`) as HTMLElement | null
    if (!node) return
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const s = window.getSelection()
    s?.removeAllRanges()
    s?.addRange(range)
  }, [editingId])

  const startDrag = (e: RPointerEvent, el: CanvasElement, mode: 'move' | 'resize') => {
    e.stopPropagation()
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = rect.width / CW
    if (mode === 'resize') {
      setSelectedIds([el.id])
      snapshot(true)
      dragRef.current = { kind: 'resize', id: el.id, px: e.clientX, py: e.clientY, scale, m: editingMobile, w: gw(el), h: gh(el), ar: gh(el) > 0 ? gw(el) / gh(el) : 1 }
      return
    }
    // Shift-click toggles an element (and its group) in/out of the selection — no drag.
    if (e.shiftKey) {
      toggleGroupInSelection([el.id])
      return
    }
    // Drag the whole current selection if this element is part of it; otherwise select
    // its group (or just it).
    const groupSel = withGroup([el.id])
    const ids = selectedIds.includes(el.id) ? selectedIds : groupSel
    if (!selectedIds.includes(el.id)) setSelectedIds(groupSel)
    snapshot(true)
    const cur = elsRef.current
    // Locked elements stay put even when part of a dragged group.
    const starts = ids
      .map(id => cur.find(x => x.id === id))
      .filter((m): m is CanvasElement => !!m && !m.locked)
      .map(m => ({ id: m.id, x: gx(m), y: gy(m) }))
    dragRef.current = { kind: 'move', px: e.clientX, py: e.clientY, scale, m: editingMobile, starts }
  }
  // Pointer-down on the empty canvas starts a rubber-band (marquee) selection.
  const bgPointerDown = (e: RPointerEvent) => {
    if (e.target !== e.currentTarget) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = rect.width / CW
    const ox = (e.clientX - rect.left) / scale
    const oy = (e.clientY - rect.top) / scale
    dragRef.current = { kind: 'marquee', px: e.clientX, py: e.clientY, scale, m: editingMobile, ox, oy }
    setSelectedIds([])
    setMarquee({ x: ox, y: oy, w: 0, h: 0 })
  }

  async function save() {
    if (editingComp) return // finish or cancel the master edit first — never persist mid-edit loose elements
    setSaving(true)
    const canvas: PageCanvas = {
      h: desktopH,
      width: pageWidth === 'contained' ? 'contained' : undefined,
      bg: bg.trim() || undefined,
      bgGradient: bgGrad || undefined,
      bgImage: bgImage.trim() || undefined,
      bgVideo: bgVideo.trim() || undefined,
      elements: els,
      mobileCustom: mobileCustom || undefined,
      mobileH: mobileCustom ? mobileH : undefined,
      palette: palette.length ? palette : undefined,
      fonts: fonts.length ? fonts : undefined,
      components: components.length ? components : undefined,
      uploads: uploads.length ? uploads : undefined,
      fontSystem: fontSys || undefined,
    }
    const payload = JSON.stringify(canvas)
    // Guard against the Server Actions body limit (12 MB, see next.config) — embedded
    // images add up fast. Warn with something actionable instead of a silent failure.
    if (payload.length > 11_500_000) {
      setSaving(false)
      setSaveError('This page is too heavy to save — its images add up to more than ~11 MB. Remove some uploads or use smaller/fewer photos, then save again.')
      return
    }
    const fd = new FormData()
    fd.set('id', siteId)
    fd.set('pageSlug', pageSlug)
    fd.set('canvas', payload)
    try {
      await saveCanvasAction(fd)
      dirty.current = false
      setSaved(true)
      setSaveError('')
    } catch {
      // Keep dirty so the work isn't considered saved; tell the user it failed.
      setSaveError('Couldn’t save — please check your connection and try again. If it keeps failing, your page may have too many large images.')
    } finally {
      setSaving(false)
    }
  }

  // Visual for one element inside the canvas.
  const elInner = (el: CanvasElement) => {
    if (el.type === 'image')
      return el.src ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={el.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: el.fit || 'cover', borderRadius: cqv(el.radius || 0), display: 'block', pointerEvents: 'none', filter: filterCss(el.adjust), boxShadow: shadowCss(el.shadow) }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ border: `1.5px dashed ${accent}`, borderRadius: cqv(el.radius || 0), color: accent, fontSize: cqv(16) }}>+ photo</div>
      )
    if (el.type === 'carousel') {
      const first = el.slides && el.slides[0]
      return first ? (
        <div style={{ width: '100%', height: '100%', position: 'relative', borderRadius: cqv(el.radius || 0), overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: el.fit || 'cover', display: 'block', pointerEvents: 'none', boxShadow: shadowCss(el.shadow) }} />
          <span style={{ position: 'absolute', bottom: cqv(8), right: cqv(8), background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: cqv(13), padding: `${cqv(2)} ${cqv(8)}`, borderRadius: cqv(20) }}>▷ {el.slides!.length}</span>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ border: `1.5px dashed ${accent}`, borderRadius: cqv(el.radius || 0), color: accent, fontSize: cqv(16) }}>▷ slideshow</div>
      )
    }
    if (el.type === 'shape')
      return (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}>
          <path d={shapePath(el.shape)} style={{ fill: el.fill || accent }} />
        </svg>
      )
    if (el.type === 'icon')
      return <div style={{ width: '100%', height: '100%', color: el.color || accent, pointerEvents: 'none' }}>{canvasIcon(el.icon)}</div>
    if (el.type === 'component') {
      const comp = components.find(c => c.id === el.componentId)
      if (!comp) return <div className="w-full h-full flex items-center justify-center" style={{ border: `1.5px dashed ${accent}`, color: accent, fontSize: cqv(14) }}>missing component</div>
      return <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>{renderInner(el, cqv, renderCtx)}</div>
    }
    if (el.type === 'box') return <div style={{ width: '100%', height: '100%', background: gradientCss(el.gradient) || el.fill || 'transparent', borderRadius: cqv(el.radius || 0), border: el.borderColor && el.borderWidth ? `${cqv(el.borderWidth)} solid ${el.borderColor}` : undefined, boxShadow: shadowCss(el.shadow) }} />
    if (el.type === 'menu') {
      const ms = el.menuStyle || 'plain'
      const col = el.color || accent
      const stacked = ms === 'stacked'
      const justify = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start'
      const linkBase: CSSProperties = { fontFamily: fontVar(el.fontFamily || 'label'), fontSize: cqv(el.fontSize || 18), color: col, textTransform: 'uppercase', letterSpacing: cqv(2), whiteSpace: 'nowrap', display: 'inline-block' }
      const extra: CSSProperties = ms === 'pills' ? { padding: `${cqv(7)} ${cqv(18)}`, border: `1px solid ${col}`, borderRadius: cqv(999) }
        : ms === 'boxed' ? { padding: `${cqv(7)} ${cqv(16)}`, border: `1px solid ${col}` }
        : ms === 'underline' ? { paddingBottom: cqv(4), borderBottom: `2px solid ${col}` } : {}
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: stacked ? 'column' : 'row', flexWrap: stacked ? 'nowrap' : 'wrap', alignItems: stacked ? justify : 'center', justifyContent: stacked ? 'flex-start' : justify, gap: cqv(stacked ? 12 : 22), overflow: 'hidden', pointerEvents: 'none' }}>
          {(navPages.length ? navPages : [{ slug: '', label: 'Home' }, { slug: 'x', label: 'About' }]).map(p => (
            <span key={p.slug} style={{ ...linkBase, ...extra }}>{p.label}</span>
          ))}
        </div>
      )
    }
    const isBtn = el.type === 'button'
    const editing = editingId === el.id
    return (
      <div
        contentEditable={editing}
        suppressContentEditableWarning
        data-edit={el.id}
        className={el.dropCap && !isBtn && !editing ? 'dbp-dropcap' : undefined}
        onBlur={editing ? e => { update(el.id, { text: (e.currentTarget as HTMLElement).innerText }); setEditingId('') } : undefined}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isBtn ? 'center' : el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
          fontFamily: fontVar(el.fontFamily),
          fontSize: cqv((editingMobile && el.mFontSize) || el.fontSize || 24),
          color: isBtn ? '#fff' : el.color || t.text,
          background: isBtn ? gradientCss(el.gradient) || el.fill || accent : undefined,
          borderRadius: isBtn ? cqv(el.radius ?? 6) : undefined,
          boxShadow: isBtn ? shadowCss(el.shadow) : undefined,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? 'italic' : undefined,
          letterSpacing: el.letterSpacing ? cqv(el.letterSpacing) : undefined,
          textAlign: el.align || (isBtn ? 'center' : 'left'),
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          padding: isBtn ? `0 ${cqv(18)}` : undefined,
          lineHeight: el.lineHeight ?? 1.25,
          outline: 'none',
          cursor: editing ? 'text' : undefined,
        }}
      >
        {editing ? el.text : el.text || (isBtn ? 'Button' : 'Text')}
      </div>
    )
  }

  // A short label + glyph for the Layers list.
  const elIcon = (el: CanvasElement) => (el.type === 'text' ? 'T' : el.type === 'image' ? '▦' : el.type === 'carousel' ? '▷' : el.type === 'shape' ? '◣' : el.type === 'icon' ? '◈' : el.type === 'component' ? '❖' : el.type === 'button' ? '▭' : el.type === 'menu' ? '☰' : '◻')
  const elName = (el: CanvasElement) => {
    if (el.type === 'text') return (el.text || 'Text').replace(/\s+/g, ' ').trim() || 'Text'
    if (el.type === 'button') return (el.text || 'Button').replace(/\s+/g, ' ').trim() || 'Button'
    if (el.type === 'image') return 'Picture'
    if (el.type === 'carousel') return 'Slideshow'
    if (el.type === 'shape') return 'Shape divider'
    if (el.type === 'icon') return 'Icon · ' + (el.icon || 'star')
    if (el.type === 'component') return components.find(c => c.id === el.componentId)?.name || 'Component'
    if (el.type === 'menu') return 'Page menu'
    if (el.w >= CANVAS_W * 0.8 && el.h >= 120) return 'Section band'
    if (el.h <= 10) return 'Line'
    return 'Box'
  }
  const selectFromList = (e: ReactMouseEvent, id: string) => {
    if (e.shiftKey) toggleGroupInSelection([id])
    else setSelectedIds(withGroup([id]))
  }
  const layerBtn = (onSel: boolean, disabled: boolean): CSSProperties => ({ fontSize: 11, width: 17, height: 17, lineHeight: '15px', textAlign: 'center', borderRadius: 3, color: onSel ? '#fff' : accent, opacity: disabled ? 0.25 : 1, flexShrink: 0 })
  const swatch: CSSProperties = swatchCss
  // A colour value resolved for display: a brand token shows its current swatch colour.
  const resolveCol = (v?: string) => { if (v && isBrandToken(v)) { return palette[Number(v.slice(-2, -1))] || '#888888' } return v || '' }
  // A colour control (native picker + name/hex text box + brand-swatch chips).
  const colorField = (value: string | undefined, onChange: (v: string) => void, fallback: string) => (
    <ColorField value={value} onChange={onChange} fallback={fallback} palette={palette} />
  )
  // A compact on/off two-stop gradient editor, reused for boxes, buttons and the page background.
  const gradientControls = (g: Gradient | null | undefined, onChange: (g: Gradient | null) => void) => (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span style={labelCss}>Gradient</span>
        <button type="button" onClick={() => onChange(g ? null : { from: accent, to: '#1a1612', angle: 90 })} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 9px', borderRadius: 3, border: `1px solid ${g ? accent : 'rgba(0,0,0,0.15)'}`, background: g ? accent : 'transparent', color: g ? '#fff' : '#666' }}>{g ? 'On' : 'Off'}</button>
      </div>
      {g && (
        <>
          <div className="flex items-center gap-2">
            <input type="color" value={g.from} onChange={e => onChange({ ...g, from: e.target.value })} style={swatch} title="From" />
            <input type="color" value={g.to} onChange={e => onChange({ ...g, to: e.target.value })} style={swatch} title="To" />
            {(['linear', 'radial', 'conic'] as const).map(k => (
              <button key={k} type="button" title={k} onClick={() => onChange({ ...g, kind: k === 'linear' ? undefined : k })} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 6px', borderRadius: 3, border: `1px solid ${(g.kind || 'linear') === k ? accent : 'rgba(0,0,0,0.15)'}`, background: (g.kind || 'linear') === k ? accent : 'transparent', color: (g.kind || 'linear') === k ? '#fff' : '#666' }}>{k[0]}</button>
            ))}
          </div>
          {g.kind !== 'radial' && (
            <div className="flex items-center gap-2">
              <span style={labelCss}>Angle</span>
              <input type="range" min={0} max={360} value={g.angle} onChange={e => onChange({ ...g, angle: Number(e.target.value) })} style={{ flex: 1 }} />
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div className="lg:flex lg:gap-5 lg:items-start bg-white rounded-xl p-3 md:p-4 shadow-sm lg:w-[92vw] lg:ml-[calc(50%-46vw)]">
      {fonts.length > 0 && <style dangerouslySetInnerHTML={{ __html: fontFaceCss(fonts) }} />}
      {/* LEFT: a Canva-style icon rail + the active tool panel */}
      <div className="lg:sticky lg:top-2 lg:shrink-0 flex gap-2 mb-4 lg:mb-0">
        <div className="flex flex-col gap-1 shrink-0">
          {([['design', '🎨', 'Design'], ['elements', '＋', 'Add'], ['text', 'T', 'Text'], ['uploads', '☁', 'Uploads'], ['layers', '▤', 'Layers']] as const).map(([key, icon, lbl]) => {
            const on = lib && panelTab === key
            return (
              <button key={key} type="button" onClick={() => { setPanelTab(key); setSelectedIds([]); setEditingId('') }} title={lbl}
                className="flex flex-col items-center justify-center gap-0.5 rounded-md transition-colors"
                style={{ width: 52, height: 54, border: '1px solid', borderColor: on ? accent : 'rgba(0,0,0,0.08)', background: on ? 'rgba(168,92,54,0.10)' : 'transparent', color: on ? accent : '#8a7c63' }}>
                <span style={{ fontSize: 16, lineHeight: 1, fontWeight: key === 'text' ? 700 : 400 }}>{icon}</span>
                <span style={{ fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>{lbl}</span>
              </button>
            )
          })}
        </div>
        <div className="lg:w-[290px] lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto rounded-sm border border-gold/15 px-4 py-4 flex flex-col gap-4" style={{ background: 'rgba(246,240,230,0.97)' }}>
        <div className="flex items-center justify-between">
          <span className="font-label text-[11px] tracking-[3px] uppercase text-gold">{lib ? ({ design: 'Design', text: 'Text', elements: 'Add', uploads: 'Uploads', layers: 'Layers' } as const)[panelTab] : 'Selected'}</span>
          {siteStatus === 'live' && (
            <a href={pageSlug ? `/s/${siteSlug}/${pageSlug}` : `/s/${siteSlug}`} target="_blank" rel="noreferrer" className="font-label text-[9px] tracking-[2px] uppercase text-gold hover:text-goldLight">View ↗</a>
          )}
        </div>
        <button type="button" onClick={save} disabled={saving || !!editingComp} title={editingComp ? 'Finish editing the component first' : undefined} className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-4 py-2.5 rounded-sm disabled:opacity-50">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & publish'}
        </button>
        {saveError && (
          <p className="font-body text-[11px] leading-relaxed rounded-sm px-2.5 py-2" style={{ color: '#8a2b1d', background: '#fbe9e6', border: '1px solid rgba(179,64,47,0.3)' }}>{saveError}</p>
        )}
        {/* Write-with-AI + switch to the block editor */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setAiPageOpen(o => !o)} title="Write this page with AI" className="flex-1 font-label text-[9px] tracking-[1px] uppercase border px-2 py-1.5 rounded-sm" style={{ borderColor: aiPageOpen ? accent : 'rgba(168,92,54,0.35)', background: aiPageOpen ? accent : 'transparent', color: aiPageOpen ? '#fff' : accent }}>✨ AI</button>
          <form action={clearCanvasAction} className="flex-1">
            <input type="hidden" name="id" value={siteId} />
            <input type="hidden" name="pageSlug" value={pageSlug} />
            <button type="submit" title="Switch this page to the block editor — your free-canvas layout is saved and you can switch back anytime" className="w-full font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">▤ Blocks</button>
          </form>
        </div>
        {aiPageOpen && (
          <div className="rounded-sm p-2.5 flex flex-col gap-2" style={{ background: 'rgba(168,92,54,0.07)', border: '1px solid rgba(168,92,54,0.25)' }}>
            <textarea value={aiPageDesc} onChange={e => setAiPageDesc(e.target.value)} rows={3} placeholder="Describe this page — e.g. Reiki, soul readings and meditation circles in Lisbon." style={{ ...inputCss, resize: 'none', fontSize: 12 }} />
            <div className="flex items-center gap-2">
              <button type="button" disabled={aiPageBusy || !aiPageDesc.trim()} onClick={runAiCanvas} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-1.5 rounded-sm disabled:opacity-50">{aiPageBusy ? 'Writing…' : '✨ Generate'}</button>
              <span className="font-body text-ash/50 text-[10px] leading-tight">Lays it out on the canvas — replaces what&rsquo;s here (undoable).</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={undo} title="Undo (Ctrl+Z)" className="flex-1 font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">↩ Undo</button>
          <button type="button" onClick={redo} title="Redo (Ctrl+Shift+Z)" className="flex-1 font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">↪ Redo</button>
          <button type="button" onClick={() => setShowGrid(g => !g)} title="Toggle alignment grid" className="font-label text-[9px] tracking-[1px] uppercase px-2 py-1.5 rounded-sm border" style={{ borderColor: showGrid ? accent : 'rgba(0,0,0,0.2)', background: showGrid ? accent : 'transparent', color: showGrid ? '#fff' : '#888' }}>▦</button>
        </div>

        {lib && panelTab === 'text' && (
          <div>
            <p style={labelCss}>Add text</p>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {([['title', 'Title'], ['subtitle', 'Subtitle'], ['body', 'Body'], ['link', 'Link']] as [string, string][]).map(([key, lbl]) => (
                <button key={key} type="button" onClick={() => place(PRESETS[key])} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
              ))}
            </div>
            <p className="font-body text-ash/50 text-[11px] mt-3 leading-relaxed">Add a text box, then select it to change the words (✨ with AI too), size, colour and font.</p>
          </div>
        )}
        {lib && panelTab === 'elements' && (
          <div className="space-y-3">
            {([
              ['Media & buttons', [['image', 'Picture'], ['carousel', 'Slideshow'], ['button', 'Button'], ['contact', 'Contact'], ['menu', 'Page menu']]],
              ['Shapes', [['box', 'Box'], ['line', 'Line'], ['section', 'Section'], ['shape', 'Divider']]],
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
              <p style={labelCss}>Icons</p>
              <div className="flex flex-wrap gap-1 mt-1" style={{ maxHeight: 156, overflowY: 'auto' }}>
                {ICON_GROUPS.flatMap(g => g.keys).map(k => (
                  <button key={k} type="button" title={k} onClick={() => place({ type: 'icon', icon: k, w: 72, h: 72, color: '#111111' })} style={{ width: 30, height: 30, padding: 5, borderRadius: 4, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#3a2e20' }}>{canvasIcon(k)}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelCss}>Starters</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([['header', 'Header'], ['footer', 'Footer'], ['banner', 'Banner'], ['bar', 'Bar'], ['card', 'Card'], ['faq', 'FAQ']] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => addTemplate(k)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {lib && panelTab === 'uploads' && (
        <div>
          <p style={labelCss}>Your uploads</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-2 leading-relaxed">Upload logos &amp; pictures once, then drag one onto the page — or click to drop it in. Reuse them anywhere (header, footer, anywhere).</p>
          {uploads.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {uploads.map((src, i) => (
                <span key={i} className="relative inline-flex" style={{ width: 52, height: 52 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt=""
                    title="Drag onto the page, or click to place"
                    draggable
                    onDragStart={e => { dragUploadSrc.current = src; e.dataTransfer.effectAllowed = 'copy'; try { e.dataTransfer.setData('text/plain', 'upload') } catch { /* some browsers restrict */ } }}
                    onDragEnd={() => { dragUploadSrc.current = null }}
                    onClick={() => void placeUpload(src)}
                    style={{ width: 52, height: 52, objectFit: 'contain', cursor: 'grab', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 5, background: 'repeating-conic-gradient(#eee 0% 25%, #fff 0% 50%) 50% / 12px 12px' }}
                  />
                  <button type="button" onClick={() => { setUploads(p => p.filter((_, j) => j !== i)); touch() }} title="Remove from library" style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, lineHeight: '14px', textAlign: 'center', fontSize: 11, color: '#fff', background: '#b3402f', borderRadius: '50%' }}>×</button>
                </span>
              ))}
            </div>
          )}
          {uploads.length < MAX_UPLOADS && (
            <button type="button" onClick={uploadPick} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm self-start">+ Upload logo / picture</button>
          )}
        </div>
        )}

        {lib && panelTab === 'design' && (<>
        <div>
          <p style={labelCss}>Font style</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-2 leading-relaxed">The title, subtitle &amp; body fonts for this page.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FONT_SYSTEMS.map(f => {
              const on = fontSys === f.key
              return (
                <button key={f.key} type="button" onClick={() => { setFontSys(f.key); touch() }} title={f.name} style={{ ...fontVars(f.key), textAlign: 'left', padding: '6px 9px', borderRadius: 5, border: on ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.15)', background: '#fff' } as CSSProperties}>
                  <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, color: '#222', display: 'block', lineHeight: 1.15 }}>Aa</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#777', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </button>
              )
            })}
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
        <div className="space-y-1.5">
          <p style={labelCss}>Page background</p>
          <div className="flex items-center gap-2 mt-1.5">
            <ColorField value={bg || ''} onChange={v => { setBg(v); touch() }} fallback="#ffffff" palette={palette} />
            {bg && <button type="button" onClick={() => { setBg(''); touch() }} style={{ fontSize: 11, color: '#999' }}>×</button>}
            <button type="button" onClick={pickBg} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">{bgImage ? 'Change photo' : '+ Photo'}</button>
            {bgImage && <button type="button" onClick={() => { setBgImage(''); touch() }} style={{ fontSize: 11, color: '#b3402f' }}>remove</button>}
          </div>
          {gradientControls(bgGrad, g => { setBgGrad(g); touch() })}
          <input value={bgVideo} onChange={e => { setBgVideo(e.target.value); touch() }} placeholder="Background video URL (https://…mp4)" style={{ ...inputCss, fontSize: 11, marginTop: 4 }} />
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Brand palette</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-2 leading-relaxed">Save your colours here, then click a swatch beside any colour. Change a swatch and everything using it updates.</p>
          <div className="flex flex-wrap items-center gap-1.5">
            {palette.map((c, i) => (
              <span key={i} className="inline-flex items-center">
                <input type="color" value={c} onChange={e => { snapshot(); setPalette(p => p.map((x, j) => (j === i ? e.target.value : x))); touch() }} style={{ ...swatch, width: 26, height: 26 }} title={`Brand ${i + 1}`} />
                <button type="button" onClick={() => removePaletteColor(i)} title="Remove" style={{ fontSize: 11, color: '#b3402f', marginLeft: 1 }}>×</button>
              </span>
            ))}
            {palette.length < MAX_PALETTE && (
              <button type="button" onClick={() => { snapshot(true); setPalette(p => [...p, accent]); touch() }} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ Colour</button>
            )}
          </div>
          <p style={{ ...labelCss, marginTop: 10 }}>Brand fonts</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-2 leading-relaxed">Upload your own fonts (.woff2/.woff/.ttf/.otf), then pick them in any text or button.</p>
          <div className="flex flex-col gap-1">
            {fonts.map(f => (
              <div key={f.id} className="flex items-center gap-2">
                <span style={{ fontFamily: `'cvf-${f.id}', sans-serif`, fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#3a2e20' }}>{f.name}</span>
                <button type="button" title="Remove" onClick={() => { setFonts(p => p.filter(x => x.id !== f.id)); touch() }} style={{ fontSize: 11, color: '#b3402f' }}>×</button>
              </div>
            ))}
            {fonts.length < MAX_FONTS && (
              <button type="button" onClick={fontPick} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm self-start">+ Upload font</button>
            )}
          </div>
        </div>
        </>)}

        {lib && panelTab === 'elements' && (
        <div>
          <p style={labelCss}>Components</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-2 leading-relaxed">Select things, then “Make component”. Place it again to reuse the same design.</p>
          {components.length === 0 ? (
            <p className="font-body text-ash/40 text-[11px]">None yet.</p>
          ) : (
            <div className="space-y-0.5">
              {components.map(c => (
                <div key={c.id} className="flex items-center gap-1.5" style={{ opacity: editingComp ? 0.45 : 1 }}>
                  <button type="button" onClick={() => placeComponent(c.id)} disabled={!!editingComp} title={editingComp ? 'Finish the current edit first' : 'Place another instance'} className="flex-1 text-left disabled:cursor-not-allowed" style={{ fontSize: 12, color: '#5a513f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>＋ {c.name}</button>
                  <button type="button" onClick={() => deleteComponent(c.id)} disabled={!!editingComp} title="Delete component" className="disabled:cursor-not-allowed" style={{ fontSize: 11, color: '#b3402f' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
        )}

        {lib && panelTab === 'layers' && (
        <div>
          <div className="flex items-center justify-between">
            <p style={labelCss}>Layers</p>
            {els.length > 0 && <span style={{ fontSize: 9, color: '#b0a07a' }}>front → back</span>}
          </div>
          {els.length === 0 ? (
            <p className="font-body text-ash/40 text-[11px] mt-1.5">Nothing on the page yet.</p>
          ) : (
            <div className="mt-1.5 space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
              {[...els].sort((a, b) => (b.z ?? 0) - (a.z ?? 0)).map((el, i, arr) => {
                const isSel = selectedIds.includes(el.id)
                const devHidden = editingMobile ? !!el.mHidden : !!el.hidden
                const rowFaded = el.hidden || (editingMobile && el.mHidden)
                return (
                  <div
                    key={el.id}
                    onClick={e => selectFromList(e, el.id)}
                    className="flex items-center gap-1 px-1.5 py-1 rounded-sm cursor-pointer"
                    style={{ background: isSel ? accent : 'transparent', color: isSel ? '#fff' : '#5a513f' }}
                  >
                    <span style={{ fontSize: 11, width: 13, textAlign: 'center', opacity: 0.7 }}>{elIcon(el)}</span>
                    <span style={{ fontSize: 11, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontStyle: rowFaded ? 'italic' : undefined, opacity: rowFaded ? 0.55 : 1 }}>{elName(el)}</span>
                    <button type="button" title="Bring forward" disabled={i === 0} onClick={e => { e.stopPropagation(); reorderLayer(el.id, 1) }} style={layerBtn(isSel, i === 0)}>↑</button>
                    <button type="button" title="Send back" disabled={i === arr.length - 1} onClick={e => { e.stopPropagation(); reorderLayer(el.id, -1) }} style={layerBtn(isSel, i === arr.length - 1)}>↓</button>
                    <button type="button" title={editingMobile ? (devHidden ? 'Show on phone' : 'Hide on phone') : (devHidden ? 'Show on the page' : 'Hide from the page')} onClick={e => { e.stopPropagation(); update(el.id, editingMobile ? { mHidden: !el.mHidden } : { hidden: !el.hidden }) }} style={{ ...layerBtn(isSel, false), opacity: devHidden ? 1 : 0.4 }}>{devHidden ? '🚫' : '👁'}</button>
                    <button type="button" title={el.locked ? 'Unlock' : 'Lock in place'} onClick={e => { e.stopPropagation(); update(el.id, { locked: !el.locked }) }} style={{ ...layerBtn(isSel, false), opacity: el.locked ? 1 : 0.4 }}>{el.locked ? '🔒' : '🔓'}</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}

        {/* INSPECTOR — properties of the selected element(s) */}
        {!lib && (sel ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span style={labelCss}>{sel.type === 'text' ? 'Text' : sel.type === 'image' ? 'Picture' : sel.type === 'carousel' ? 'Slideshow' : sel.type === 'shape' ? 'Shape divider' : sel.type === 'icon' ? 'Icon' : sel.type === 'component' ? 'Component' : sel.type === 'button' ? 'Button' : sel.type === 'menu' ? 'Page menu' : 'Box'}</span>
              <div className="flex items-center gap-2">
                <button type="button" title="Copy style (Ctrl+Shift+C)" onClick={() => copyStyle(sel)} style={{ fontSize: 12, color: accent }}>🖌</button>
                {hasStyle && <button type="button" title="Paste style (Ctrl+Shift+V)" onClick={() => pasteStyle([sel.id])} style={{ fontSize: 11, color: accent, border: `1px solid ${accent}`, borderRadius: 3, padding: '0 4px' }}>paste</button>}
                <button type="button" title="Duplicate (Ctrl+D)" onClick={() => duplicate(sel.id)} style={{ fontSize: 13, color: accent }}>⧉</button>
                <button type="button" title="Bring forward" onClick={() => layer(sel.id, 1)} style={{ fontSize: 13, color: accent }}>▲</button>
                <button type="button" title="Send back" onClick={() => layer(sel.id, -1)} style={{ fontSize: 13, color: accent }}>▼</button>
                {(() => { const dh = editingMobile ? !!sel.mHidden : !!sel.hidden; return (
                  <button type="button" title={editingMobile ? (dh ? 'Show on phone' : 'Hide on phone') : (dh ? 'Show on the page' : 'Hide from the page')} onClick={() => update(sel.id, editingMobile ? { mHidden: !sel.mHidden } : { hidden: !sel.hidden })} style={{ fontSize: 12, color: accent, opacity: dh ? 1 : 0.45 }}>{dh ? '🚫' : '👁'}</button>
                ) })()}
                <button type="button" title={sel.locked ? 'Unlock' : 'Lock in place'} onClick={() => update(sel.id, { locked: !sel.locked })} style={{ fontSize: 12, color: accent, opacity: sel.locked ? 1 : 0.45 }}>{sel.locked ? '🔒' : '🔓'}</button>
                {!editingMobile && <button type="button" title={sel.pin === 'footer' ? 'Unpin from the bottom' : 'Pin to the bottom (footer)'} onClick={() => togglePin(sel.id)} style={{ fontSize: 12, color: accent, opacity: sel.pin === 'footer' ? 1 : 0.45 }}>📌</button>}
                <button type="button" title="Delete (Del)" onClick={() => remove(sel.id)} style={{ fontSize: 12, color: '#b3402f' }}>✕</button>
              </div>
            </div>
            {sel.locked && <p className="font-body text-[11px]" style={{ color: '#9a7d2e' }}>🔒 Locked — it won&rsquo;t move or resize on the canvas. Unlock above to change it.</p>}
            {sel.pin === 'footer' && !editingMobile && <p className="font-body text-[11px]" style={{ color: '#9a7d2e' }}>📌 Pinned to the bottom — it stays at the very end of the page as you add content above.</p>}
            {editingMobile && sel.mHidden && <p className="font-body text-[11px]" style={{ color: '#9a7d2e' }}>🚫 Hidden on phones — it still shows on desktop.</p>}

            {(sel.type === 'text' || sel.type === 'button') && (
              <>
                <textarea value={sel.text || ''} onChange={e => update(sel.id, { text: e.target.value })} rows={2} placeholder="Type here…" style={{ ...inputCss, resize: 'none' }} />
                <div className="flex items-center gap-1.5">
                  <input
                    value={aiInstr}
                    onChange={e => setAiInstr(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); runAiText(sel.id, aiInstr.trim() || 'Improve the writing — clearer and warmer, same meaning.') } }}
                    disabled={aiBusy}
                    placeholder="✨ Ask AI: shorter, warmer, fix typos…"
                    style={{ ...inputCss, fontSize: 12, padding: '6px 8px' }}
                  />
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={() => runAiText(sel.id, aiInstr.trim() || 'Improve the writing — clearer and warmer, same meaning.')}
                    title="Rewrite this text with AI"
                    className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-2.5 py-2 rounded-sm disabled:opacity-50 shrink-0"
                  >{aiBusy ? '…' : '✨ AI'}</button>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>{editingMobile ? 'Size (phone)' : 'Size'}</span>
                  {editingMobile ? (
                    <input type="range" min={12} max={120} value={sel.mFontSize ?? sel.fontSize ?? 24} onChange={e => update(sel.id, { mFontSize: Number(e.target.value) })} style={{ flex: 1 }} title="Font size on phones" />
                  ) : (
                    <input type="range" min={12} max={120} value={sel.fontSize || 24} onChange={e => update(sel.id, { fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
                  )}
                  <span style={{ fontSize: 11, color: '#666', width: 28 }}>{editingMobile ? (sel.mFontSize ?? sel.fontSize ?? 24) : sel.fontSize || 24}</span>
                </div>
                {editingMobile && sel.mFontSize && <button type="button" onClick={() => update(sel.id, { mFontSize: undefined })} className="font-label text-[9px] tracking-[1px] uppercase text-ash/60 hover:text-gold self-start">↺ match desktop size</button>}
                <div className="flex flex-wrap items-center gap-2">
                  {sel.type === 'text' && (
                    <>
                      <span style={labelCss}>Colour</span>
                      {colorField(sel.color, v => update(sel.id, { color: v }), '#111111')}
                    </>
                  )}
                  <button type="button" onClick={() => update(sel.id, { bold: !sel.bold })} style={{ fontWeight: 700, fontSize: 13, color: sel.bold ? accent : '#888', width: 24 }}>B</button>
                  <button type="button" onClick={() => update(sel.id, { italic: !sel.italic })} style={{ fontStyle: 'italic', fontSize: 13, color: sel.italic ? accent : '#888', width: 24 }}>I</button>
                </div>
                <div className="flex items-center gap-1.5">
                  <span style={labelCss}>Align</span>
                  {(['left', 'center', 'right'] as SiteAlign[]).map(a => (
                    <button key={a} type="button" title={a} onClick={() => update(sel.id, { align: a })} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, border: `1px solid ${sel.align === a ? accent : 'rgba(0,0,0,0.15)'}`, background: sel.align === a ? accent : 'transparent', color: sel.align === a ? '#fff' : '#666' }}>{a[0].toUpperCase()}</button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Font</span>
                  <select value={sel.fontFamily || 'display'} onChange={e => update(sel.id, { fontFamily: e.target.value })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value="display">Title font</option>
                    <option value="body">Body font</option>
                    <option value="label">Label font</option>
                    {fonts.map(f => <option key={f.id} value={`custom:${f.id}`}>{f.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Jump to</span>
                  <select value={sel.anchorTo || ''} onChange={e => update(sel.id, { anchorTo: e.target.value || undefined })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto', maxWidth: 150 }} title="On the live site, clicking scrolls to this element">
                    <option value="">— no jump —</option>
                    {els.filter(x => x.id !== sel.id && !x.hidden).map(x => <option key={x.id} value={x.id}>{elName(x).slice(0, 22)}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Spacing</span>
                  <input type="range" min={-5} max={30} value={sel.letterSpacing ?? 0} onChange={e => update(sel.id, { letterSpacing: Number(e.target.value) || undefined })} style={{ flex: 1 }} title="Letter spacing" />
                  <span style={{ fontSize: 11, color: '#666', width: 24 }}>{sel.letterSpacing ?? 0}</span>
                </div>
                {sel.type === 'text' && (
                  <>
                    <div className="flex items-center gap-2">
                      <span style={labelCss}>Lines</span>
                      <input type="range" min={0.8} max={3} step={0.05} value={sel.lineHeight ?? 1.25} onChange={e => update(sel.id, { lineHeight: Number(e.target.value) })} style={{ flex: 1 }} title="Line height" />
                      <span style={{ fontSize: 11, color: '#666', width: 28 }}>{(sel.lineHeight ?? 1.25).toFixed(2)}</span>
                    </div>
                    <button type="button" onClick={() => update(sel.id, { dropCap: !sel.dropCap })} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 3, border: `1px solid ${sel.dropCap ? accent : 'rgba(0,0,0,0.15)'}`, background: sel.dropCap ? accent : 'transparent', color: sel.dropCap ? '#fff' : '#666' }}>Drop cap {sel.dropCap ? 'on' : 'off'}</button>
                  </>
                )}
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
                  {colorField(sel.fill, v => update(sel.id, { fill: v }), accent)}
                  <span style={labelCss}>Link</span>
                  <select value={sel.ctaType || 'none'} onChange={e => update(sel.id, { ctaType: e.target.value as CtaType })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value="none">No link</option>
                    <option value="booking">Booking page</option>
                    <option value="email">Email me</option>
                    <option value="link">Custom link</option>
                  </select>
                </div>
                {sel.ctaType === 'link' && <input value={sel.href || ''} onChange={e => update(sel.id, { href: e.target.value })} placeholder="https://…" style={inputCss} />}
                {gradientControls(sel.gradient, g => update(sel.id, { gradient: g || undefined }))}
              </>
            )}
            {sel.type === 'image' && (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => imgPick(sel.id)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">{sel.src ? 'Replace' : 'Upload'}</button>
                  <button type="button" onClick={() => setStockId(sel.id)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">Stock photos</button>
                  {sel.src && <button type="button" onClick={() => setCropId(sel.id)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">Crop</button>}
                </div>
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
                <button type="button" onClick={() => update(sel.id, { lightbox: !sel.lightbox })} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 3, border: `1px solid ${sel.lightbox ? accent : 'rgba(0,0,0,0.15)'}`, background: sel.lightbox ? accent : 'transparent', color: sel.lightbox ? '#fff' : '#666' }}>Click to enlarge {sel.lightbox ? 'on' : 'off'}</button>
                {(() => {
                  const A = sel.adjust || {}
                  const setA = (patch: Partial<ImageAdjust>) => update(sel.id, { adjust: { ...A, ...patch } })
                  const presets: [string, ImageAdjust | undefined][] = [['None', undefined], ['Warm', { sepia: 25, saturate: 112, brightness: 104 }], ['Mono', { grayscale: 100 }], ['Faded', { contrast: 86, brightness: 108, saturate: 78 }], ['Vivid', { saturate: 145, contrast: 110 }], ['Soft', { blur: 1, brightness: 104, contrast: 96 }]]
                  const adj: [string, keyof ImageAdjust, number, number, number][] = [['Bright', 'brightness', 0, 200, 100], ['Contrast', 'contrast', 0, 200, 100], ['Saturate', 'saturate', 0, 300, 100], ['Blur', 'blur', 0, 20, 0], ['B&W', 'grayscale', 0, 100, 0]]
                  return (
                    <>
                      <div className="h-px bg-gold/10" />
                      <p style={labelCss}>Adjust photo</p>
                      <div className="flex flex-wrap gap-1.5">
                        {presets.map(([lbl, val]) => (
                          <button key={lbl} type="button" onClick={() => update(sel.id, { adjust: val })} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1 rounded-sm">{lbl}</button>
                        ))}
                      </div>
                      {adj.map(([lbl, key, min, max, dflt]) => (
                        <div key={key} className="flex items-center gap-2">
                          <span style={{ ...labelCss, width: 52 }}>{lbl}</span>
                          <input type="range" min={min} max={max} value={A[key] ?? dflt} onChange={e => { const v = Number(e.target.value); setA({ [key]: v === dflt ? undefined : v } as Partial<ImageAdjust>) }} style={{ flex: 1 }} />
                        </div>
                      ))}
                    </>
                  )
                })()}
              </>
            )}
            {sel.type === 'carousel' && (
              <>
                <button type="button" onClick={() => slidesPick(sel.id)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">+ Add images</button>
                {(sel.slides || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(sel.slides || []).map((s, i) => (
                      <span key={i} style={{ position: 'relative', display: 'inline-block' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s} alt="" style={{ width: 40, height: 30, objectFit: 'cover', borderRadius: 3, border: '1px solid rgba(0,0,0,0.15)', display: 'block' }} />
                        <button type="button" title="Remove" onClick={() => update(sel.id, { slides: (sel.slides || []).filter((_, j) => j !== i) })} style={{ position: 'absolute', top: -6, right: -6, fontSize: 10, color: '#fff', background: '#b3402f', borderRadius: '50%', width: 15, height: 15, lineHeight: '14px', textAlign: 'center' }}>×</button>
                      </span>
                    ))}
                  </div>
                )}
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
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Auto-play</span>
                  <input type="range" min={0} max={12} value={sel.interval ?? 4} onChange={e => update(sel.id, { interval: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#666', width: 34 }}>{sel.interval ? `${sel.interval}s` : 'off'}</span>
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
                  {colorField(sel.color, v => update(sel.id, { color: v }), accent)}
                  {(['left', 'center', 'right'] as SiteAlign[]).map(a => (
                    <button key={a} type="button" onClick={() => update(sel.id, { align: a })} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, border: `1px solid ${sel.align === a ? accent : 'rgba(0,0,0,0.15)'}`, background: sel.align === a ? accent : 'transparent', color: sel.align === a ? '#fff' : '#666' }}>{a[0].toUpperCase()}</button>
                  ))}
                </div>
                <div>
                  <span style={labelCss}>Menu style</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {([['plain', 'Plain'], ['underline', 'Underline'], ['pills', 'Pills'], ['boxed', 'Boxed'], ['stacked', 'Stacked ↕']] as [MenuStyle, string][]).map(([k, lbl]) => (
                      <button key={k} type="button" onClick={() => update(sel.id, { menuStyle: k })} className="font-label text-[9px] tracking-[1px] uppercase px-2.5 py-1.5 rounded-sm border" style={{ borderColor: (sel.menuStyle || 'plain') === k ? accent : 'rgba(0,0,0,0.15)', background: (sel.menuStyle || 'plain') === k ? accent : 'transparent', color: (sel.menuStyle || 'plain') === k ? '#fff' : '#666' }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <p className="font-body text-ash/50" style={{ fontSize: 11 }}>Shows links to all your pages. <b>Stacked</b> makes a vertical (side) menu. Manage pages in the Pages bar above the editor.</p>
              </>
            )}
            {sel.type === 'shape' && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {SHAPE_KINDS.map(k => (
                    <button key={k} type="button" title={k} onClick={() => update(sel.id, { shape: k })} style={{ width: 42, height: 28, padding: 2, borderRadius: 3, border: sel.shape === k ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.2)', background: '#fff' }}>
                      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}><path d={shapePath(k)} style={{ fill: accent }} /></svg>
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Colour</span>
                  {colorField(sel.fill, v => update(sel.id, { fill: v }), accent)}
                </div>
                <p className="font-body text-ash/50" style={{ fontSize: 11 }}>Rotate 180° (above) to flip it the other way.</p>
              </>
            )}
            {sel.type === 'icon' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Colour</span>
                  {colorField(sel.color, v => update(sel.id, { color: v }), accent)}
                </div>
                <p style={labelCss}>Pick an icon</p>
                <div className="flex flex-wrap gap-1" style={{ maxHeight: 170, overflowY: 'auto' }}>
                  {ICON_GROUPS.flatMap(g => g.keys).map(k => (
                    <button key={k} type="button" title={k} onClick={() => update(sel.id, { icon: k })} style={{ width: 30, height: 30, padding: 5, borderRadius: 4, border: sel.icon === k ? `2px solid ${accent}` : '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#5a513f' }}>{canvasIcon(k)}</button>
                  ))}
                </div>
              </>
            )}
            {sel.type === 'box' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Fill</span>
                  {colorField(sel.fill, v => update(sel.id, { fill: v }), '#e8dcc0')}
                  {sel.fill && <button type="button" onClick={() => update(sel.id, { fill: '' })} style={{ fontSize: 11, color: '#999' }}>×</button>}
                  <span style={labelCss}>Round</span>
                  <input type="range" min={0} max={120} value={sel.radius || 0} onChange={e => update(sel.id, { radius: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Border</span>
                  {colorField(sel.borderColor, v => update(sel.id, { borderColor: v, borderWidth: sel.borderWidth || 2 }), '#a85c36')}
                  <select value={sel.borderWidth || 0} onChange={e => update(sel.id, { borderWidth: Number(e.target.value) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value={0}>none</option>
                    <option value={2}>thin</option>
                    <option value={4}>medium</option>
                    <option value={8}>thick</option>
                  </select>
                </div>
                {gradientControls(sel.gradient, g => update(sel.id, { gradient: g || undefined }))}
              </>
            )}
            {sel.type === 'component' ? (
              <>
                <p className="font-body text-[12px]" style={{ color: '#5a513f' }}>❖ {components.find(c => c.id === sel.componentId)?.name || 'Component'}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => editComponent(sel.id)} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:opacity-90 px-2.5 py-1.5 rounded-sm">✎ Edit component</button>
                  <button type="button" onClick={() => detachComponent(sel.id)} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">Detach</button>
                </div>
                <p className="font-body text-ash/50 text-[11px] leading-relaxed">An instance of a reusable component. <b>Edit</b> changes every instance at once; <b>Detach</b> unlinks just this one into plain elements.</p>
              </>
            ) : !editingComp ? (
              <button type="button" onClick={() => makeComponent([sel.id])} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm self-start">❖ Make component</button>
            ) : null}
            <div className="flex items-center gap-2">
              <span style={labelCss}>Opacity</span>
              <input type="range" min={10} max={100} value={sel.opacity ?? 100} onChange={e => update(sel.id, { opacity: Number(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#666', width: 32 }}>{sel.opacity ?? 100}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={labelCss}>Rotate</span>
              <input type="range" min={-180} max={180} value={sel.rotate ?? 0} onChange={e => update(sel.id, { rotate: Number(e.target.value) })} style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#666', width: 32 }}>{sel.rotate ?? 0}°</span>
            </div>
            {(sel.type === 'box' || sel.type === 'button' || sel.type === 'image') && (
              <div className="flex items-center gap-2">
                <span style={labelCss}>Shadow</span>
                <select value={sel.shadow || 'none'} onChange={e => update(sel.id, { shadow: e.target.value === 'none' ? undefined : (e.target.value as ShadowKind) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                  <option value="none">None</option>
                  {SHADOW_KINDS.map(s => <option key={s} value={s}>{({ sm: 'Subtle', md: 'Soft', lg: 'Medium', xl: 'Floating', glow: 'Glow' } as Record<string, string>)[s]}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span style={labelCss}>Blend</span>
              <select value={sel.blend || 'normal'} onChange={e => update(sel.id, { blend: e.target.value === 'normal' ? undefined : (e.target.value as BlendMode) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                {BLEND_MODES.map(b => <option key={b} value={b}>{b === 'normal' ? 'Normal' : b.replace('-', ' ')}</option>)}
              </select>
            </div>
            <div className="h-px bg-gold/10" />
            <p style={labelCss}>Motion <span style={{ textTransform: 'none', letterSpacing: 0, color: '#b0a07a' }}>(plays on your live site)</span></p>
            <div className="flex items-center gap-2">
              <span style={labelCss}>Reveal</span>
              <select value={sel.reveal || 'none'} onChange={e => update(sel.id, { reveal: e.target.value === 'none' ? undefined : (e.target.value as RevealKind) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                <option value="none">None</option>
                {REVEAL_KINDS.map(r => <option key={r} value={r}>{({ fade: 'Fade in', up: 'Rise up', down: 'Drop down', left: 'Slide ←', right: 'Slide →', zoom: 'Zoom in' } as Record<string, string>)[r]}</option>)}
              </select>
            </div>
            {sel.reveal && (
              <div className="flex items-center gap-2">
                <span style={labelCss}>Delay</span>
                <input type="range" min={0} max={1200} step={50} value={sel.revealDelay ?? 0} onChange={e => update(sel.id, { revealDelay: Number(e.target.value) || undefined })} style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#666', width: 38 }}>{((sel.revealDelay ?? 0) / 1000).toFixed(2)}s</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span style={labelCss}>Hover</span>
              <select value={sel.hover || 'none'} onChange={e => update(sel.id, { hover: e.target.value === 'none' ? undefined : (e.target.value as HoverKind) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                <option value="none">None</option>
                {HOVER_KINDS.map(h => <option key={h} value={h}>{({ grow: 'Grow', lift: 'Lift', glow: 'Glow', dim: 'Dim', rotate: 'Tilt' } as Record<string, string>)[h]}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span style={labelCss}>Parallax</span>
              <input type="range" min={-5} max={5} value={sel.parallax ?? 0} onChange={e => update(sel.id, { parallax: Number(e.target.value) || undefined })} style={{ flex: 1 }} title="Drift speed as the visitor scrolls" />
              <span style={{ fontSize: 11, color: '#666', width: 18 }}>{sel.parallax ?? 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span style={labelCss}>Cursor</span>
              <select value={sel.cursor || 'default'} onChange={e => update(sel.id, { cursor: e.target.value === 'default' ? undefined : (e.target.value as CursorKind) })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                <option value="default">Default</option>
                {CURSOR_KINDS.map(c => <option key={c} value={c}>{c.replace('-', ' ')}</option>)}
              </select>
            </div>
          </div>
        ) : selectedIds.length > 1 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span style={labelCss}>{selectedIds.length} selected</span>
              <div className="flex items-center gap-2">
                {hasStyle && <button type="button" title="Paste style onto all (Ctrl+Shift+V)" onClick={() => pasteStyle(selectedIds)} style={{ fontSize: 11, color: accent, border: `1px solid ${accent}`, borderRadius: 3, padding: '0 4px' }}>paste style</button>}
                <button type="button" title="Duplicate (Ctrl+D)" onClick={() => duplicateMany(selectedIds)} style={{ fontSize: 13, color: accent }}>⧉</button>
                <button type="button" title="Delete (Del)" onClick={() => removeMany(selectedIds)} style={{ fontSize: 12, color: '#b3402f' }}>✕</button>
              </div>
            </div>
            <div>
              <p style={labelCss}>Align</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {([['left', 'Left'], ['hcenter', 'Centre'], ['right', 'Right'], ['top', 'Top'], ['vmiddle', 'Middle'], ['bottom', 'Bottom']] as const).map(([how, lbl]) => (
                  <button key={how} type="button" onClick={() => alignSelected(how)} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">{lbl}</button>
                ))}
              </div>
            </div>
            {selectedIds.length > 2 && (
              <div>
                <p style={labelCss}>Distribute evenly</p>
                <div className="flex gap-1.5 mt-1.5">
                  <button type="button" onClick={() => distributeSelected('h')} className="flex-1 font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">Across</button>
                  <button type="button" onClick={() => distributeSelected('v')} className="flex-1 font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm">Down</button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={groupSelected} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:opacity-90 px-2.5 py-1.5 rounded-sm">⊞ Group</button>
              {els.some(e => selectedIds.includes(e.id) && e.groupId) && <button type="button" onClick={ungroupSelected} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">Ungroup</button>}
              {!editingComp && <button type="button" onClick={() => makeComponent(selectedIds)} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">❖ Make component</button>}
            </div>
            <p className="font-body text-ash/50 text-[11px] leading-relaxed">{els.some(e => selectedIds.includes(e.id) && e.groupId) ? 'Grouped — they select and move together. Ungroup to edit one on its own.' : 'Drag any selected element to move them all together. Group to keep them as one. Shift-click to add or remove.'}</p>
          </div>
        ) : null)}
      </div>
      </div>

      {/* CANVAS */}
      <div className="flex-1 min-w-0">
        {editingComp && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-sm px-3.5 py-2.5" style={{ background: '#fbf3da', border: '1px solid rgba(154,125,46,0.4)' }}>
            <span className="font-body text-[12px]" style={{ color: '#7a5c0e' }}>✎ Editing <b>{components.find(c => c.id === editingComp.id)?.name || 'component'}</b> — rearrange these elements, then save to update every instance.</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={cancelEditComponent} className="font-label text-[9px] tracking-[1px] uppercase text-ash/60 hover:text-gold px-2.5 py-1.5">Cancel</button>
              <button type="button" onClick={finishEditComponent} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:opacity-90 px-3 py-1.5 rounded-sm">✓ Save to all instances</button>
            </div>
          </div>
        )}
        {/* Desktop / Phone toggle */}
        {!editingComp && (
        <div className="flex items-center justify-center gap-2 mb-3">
          {([['desktop', '🖥 Desktop'], ['mobile', '📱 Phone']] as const).map(([d, lbl]) => (
            <button key={d} type="button" onClick={() => { setDevice(d); setSelectedIds([]); setEditingId('') }} className="font-label text-[10px] tracking-[1px] uppercase px-3.5 py-1.5 rounded-sm border" style={{ borderColor: device === d ? accent : 'rgba(0,0,0,0.15)', background: device === d ? accent : 'transparent', color: device === d ? '#fff' : '#888' }}>{lbl}</button>
          ))}
        </div>
        )}

        {device === 'mobile' ? (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-center">
            {mobileCustom ? (
              <>
                <span className="font-body text-ash/60 text-[11px]">Custom phone layout — drag, resize and arrange just like desktop.</span>
                <button type="button" onClick={seedMobile} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1 rounded-sm">↺ Re-stack</button>
                <button type="button" onClick={useAutoMobile} className="font-label text-[9px] tracking-[1px] uppercase text-ash/60 hover:text-gold px-2 py-1">Back to automatic</button>
              </>
            ) : (
              <>
                <span className="font-body text-ash/60 text-[11px]">Your phone layout is automatic — everything stacks neatly top to bottom.</span>
                <button type="button" onClick={seedMobile} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-1.5 rounded-sm">✏️ Customise the phone layout</button>
              </>
            )}
          </div>
        ) : (
          <p className="font-body text-ash/60 text-xs mb-3 text-center">Drag to move (snaps to align) · drag a box to select several · corner ◢ resizes (hold Shift to keep proportions) · arrows nudge · Ctrl+D duplicate · Ctrl+Z undo · Del removes.</p>
        )}

        {device === 'mobile' && !mobileCustom ? (
          // The automatic phone layout, shown read-only in a phone frame.
          <div className="mx-auto rounded-[28px] overflow-hidden border-[7px] border-neutral-300 shadow-md" style={{ maxWidth: 360, background: bg || t.bg, ...fontVars(fontSys) } as CSSProperties}>
            <div style={{ pointerEvents: 'none' }}>
              <MobileStack canvas={{ h: desktopH, bg: bg.trim() || undefined, bgGradient: bgGrad || undefined, bgImage: bgImage.trim() || undefined, elements: els, palette: palette.length ? palette : undefined, components }} accent={accent} siteSlug={siteSlug} contactEmail={contactEmail} safeHref={h => h} navPages={navPages} />
            </div>
          </div>
        ) : (
          <>
            {!editingMobile && (
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <button type="button" onClick={() => setZoomClamped(zoom - 0.1)} title="Zoom out" className="font-label text-[12px] text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ width: 26, height: 24, lineHeight: '22px' }}>−</button>
                <button type="button" onClick={() => setZoom(1)} title="Reset to 100%" className="font-label text-[10px] tracking-[1px] text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ width: 54, height: 24 }}>{Math.round(zoom * 100)}%</button>
                <button type="button" onClick={() => setZoomClamped(zoom + 0.1)} title="Zoom in" className="font-label text-[12px] text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ width: 26, height: 24, lineHeight: '22px' }}>+</button>
              </div>
            )}
          <div onWheel={e => { if (!editingMobile && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoomClamped(zoom - e.deltaY * 0.0015) } }} style={{ overflow: 'auto', maxHeight: '80vh' }}>
          <div className={`rounded-sm overflow-hidden border border-gold/15 ${zoom === 1 || editingMobile ? 'mx-auto' : ''} ${!editingMobile && pageWidth === 'contained' && zoom === 1 ? 'max-w-3xl' : ''}`} style={{ ...fontVars(fontSys), width: editingMobile ? 380 : zoom === 1 ? '100%' : `${zoom * 100}%`, maxWidth: editingMobile ? 380 : undefined } as CSSProperties}>
            <div
              ref={canvasRef}
              onPointerDown={bgPointerDown}
              onDragOver={e => { if (dragUploadSrc.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
              onDrop={onCanvasDrop}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: `${CW} / ${CH}`,
                containerType: 'inline-size',
                background: bgImage ? bg || t.bg : gradientCss(bgGrad) || bg || t.bg,
                backgroundImage: bgImage ? `url('${bgImage}')` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                ...brandVars,
              } as CSSProperties}
            >
              {bgVideo.trim() && <video src={bgVideo.trim()} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />}
              {showGrid && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0 1px, transparent 1px ${cqv(50)}), repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0 1px, transparent 1px ${cqv(50)})` }} />}
              {[...els].sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(el => {
                const elHidden = el.hidden || (editingMobile && el.mHidden)
                return (
                  <div
                    key={el.id}
                    onPointerDown={e => { if (el.locked || editingId === el.id) return; startDrag(e, el, 'move') }}
                    onDoubleClick={() => { if (!el.locked && (el.type === 'text' || el.type === 'button')) { setSelectedIds([el.id]); setEditingId(el.id) } }}
                    style={{ position: 'absolute', left: cqv(gx(el)), top: cqv(topOf(el)), width: cqv(gw(el)), height: cqv(gh(el)), opacity: (elHidden ? 0.3 : 1) * (el.opacity ?? 100) / 100, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, mixBlendMode: el.blend, cursor: el.locked ? 'default' : editingId === el.id ? 'text' : 'move', touchAction: 'none', outline: selectedIds.includes(el.id) ? `2px solid ${accent}` : elHidden ? '1px dashed rgba(0,0,0,0.25)' : undefined, outlineOffset: 1 }}
                  >
                    {elInner(el)}
                    {selectedId === el.id && !el.locked && (
                      <div
                        onPointerDown={e => startDrag(e, el, 'resize')}
                        style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: 3, background: accent, border: '2px solid #fff', cursor: 'nwse-resize', touchAction: 'none', zIndex: 2 }}
                      />
                    )}
                  </div>
                )
              })}
              {!editingMobile && els.some(e => e.pin === 'footer') && (
                <div style={{ position: 'absolute', left: 0, top: cqv(bodyBottom), width: '100%', height: 0, borderTop: '1px dashed rgba(154,125,46,0.5)', pointerEvents: 'none', zIndex: 4 }}>
                  <span style={{ position: 'absolute', left: 6, top: 3, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(154,125,46,0.8)' }}>Footer — pinned to the bottom</span>
                </div>
              )}
              {guides.x !== null && <div style={{ position: 'absolute', left: cqv(guides.x), top: 0, width: 1, height: '100%', background: '#3b82f6', pointerEvents: 'none', zIndex: 5 }} />}
              {guides.y !== null && <div style={{ position: 'absolute', top: cqv(guides.y), left: 0, height: 1, width: '100%', background: '#3b82f6', pointerEvents: 'none', zIndex: 5 }} />}
              {marquee && <div style={{ position: 'absolute', left: cqv(marquee.x), top: cqv(marquee.y), width: cqv(marquee.w), height: cqv(marquee.h), border: '1px solid #3b82f6', background: 'rgba(59,130,246,0.10)', pointerEvents: 'none', zIndex: 6 }} />}
            </div>
          </div>
          </div>
          </>
        )}
      </div>

      {cropId && (() => {
        const el = els.find(e => e.id === cropId)
        return el && el.src ? (
          <CropModal src={el.src} onApply={u => { update(cropId, { src: u }); setCropId('') }} onClose={() => setCropId('')} />
        ) : null
      })()}

      {stockId && <StockPhotos onSelect={u => { update(stockId, { src: u }); setStockId('') }} onClose={() => setStockId('')} />}
    </div>
  )
}
