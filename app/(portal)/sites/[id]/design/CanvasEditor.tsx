'use client'

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type MouseEvent as ReactMouseEvent, type DragEvent as RDragEvent } from 'react'
import { createPortal } from 'react-dom'
import { CANVAS_W, MOBILE_W, THEMES, BLEND_MODES, REVEAL_KINDS, HOVER_KINDS, SHADOW_KINDS, SHAPE_KINDS, CURSOR_KINDS, MAX_PALETTE, MAX_FONTS, MAX_UPLOADS, canvasLayout, brandVar, isBrandToken, gradientCss, pageBackground, filterCss, shadowCss, shapePath, fontFaceCss, flowContainerStyle, flowItemStyle, flowChildren, type FlowConfig, type PageCanvas, type CanvasElement, type CanvasElementType, type SiteTheme, type CtaType, type ImageFit, type SiteAlign, type Gradient, type BlendMode, type RevealKind, type HoverKind, type ShadowKind, type ShapeKind, type MenuStyle, type CursorKind, type ImageAdjust, type SiteFont, type SiteComponent, TEXT_STYLE_KEYS, TEXT_STYLE_LABELS, defaultTextStyles, type TextStyleProps, type TextStyleKey, FORM_FIELD_TYPES, FORM_FIELD_LABELS, defaultFormFields, type FormFieldType, type SiteBanner, type SitePopup, PAGE_TRANSITION_KINDS, type PageTransitionKind } from '@/lib/sites/types'
import { fontVars, FONT_SYSTEMS } from '@/lib/sites/fonts'
import { canvasIcon, ICON_GROUPS } from '@/lib/sites/icons'
import { resizeToDataUrl } from '@/lib/sites/image'
import { CanvasView, MobileStack, renderInner, type RenderCtx } from '@/lib/sites/CanvasView'
import { CANVAS_TEMPLATES, type CanvasTemplate } from '@/lib/sites/canvasTemplates'
import CropModal from './CropModal'
import StockPhotos from './StockPhotos'
import { saveCanvasAction, aiTextAction, aiCanvasAction, clearCanvasAction, suggestAltAction, critiqueDesignAction, setBrandVoiceAction, setPageTransitionAction, suggestPaletteAction, polishCopyAction, mobileLayoutAction, addPageAction, duplicatePageAction, removePageAction } from '../../actions'
import type { DesignCritique } from '@/lib/sites/generate'
import { contrastRatio, contrastVerdict, resolveColor } from '@/lib/sites/a11y'
import { embedSrc } from '@/lib/sites/embed'
const fontVar = (f?: string) => (f === 'body' ? 'var(--font-body)' : f === 'label' ? 'var(--font-label)' : f && f.startsWith('custom:') ? `'cvf-${f.slice(7)}', sans-serif` : 'var(--font-display)')
const inputCss: CSSProperties = { background: '#fff', color: '#1f2430', border: '1px solid #e6e6e9', borderRadius: 8, fontSize: 13, padding: '7px 10px', width: '100%' }
const labelCss: CSSProperties = { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', fontWeight: 600, color: '#9aa0ab' }
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

// HSV <-> hex helpers for the colour picker's spectrum.
const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return { h: 0, s: 0, v: 0 }
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60; if (h < 0) h += 360
  }
  return { h, s: max ? d / max : 0, v: max }
}
function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60) { r = c; g = x } else if (h < 120) { r = x; g = c } else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c } else if (h < 300) { r = x; b = c } else { r = c; b = x }
  const to = (u: number) => Math.round((u + m) * 255).toString(16).padStart(2, '0')
  return '#' + to(r) + to(g) + to(b)
}
const DEFAULT_SOLIDS = ['#000000', '#3f3f46', '#71717a', '#a1a1aa', '#d4d4d8', '#ffffff', '#e24b4a', '#ef9f27', '#f4d03f', '#5fa85a', '#1d9e75', '#378add', '#5b5bd6', '#9b59b6', '#d4537e']
const RECENT_KEY = 'cveditor:recentColors'
function readRecent(): string[] {
  try { const a = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(a) ? a.filter((c: unknown) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c)).slice(0, 12) : [] } catch { return [] }
}
function pushRecent(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return
  try { const next = [hex.toLowerCase(), ...readRecent().filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, 12); localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
}
function removeRecentColor(hex: string) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(readRecent().filter(c => c.toLowerCase() !== hex.toLowerCase()))) } catch { /* ignore */ }
}

// A Canva-style colour control: a swatch button + hex box inline; clicking the swatch
// opens a floating picker with an HSV spectrum, an eyedropper, the brand palette
// ("colours in this design") and a row of default solids. Stores a hex, or a
// var(--brand-N) token when a brand swatch is chosen.
function ColorField({ value, onChange, fallback, palette }: { value?: string; onChange: (v: string) => void; fallback: string; palette: string[] }) {
  const resolved = value && isBrandToken(value) ? (palette[Number(value.slice(-2, -1))] || '#888888') : (value || '')
  const current = resolved && /^#[0-9a-f]{6}$/i.test(resolved) ? resolved : fallback
  const [text, setText] = useState(resolved)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [hsv, setHsv] = useState(() => hexToHsv(current))
  const [recent, setRecent] = useState<string[]>([])
  const wrapRef = useRef<HTMLSpanElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  useEffect(() => { setText(resolved) }, [resolved])

  const openPicker = () => {
    setHsv(hexToHsv(current))
    setRecent(readRecent())
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 240)), top: Math.max(8, Math.min(r.bottom + 6, window.innerHeight - 320)) })
    setOpen(true)
  }
  useEffect(() => {
    if (!open) return
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const pick = (hex: string) => { onChange(hex); setHsv(hexToHsv(hex)); pushRecent(hex); setRecent(readRecent()) }
  const setH = (h: number) => { const n = { ...hsv, h }; setHsv(n); onChange(hsvToHex(n.h, n.s, n.v)) }
  const setSV = (s: number, v: number) => { const n = { ...hsv, s, v }; setHsv(n); onChange(hsvToHex(n.h, n.s, n.v)) }
  const svMove = (e: RPointerEvent) => { const r = e.currentTarget.getBoundingClientRect(); setSV(clamp01((e.clientX - r.left) / r.width), clamp01(1 - (e.clientY - r.top) / r.height)) }
  const hueMove = (e: RPointerEvent) => { const r = e.currentTarget.getBoundingClientRect(); setH(clamp01((e.clientX - r.left) / r.width) * 360) }
  const commitText = () => { const c = normalizeColor(text); if (c) pick(c); else setText(resolved) }
  const eyeOk = typeof window !== 'undefined' && 'EyeDropper' in window
  const swatch = (c: string, on: boolean, fn: () => void, key: string | number) => (
    <button key={key} type="button" title={c} onClick={fn} style={{ width: 22, height: 22, borderRadius: 5, background: c, cursor: 'pointer', border: on ? '2px solid #2b2f33' : '1px solid rgba(0,0,0,0.18)', padding: 0 }} />
  )

  return (
    <span ref={wrapRef} className="inline-flex items-center gap-1.5">
      <button type="button" onClick={openPicker} title="Pick a colour" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid rgba(0,0,0,0.18)', background: current, cursor: 'pointer', padding: 0 }} />
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={e => { if (e.key === 'Enter') { commitText(); (e.currentTarget as HTMLInputElement).blur() } }}
        placeholder="#hex / name"
        spellCheck={false}
        style={{ width: 78, background: '#fff', color: '#1f2430', border: '1px solid #e6e6e9', borderRadius: 6, fontSize: 11, padding: '5px 6px', fontFamily: 'monospace' }}
        title="Type a colour name (e.g. tomato) or hex (#ff6347)"
      />
      {open && pos && createPortal(
        <div ref={popRef} style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 9999, width: 230, background: '#fff', border: '1px solid #e6e6e9', borderRadius: 14, boxShadow: '0 10px 40px -8px rgba(17,17,26,0.28)', padding: 12 }}>
          <div className="flex items-center gap-1.5" style={{ marginBottom: 10 }}>
            <input value={text} onChange={e => setText(e.target.value)} onBlur={commitText} onKeyDown={e => { if (e.key === 'Enter') commitText() }} placeholder="Try “blue” or “#00c4cc”" spellCheck={false} style={{ flex: 1, minWidth: 0, background: '#fff', color: '#1f2430', border: '1px solid #e6e6e9', borderRadius: 8, fontSize: 12, padding: '6px 8px' }} />
            {eyeOk && (
              <button type="button" title="Pick a colour from the screen" onClick={async () => { try { const ED = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper; const res = await new ED().open(); if (res?.sRGBHex) pick(res.sRGBHex) } catch { /* cancelled */ } }} style={{ width: 30, height: 30, flex: 'none', borderRadius: 8, border: '1px solid #e6e6e9', background: '#fff', color: '#555', fontSize: 15 }}>⛏</button>
            )}
          </div>
          <div onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); svMove(e) }} onPointerMove={e => { if (e.buttons) svMove(e) }} style={{ position: 'relative', width: '100%', height: 132, borderRadius: 8, cursor: 'crosshair', touchAction: 'none', background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(${hsv.h}, 100%, 50%)` }}>
            <div style={{ position: 'absolute', left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, transform: 'translate(-50%,-50%)', width: 13, height: 13, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
          </div>
          <div onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); hueMove(e) }} onPointerMove={e => { if (e.buttons) hueMove(e) }} style={{ position: 'relative', width: '100%', height: 12, borderRadius: 6, marginTop: 10, cursor: 'ew-resize', touchAction: 'none', background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
            <div style={{ position: 'absolute', left: `${(hsv.h / 360) * 100}%`, top: '50%', transform: 'translate(-50%,-50%)', width: 15, height: 15, borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', background: `hsl(${hsv.h}, 100%, 50%)`, pointerEvents: 'none' }} />
          </div>
          {palette.length > 0 && (
            <>
              <div style={{ ...labelCss, marginTop: 12, marginBottom: 6 }}>Colours in this design</div>
              <div className="flex flex-wrap gap-1.5">
                {palette.map((c, i) => swatch(c, value === brandVar(i), () => { onChange(brandVar(i)); setHsv(hexToHsv(c || '#888888')) }, 'p' + i))}
              </div>
            </>
          )}
          {recent.length > 0 && (
            <>
              <div style={{ ...labelCss, marginTop: 12, marginBottom: 6 }}>Recent</div>
              <div className="flex flex-wrap gap-2">
                {recent.map(c => (
                  <span key={'r' + c} style={{ position: 'relative', display: 'inline-block' }}>
                    {swatch(c, resolved.toLowerCase() === c, () => pick(c), 'r' + c)}
                    <button type="button" title="Remove from recent" onClick={e => { e.stopPropagation(); removeRecentColor(c); setRecent(readRecent()) }} style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: 999, background: '#fff', border: '1px solid rgba(0,0,0,0.25)', fontSize: 9, lineHeight: '11px', color: '#666', padding: 0, cursor: 'pointer' }}>×</button>
                  </span>
                ))}
              </div>
            </>
          )}
          <div style={{ ...labelCss, marginTop: 12, marginBottom: 6 }}>Default colours</div>
          <div className="flex flex-wrap gap-1.5">
            {DEFAULT_SOLIDS.map(c => swatch(c, resolved.toLowerCase() === c, () => pick(c), c))}
          </div>
        </div>,
        document.body
      )}
    </span>
  )
}

type Drag =
  | { kind: 'move'; px: number; py: number; scale: number; m: boolean; starts: { id: string; x: number; y: number }[] }
  | { kind: 'resize'; id: string; px: number; py: number; scale: number; m: boolean; w: number; h: number; ar: number; dir: 'se' | 'e' | 's' }
  | { kind: 'marquee'; px: number; py: number; scale: number; m: boolean; ox: number; oy: number }
  | null

const GRID_SIZES = [8, 10, 16, 20, 24, 32, 40, 50] // selectable snap-grid cell sizes (design px)

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
  allPages = [],
  brandVoice: initialBrandVoice = '',
  pageTransition: initialPageTransition = 'none',
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
  allPages?: { slug: string; title: string; hidden?: boolean }[]
  brandVoice?: string
  pageTransition?: PageTransitionKind
  initial: PageCanvas | null
}) {
  const t = THEMES[theme] ?? THEMES.sand
  const ui = '#67905d' // editor-chrome accent (sage); mirrors the tailwind 'gold' token. Stays the same whatever the user's own brand colour is.
  const [els, setEls] = useState<CanvasElement[]>(initial?.elements ?? [])
  const [bg, setBg] = useState(initial?.bg ?? '')
  const [bgGrad, setBgGrad] = useState<Gradient | null>(initial?.bgGradient ?? null)
  const [bgImage, setBgImage] = useState(initial?.bgImage ?? '')
  const [bgVideo, setBgVideo] = useState(initial?.bgVideo ?? '')
  const [bgOpacity, setBgOpacity] = useState(initial?.bgOpacity ?? 100)
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
  const [altBusy, setAltBusy] = useState(false) // AI alt-text suggestion in progress
  // Which tool category the left panel shows (Canva-style). Selecting an element
  // overrides this with its properties (the inspector); deselect to see a tab again.
  const [panelTab, setPanelTab] = useState<'design' | 'text' | 'elements' | 'uploads' | 'layers' | 'pages'>('design')
  // Pages tab folders are an editor-only organisation layer kept per-browser in localStorage
  // (like recent colours / saved blocks). They never touch the saved site or the URLs, so
  // they can't race the editor's re-mount-on-navigation or get dropped by a save path.
  const foldersKey = `cvfolders:${siteId}`
  const [folderMap, setFolderMap] = useState<Record<string, string>>({})
  useEffect(() => { try { setFolderMap(JSON.parse(localStorage.getItem(foldersKey) || '{}') || {}) } catch { /* ignore */ } }, [foldersKey])
  const collapseKey = `cvfoldcollapse:${siteId}`
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  useEffect(() => { try { const arr = JSON.parse(localStorage.getItem(collapseKey) || '[]'); if (Array.isArray(arr)) setCollapsedFolders(new Set(arr)) } catch { /* ignore */ } }, [collapseKey])
  const toggleFolder = (f: string) => setCollapsedFolders(s => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); try { localStorage.setItem(collapseKey, JSON.stringify(Array.from(n))) } catch { /* ignore */ } return n })
  const dragPageRef = useRef<string | null>(null) // slug being dragged in the Pages panel
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null) // drop target: folder name, '__top', or null
  const [showShortcuts, setShowShortcuts] = useState(false) // keyboard cheatsheet (press ?)
  const assignFolder = (slug: string, folder: string) => {
    setFolderMap(m => {
      const n = { ...m }
      if (folder) n[slug] = folder.slice(0, 40)
      else delete n[slug]
      try { localStorage.setItem(foldersKey, JSON.stringify(n)) } catch { /* ignore */ }
      return n
    })
  }
  // Duplicate / delete a page from the Pages panel. These navigate (the server action
  // redirects), which re-mounts the editor — so persist the current page FIRST, and abort
  // if that save can't complete, so unsaved canvas edits are never silently dropped.
  const pageAction = async (kind: 'dup' | 'del', slug: string, title: string) => {
    if (kind === 'del' && !window.confirm(`Delete the page “${title || slug}”? This can't be undone.`)) return
    if (dirty.current) { await save(); if (dirty.current) return } // save failed / blocked → keep the user here with their work
    const fd = new FormData()
    fd.set('id', siteId)
    fd.set('slug', slug)
    await (kind === 'del' ? removePageAction(fd) : duplicatePageAction(fd))
  }
  // Switching pages / adding a page also navigates (full re-mount), so save the current page
  // first — otherwise edits made within the autosave debounce window are dropped.
  const goToPage = async (slug: string) => {
    if (dirty.current) { await save(); if (dirty.current) return }
    window.location.href = `/sites/${siteId}/design?page=${slug}`
  }
  const addPage = async () => {
    if (dirty.current) { await save(); if (dirty.current) return }
    const fd = new FormData()
    fd.set('id', siteId)
    fd.set('canvas', '1')
    await addPageAction(fd)
  }
  const [aiPageOpen, setAiPageOpen] = useState(false) // the "write this page with AI" prompt popover
  const [aiPageDesc, setAiPageDesc] = useState('')
  const [aiPageBusy, setAiPageBusy] = useState(false)
  const [zoom, setZoom] = useState(1) // desktop canvas zoom; pan by scrolling the viewport
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null) // right-click menu position
  const [showTemplates, setShowTemplates] = useState(false) // template gallery modal
  const setZoomClamped = (z: number) => setZoom(Math.min(3, Math.max(0.25, Math.round(z * 100) / 100)))
  // Zoom so the whole (often tall) page fits the viewport height; never past 100%.
  const fitToScreen = () => {
    const vp = viewportRef.current
    if (!vp || editingMobile) { setZoom(1); return }
    const W = vp.clientWidth
    const H = vp.clientHeight
    const tall = canvasLayout(elsRef.current).totalH
    if (!W || !H || !tall) { setZoom(1); return }
    setZoomClamped(Math.min(1, (H * CANVAS_W) / (W * tall)))
  }
  const [showGrid, setShowGrid] = useState(false) // editor-only alignment grid overlay (also snaps when on)
  const [gridSize, setGridSize] = useState(20) // grid cell size in design px
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [focusMode, setFocusMode] = useState(false) // hide the side panel to give the canvas the whole width
  const [mobileCustom, setMobileCustom] = useState(!!initial?.mobileCustom)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [draftAt, setDraftAt] = useState<number | null>(null) // a recoverable unsaved draft exists (autosave)
  const draftCanvas = useRef<PageCanvas | null>(null)
  const draftKey = `cvdraft:${siteId}:${pageSlug}`
  const canvasRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null) // the scrollable canvas viewport (for fit-to-screen)
  const [lockRatio, setLockRatio] = useState(false) // keep proportions when typing a new width/height
  const dragRef = useRef<Drag>(null)
  // Freehand draw mode: capture pointer strokes over the canvas, then bake them into one
  // 'draw' element (paths normalised to a 0..1000 viewBox).
  const [drawMode, setDrawMode] = useState(false)
  const [drawColor, setDrawColor] = useState('#111111')
  const [drawWidth, setDrawWidth] = useState(6)
  const [drawStrokes, setDrawStrokes] = useState<{ x: number; y: number }[][]>([]) // committed strokes
  const [drawCur, setDrawCur] = useState<{ x: number; y: number }[] | null>(null) // live stroke (mirror of curRef)
  const drawActive = useRef(false)
  const curRef = useRef<{ x: number; y: number }[]>([])
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
  // Ruler guides (editor-only; never rendered on the public page). Refs keep the live
  // pointer-drag snap reading the current values without re-binding the move handler.
  const [guidesX, setGuidesX] = useState<number[]>(initial?.guidesX ?? [])
  const [guidesY, setGuidesY] = useState<number[]>(initial?.guidesY ?? [])
  const [showRulers, setShowRulers] = useState(!!(initial?.guidesX?.length || initial?.guidesY?.length))
  // Global text styles (Heading/Body/…): a text element links via styleRef; editing a
  // style re-syncs every linked element here, so the public renderer never changes.
  const [textStyles, setTextStyles] = useState<Record<string, TextStyleProps>>(initial?.textStyles ?? defaultTextStyles())
  const [styleOpen, setStyleOpen] = useState<TextStyleKey | ''>('') // which global style is being edited in the Design panel
  const [banner, setBanner] = useState<SiteBanner | null>(initial?.banner ?? null) // optional announcement bar above the page
  const [popup, setPopup] = useState<SitePopup | null>(initial?.popup ?? null) // optional one-time modal
  const [critique, setCritique] = useState<DesignCritique | null>(null) // AI design review result
  const [critiquing, setCritiquing] = useState(false)
  const [critiqueErr, setCritiqueErr] = useState('')
  const [brandVoice, setBrandVoice] = useState(initialBrandVoice) // site-wide voice fed to the AI
  const [voiceSaved, setVoiceSaved] = useState(false) // brief tick after a save
  const savedBrandVoice = useRef(initialBrandVoice) // last persisted value, to avoid redundant saves
  const [pageTransition, setPageTransition] = useState<PageTransitionKind>(initialPageTransition) // site-wide enter animation
  const [paletteBusy, setPaletteBusy] = useState(false) // AI palette suggestion in flight
  const [polishBusy, setPolishBusy] = useState('') // tone of an in-flight copy polish, '' when idle
  const guidesXRef = useRef(guidesX)
  guidesXRef.current = guidesX
  const guidesYRef = useRef(guidesY)
  guidesYRef.current = guidesY
  const showRulersRef = useRef(showRulers)
  showRulersRef.current = showRulers
  const gridSnapRef = useRef(showGrid) // grid on ⟹ snap-to-grid (read inside the pointer loop)
  gridSnapRef.current = showGrid
  const gridSizeRef = useRef(gridSize)
  gridSizeRef.current = gridSize
  // Remember the grid preference per browser (loaded after mount so SSR/first paint match).
  useEffect(() => {
    try {
      const sz = Number(localStorage.getItem('cveditor:gridSize'))
      if (GRID_SIZES.includes(sz)) setGridSize(sz)
      if (localStorage.getItem('cveditor:showGrid') === '1') setShowGrid(true)
    } catch {
      /* ignore */
    }
  }, [])
  // History captures elements, palette AND components together so a single action
  // (removing a brand swatch, or deleting a component + its instances) undoes
  // atomically and never strands a token or an orphaned instance.
  type Snap = { els: CanvasElement[]; palette: string[]; components: SiteComponent[] }
  const history = useRef<Snap[]>([])
  const future = useRef<Snap[]>([])
  const clip = useRef<CanvasElement[]>([])
  // Hydrate the copy/paste clipboard from localStorage so it survives switching pages (each
  // page is a full re-mount). Shared across the owner's sites, like the saved-blocks library.
  useEffect(() => { try { const raw = localStorage.getItem('cvclip'); const arr = raw ? JSON.parse(raw) : null; if (Array.isArray(arr)) clip.current = arr } catch { /* ignore */ } }, [])
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
  const patchWH = (w: number, h: number): Partial<CanvasElement> => (editingMobile ? { mw: Math.max(1, Math.round(w)), mh: Math.max(1, Math.round(h)) } : { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }) // floor 1 to match the gate, so hairline lines survive
  const patchX = (x: number): Partial<CanvasElement> => (editingMobile ? { mx: x } : { x })
  const patchY = (y: number): Partial<CanvasElement> => (editingMobile ? { my: y } : { y })
  // Write a DISPLAYED y back into the element's own frame (footer y is band-local on
  // the desktop artboard). Pairs with topOf() so align/distribute work across frames.
  const patchYDisp = (e: CanvasElement, dispY: number): Partial<CanvasElement> => (editingMobile ? { my: Math.round(dispY) } : e.pin === 'footer' ? { y: Math.max(0, Math.round(dispY - bodyBottom)) } : { y: Math.max(0, Math.round(dispY)) })
  const cqv = (px: number) => `${(px / CW) * 100}cqw`
  const brandVars: CSSProperties = {}
  palette.forEach((c, i) => { (brandVars as Record<string, string>)[`--brand-${i}`] = c })
  // Read-only context for rendering component instances inside the editor.
  const renderCtx: RenderCtx = { accent, siteSlug, navPages, pageHref: () => '#', ctaHref: () => '', components, elements: els }

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
  // Typography properties a global text style governs (also what auto-detaches a link).
  const SYNCED_TYPO: (keyof CanvasElement)[] = ['fontSize', 'fontFamily', 'weight', 'italic', 'lineHeight', 'letterSpacing', 'color']
  const update = (id: string, patch: Partial<CanvasElement>) => {
    snapshot()
    setEls(p => p.map(e => {
      if (e.id !== id) return e
      // Hand-editing a style-governed prop unlinks the element (so the change sticks).
      const detach = e.styleRef && !('styleRef' in patch) && SYNCED_TYPO.some(k => k in patch)
      return { ...e, ...patch, ...(detach ? { styleRef: undefined } : {}) }
    }))
    touch()
  }
  // Link a text element to a global style (copies the style's look + sets styleRef).
  const applyStyle = (id: string, key: TextStyleKey) => {
    const s = textStyles[key] || defaultTextStyles()[key]
    update(id, { styleRef: key, fontSize: s.fontSize, fontFamily: s.fontFamily, weight: s.weight, italic: s.italic, lineHeight: s.lineHeight, letterSpacing: s.letterSpacing, color: s.color })
  }
  // Edit a global style and re-sync every element linked to it (the "set once" magic).
  const editStyle = (key: TextStyleKey, patch: Partial<TextStyleProps>) => {
    snapshot(true)
    const next = { ...(textStyles[key] || defaultTextStyles()[key]), ...patch }
    setTextStyles(prev => ({ ...prev, [key]: next }))
    setEls(prev => prev.map(e => (e.styleRef === key ? { ...e, fontSize: next.fontSize, fontFamily: next.fontFamily, weight: next.weight, italic: next.italic, lineHeight: next.lineHeight, letterSpacing: next.letterSpacing, color: next.color } : e)))
    touch()
  }
  const remove = (id: string) => { snapshot(true); setEls(p => p.filter(e => e.id !== id).map(e => { const e2 = e.anchorTo === id ? { ...e, anchorTo: undefined } : e; return e2.parentId === id ? { ...e2, parentId: undefined } : e2 })); setSelectedIds([]); touch() }
  const layer = (id: string, dir: 1 | -1) => {
    snapshot(true)
    setEls(p => {
      const sorted = [...p].sort((a, b) => (a.z ?? 0) - (b.z ?? 0))
      return p.map(e => (e.id === id ? { ...e, z: (e.z ?? 0) + dir * (sorted.length + 1) } : e))
    })
    touch()
  }
  // Bring/send a whole set forward/back in ONE undo step (right-click menu on a multi-selection).
  const layerMany = (ids: string[], dir: 1 | -1) => {
    const set = new Set(ids)
    snapshot(true)
    setEls(p => {
      const n = p.length + 1
      return p.map(e => (set.has(e.id) ? { ...e, z: (e.z ?? 0) + dir * n } : e))
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
  const STYLE_KEYS: (keyof CanvasElement)[] = ['color', 'fontSize', 'fontFamily', 'bold', 'weight', 'italic', 'align', 'letterSpacing', 'lineHeight', 'dropCap', 'fill', 'gradient', 'radius', 'borderColor', 'borderWidth', 'shadow', 'blend', 'opacity', 'reveal', 'revealDelay', 'hover', 'parallax', 'cursor', 'adjust', 'lightbox']
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
  // --- Flow Groups (layout engine): wrap a selection into a real 'group' element whose
  // children flow with flex. Distinct from groupSelected above (that only sets a groupId so a
  // selection moves together while staying absolute). ---
  const makeFlowGroup = () => {
    const set = new Set(selectedIds)
    // Eligible = selected, not locked, not a component, not already a group, and not parented.
    const kids = elsRef.current.filter(e => set.has(e.id) && !e.locked && e.type !== 'component' && e.type !== 'group' && !e.parentId)
    if (kids.length < 2) return
    // Bounding box over the eligible children (device-aware coords).
    const minX = Math.min(...kids.map(e => gx(e)))
    const minY = Math.min(...kids.map(e => gy(e)))
    const maxX = Math.max(...kids.map(e => gx(e) + gw(e)))
    const maxY = Math.max(...kids.map(e => gy(e) + gh(e)))
    const bw = maxX - minX, bh = maxY - minY
    const dir: 'row' | 'col' = bw >= bh ? 'row' : 'col'
    // Flow order = children sorted along the main axis (also how they sit in the array).
    const ordered = [...kids].sort((a, b) => (dir === 'row' ? gx(a) - gx(b) : gy(a) - gy(b)))
    // Average POSITIVE gap between consecutive children along the main axis (clamp 0..200).
    const gaps: number[] = []
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1], cur = ordered[i]
      const g = dir === 'row' ? gx(cur) - (gx(prev) + gw(prev)) : gy(cur) - (gy(prev) + gh(prev))
      if (g > 0) gaps.push(g)
    }
    const gap = gaps.length ? Math.max(0, Math.min(200, Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length))) : 16
    const maxZ = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const group: CanvasElement = {
      id: 'e' + idc.current++,
      type: 'group',
      x: Math.round(minX), y: Math.round(minY), w: Math.round(bw), h: Math.round(bh),
      z: maxZ + 1,
      opacity: 100,
      flow: { dir, gap, padX: 0, padY: 0, align: 'start', justify: 'start' },
    }
    // Give the group sensible phone coords too, so it sits on-screen in a custom phone layout.
    if (mobileCustom) { group.mx = Math.round(minX); group.my = Math.round(minY); group.mw = Math.round(bw); group.mh = Math.round(bh) }
    const kidIds = new Set(ordered.map(e => e.id))
    snapshot(true)
    setEls(p => {
      // Pull the eligible children out, parent them, and lay them back into the array in flow
      // order, contiguous, right after the group element (flowChildren reads array order).
      const rest = p.filter(e => !kidIds.has(e.id))
      const parented = ordered.map(e => ({ ...e, parentId: group.id }))
      return [...rest, group, ...parented]
    })
    setSelectedIds([group.id])
    touch()
  }
  const unwrapFlowGroup = (groupId: string) => {
    const freed = elsRef.current.filter(e => e.parentId === groupId).map(e => e.id)
    snapshot(true)
    setEls(p => p.filter(e => e.id !== groupId).map(e => (e.parentId === groupId ? { ...e, parentId: undefined } : e)))
    setSelectedIds(freed)
    touch()
  }
  // Take one child out of its flow group (back to absolute at its stored x/y).
  const removeFromGroup = (childId: string) => { snapshot(true); setEls(p => p.map(e => (e.id === childId ? { ...e, parentId: undefined } : e))); touch() }
  // Reorder a child within its group by swapping it with the adjacent sibling (array order = flow order).
  const moveChildInGroup = (childId: string, dir: -1 | 1) => {
    const cur = elsRef.current
    const child = cur.find(e => e.id === childId)
    if (!child?.parentId) return
    const sibs = cur.filter(e => e.parentId === child.parentId)
    const swapWith = sibs[sibs.findIndex(e => e.id === childId) + dir]
    if (!swapWith) return // already at the start/end
    snapshot(true)
    setEls(p => {
      const arr = [...p]
      const i = arr.findIndex(e => e.id === childId)
      const j = arr.findIndex(e => e.id === swapWith.id)
      ;[arr[i], arr[j]] = [arr[j], arr[i]]
      return arr
    })
    touch()
  }
  // --- Copy / paste (shared by the keyboard shortcuts and the right-click menu) ---
  const copySelection = (ids: string[]) => { const set = new Set(ids); elsRef.current.forEach(e => { if (e.parentId && set.has(e.parentId)) set.add(e.id) }); clip.current = elsRef.current.filter(x => set.has(x.id)); try { localStorage.setItem('cvclip', JSON.stringify(clip.current)) } catch { /* too big / unavailable — same-page paste still works via the ref */ } }
  const pasteClipboard = () => {
    if (!clip.current.length) return
    snapshot(true)
    let z = elsRef.current.reduce((m, x) => Math.max(m, x.z ?? 0), 0)
    const gmap = new Map<string, string>()
    // old id → new id, so a copied child's parentId can be re-pointed at its copied group.
    const idmap = new Map<string, string>()
    const copies = clip.current.map(s => {
      let gid = s.groupId
      if (gid) { let ng = gmap.get(gid); if (!ng) { ng = 'g' + Math.random().toString(36).slice(2, 8); gmap.set(gid, ng) } gid = ng }
      const nid = 'e' + idc.current++
      idmap.set(s.id, nid)
      return { ...s, id: nid, z: ++z, groupId: gid, ...patchXY(gx(s) + 20, gy(s) + 20) }
    })
    // Rewrite parentId to the copied group's new id; drop it if the group wasn't copied too.
    for (const c of copies) if (c.parentId) c.parentId = idmap.get(c.parentId)
    setEls(p => [...p, ...copies])
    setSelectedIds(copies.map(c => c.id))
    touch()
  }

  // --- Saved blocks: a per-browser library of reusable element groups (localStorage,
  // shared across all the owner's sites). Inserting drops independent copies, like paste. ---
  type SavedBlock = { id: string; name: string; els: CanvasElement[] }
  const [blocks, setBlocks] = useState<SavedBlock[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cveditor:blocks')
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) setBlocks(arr.filter((b: SavedBlock) => b && typeof b.name === 'string' && Array.isArray(b.els) && b.els.length).slice(0, 40))
      }
    } catch {
      /* ignore */
    }
  }, [])
  const persistBlocks = (next: SavedBlock[]) => {
    setBlocks(next)
    try {
      localStorage.setItem('cveditor:blocks', JSON.stringify(next))
    } catch {
      alert('Couldn’t save the block — the library is full (large images use up space). Delete a block and try again.')
    }
  }
  const saveAsBlock = (ids: string[]) => {
    const set = new Set(ids)
    // Deep-clone so the stored block is a fully independent snapshot (no shared nested arrays).
    const els = elsRef.current.filter(x => set.has(x.id)).map(e => JSON.parse(JSON.stringify(e)) as CanvasElement)
    if (!els.length) return
    const name = typeof window !== 'undefined' ? window.prompt('Name this block', `Block ${blocks.length + 1}`) : `Block ${blocks.length + 1}`
    if (name === null) return // cancelled
    persistBlocks([{ id: 'b' + idc.current++, name: (name.trim() || `Block ${blocks.length + 1}`).slice(0, 40), els }, ...blocks].slice(0, 40))
  }
  const insertBlock = (block: SavedBlock) => {
    if (!block.els.length) return
    snapshot(true)
    let z = elsRef.current.reduce((m, x) => Math.max(m, x.z ?? 0), 0)
    const gmap = new Map<string, string>()
    // old id → new id, so a child block element re-points its parentId at its copied group.
    const idmap = new Map<string, string>()
    const copies = block.els.map(orig => {
      // Deep-clone so an inserted instance can never mutate the stored block.
      const s = JSON.parse(JSON.stringify(orig)) as CanvasElement
      let gid = s.groupId
      if (gid) { let ng = gmap.get(gid); if (!ng) { ng = 'g' + Math.random().toString(36).slice(2, 8); gmap.set(gid, ng) } gid = ng }
      const nid = 'e' + idc.current++
      idmap.set(s.id, nid)
      return { ...s, id: nid, z: ++z, groupId: gid, ...patchXY(gx(s) + 20, gy(s) + 20) }
    })
    // Rewrite parentId to the copied group's new id; drop it if the group wasn't in the block.
    for (const c of copies) if (c.parentId) c.parentId = idmap.get(c.parentId)
    setEls(p => [...p, ...copies])
    setSelectedIds(copies.map(c => c.id))
    touch()
  }
  const deleteBlock = (bid: string) => persistBlocks(blocks.filter(b => b.id !== bid))

  // --- Multi-selection group operations ---
  const removeMany = (ids: string[]) => {
    const set = new Set(elsRef.current.filter(e => ids.includes(e.id) && !e.locked).map(e => e.id))
    if (!set.size) return
    snapshot(true)
    // Deleting a flow group frees its children back to absolute (clear parentId) rather than
    // orphaning them (an orphan parentId would vanish from the editor until the next save).
    setEls(p => p.filter(e => !set.has(e.id)).map(e => { const e2 = e.anchorTo && set.has(e.anchorTo) ? { ...e, anchorTo: undefined } : e; return e2.parentId && set.has(e2.parentId) ? { ...e2, parentId: undefined } : e2 }))
    setSelectedIds([])
    touch()
  }
  const duplicateMany = (ids: string[]) => {
    const set = new Set(ids)
    // Pull in any flow-group's children so a duplicated group is a complete deep copy (not empty).
    elsRef.current.forEach(e => { if (e.parentId && set.has(e.parentId)) set.add(e.id) })
    const src = elsRef.current.filter(e => set.has(e.id))
    if (!src.length) return
    snapshot(true)
    let z = elsRef.current.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    // Re-id any shared group so the duplicated set is its own group, not merged with the original.
    const gmap = new Map<string, string>()
    // old id → new id, so a duplicated child re-points its parentId at its duplicated group.
    const idmap = new Map<string, string>()
    const copies = src.map(e => {
      let gid = e.groupId
      if (gid) { let ng = gmap.get(gid); if (!ng) { ng = 'g' + Math.random().toString(36).slice(2, 8); gmap.set(gid, ng) } gid = ng }
      const nid = 'e' + idc.current++
      idmap.set(e.id, nid)
      return { ...e, id: nid, z: ++z, groupId: gid, ...patchXY(gx(e) + 16, gy(e) + 16) }
    })
    // Rewrite parentId to the duplicated group's new id; drop it if the group wasn't duplicated.
    for (const c of copies) if (c.parentId) c.parentId = idmap.get(c.parentId)
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

  // AI arrange-for-phone: Claude decides order/emphasis/hide per element; the editor lays
  // them out as a clean single-column stack (positions computed here, so no overlap/overflow).
  const [mobileBusy, setMobileBusy] = useState(false)
  const aiArrangeMobile = async () => {
    if (mobileBusy) return
    const visible = elsRef.current.filter(e => !e.hidden)
    if (!visible.length) { alert('Add some elements first.'); return }
    setMobileBusy(true)
    try {
      const res = await mobileLayoutAction({ siteId, items: visible.map(e => ({ id: e.id, type: e.type, text: (e.text || '').replace(/\s+/g, ' ').slice(0, 80), w: Math.round(e.w), h: Math.round(e.h) })) })
      if ('items' in res && res.items.length) {
        const hint = new Map(res.items.map(it => [it.id, it]))
        snapshot(true)
        const margin = 20, gap = 18
        const normalW = MOBILE_W - margin * 2
        const smallW = Math.round(normalW * 0.62)
        const ordered = [...visible].sort((a, b) => {
          const oa = hint.get(a.id)?.order ?? 9999, ob = hint.get(b.id)?.order ?? 9999
          return oa - ob || (a.pin === 'footer' ? 1 : 0) - (b.pin === 'footer' ? 1 : 0) || a.y - b.y
        })
        let y = 40
        const m = new Map<string, Partial<CanvasElement>>()
        for (const e of ordered) {
          const h = hint.get(e.id)
          if (h?.hide) { m.set(e.id, { mHidden: true }); continue }
          const isBand = e.w >= CANVAS_W * 0.8
          const mw = h?.emphasis === 'full' || isBand ? MOBILE_W : h?.emphasis === 'small' ? smallW : normalW
          const mh = Math.max(20, Math.round(e.h * (mw / Math.max(1, e.w))))
          const mx = mw >= MOBILE_W ? 0 : Math.round((MOBILE_W - mw) / 2)
          m.set(e.id, { mx, my: y, mw, mh, mHidden: undefined })
          y += mh + gap
        }
        setEls(p => p.map(e => (m.has(e.id) ? { ...e, ...m.get(e.id) } : e)))
        setMobileCustom(true)
        setDevice('mobile')
        touch()
      } else {
        alert('Couldn’t arrange for phone — please try again.')
      }
    } catch {
      alert('Couldn’t arrange for phone — please try again.')
    } finally {
      setMobileBusy(false)
    }
  }

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
    form: { type: 'form', w: 360, h: 360, text: 'Send message', fill: '#111111', color: '#1a1612', radius: 10, fontFamily: 'body' },
    embed: { type: 'embed', w: 480, h: 270, radius: 6 },
    image: { type: 'image', w: 380, h: 260, fit: 'cover', radius: 0 },
    carousel: { type: 'carousel', w: 480, h: 320, fit: 'cover', radius: 0, interval: 4, slides: [] },
    menu: { type: 'menu', w: 600, h: 44, fontSize: 16, fontFamily: 'label', color: '#111111', align: 'left' },
    box: { type: 'box', w: 340, h: 220, fill: '#eaeaea', radius: 10 },
    line: { type: 'box', x: 0, w: CANVAS_W, h: 3, fill: '#111111', radius: 0 },
    section: { type: 'box', x: 0, y: 80, w: CANVAS_W, h: 240, fill: '#f3f3f1', radius: 0 },
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
  // Drop a hand-designed starter layout onto the canvas (undoable; keeps brand/uploads).
  const applyTemplate = (tpl: CanvasTemplate) => {
    if (els.length && !confirm('Start from this template? It replaces what’s on the canvas now (you can undo).')) return
    const c = tpl.build(accent)
    snapshot(true)
    setEls(c.elements.map(e => ({ ...e, id: 'e' + idc.current++ })))
    setBg(c.bg || '#ffffff')
    setBgGrad(c.bgGradient || null)
    setBgImage(c.bgImage || '')
    setPageWidth(c.width === 'contained' ? 'contained' : 'full')
    if (c.fontSystem) setFontSys(c.fontSystem)
    setSelectedIds([])
    setEditingId('')
    setShowTemplates(false)
    touch()
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

  // Ask Claude to describe the selected image and drop the result into its alt text.
  const suggestAlt = async (id: string) => {
    if (altBusy) return
    const el = elsRef.current.find(e => e.id === id)
    if (!el || !el.src) return
    setAltBusy(true)
    try {
      const res = await suggestAltAction(el.src)
      if (res.alt) { snapshot(true); setEls(p => p.map(e => (e.id === id ? { ...e, alt: res.alt } : e))); touch() }
      else if (res.error === 'failed') alert('Couldn’t suggest alt text for this image — please write a short description.')
    } finally {
      setAltBusy(false)
    }
  }

  // Write AI alt text for every image that's missing it (sequential, capped, undoable).
  const [altAllBusy, setAltAllBusy] = useState(false)
  const fillAllAlt = async () => {
    if (altAllBusy) return
    const targets = elsRef.current.filter(e => e.type === 'image' && e.src && !(e.alt || '').trim()).slice(0, 8)
    if (!targets.length) { alert('Every image already has alt text ✓'); return }
    setAltAllBusy(true)
    snapshot(true)
    let done = 0
    try {
      for (const e of targets) {
        try {
          const res = await suggestAltAction(e.src as string)
          if (res.alt) { setEls(p => p.map(x => (x.id === e.id ? { ...x, alt: res.alt } : x))); done += 1 }
        } catch {
          /* skip this one, keep going */
        }
      }
    } finally {
      setAltAllBusy(false)
      if (done) touch()
    }
    if (!done) alert('Couldn’t generate alt text right now — please try again.')
  }

  // Build a compact, blob-free text description of the page for the AI design review.
  const buildDesignSummary = (): string => {
    const lines: string[] = []
    const visible = els.filter(e => !e.hidden)
    lines.push(`Page background: ${bgImage ? 'a background image' : bgGrad ? 'a gradient' : bg}. Content width: ${pageWidth === 'contained' ? 'contained / centered' : 'full-bleed'}.`)
    if (palette.length) lines.push(`Brand palette: ${palette.join(', ')}.`)
    if (banner?.text) lines.push(`A dismissible announcement bar reads: "${banner.text.replace(/\s+/g, ' ').slice(0, 120)}".`)
    if (popup?.text) lines.push(`A popup (after ${popup.delay ?? 2}s) says: "${[popup.title, popup.text].filter(Boolean).join(' — ').replace(/\s+/g, ' ').slice(0, 160)}".`)
    lines.push(`Mobile layout: ${mobileCustom ? 'hand-tuned for phones' : 'automatic top-to-bottom stack'}.`)
    lines.push('')
    lines.push(`${visible.length} element(s) on the canvas (top to bottom):`)
    visible
      .slice()
      .sort((a, b) => a.y - b.y)
      .slice(0, 40)
      .forEach(el => {
        const p: string[] = [`• [${el.id}] ${el.type}`]
        if ((el.type === 'text' || el.type === 'button') && el.text) p.push(`"${el.text.replace(/\s+/g, ' ').slice(0, 100)}"`)
        if (el.fontSize) p.push(`${el.fontSize}px`)
        if (el.weight) p.push(`weight ${el.weight}`)
        else if (el.bold) p.push('bold')
        if (el.color) p.push(`text ${el.color}`)
        if (el.fill) p.push(`fill ${el.fill}`)
        if (el.type === 'image') p.push(el.alt ? `alt "${el.alt.slice(0, 60)}"` : 'NO alt text')
        p.push(`— at (${Math.round(el.x)},${Math.round(el.y)}), ${Math.round(el.w)}×${Math.round(el.h)}px`)
        lines.push(p.join(' '))
      })
    if (visible.length > 40) lines.push(`…and ${visible.length - 40} more.`)
    return lines.join('\n')
  }

  // The "design pair": ask Claude for a warm, prioritized review of the current page.
  const reviewDesign = async () => {
    if (critiquing) return
    if (els.filter(e => !e.hidden).length < 2) { setCritiqueErr('Add a few elements first, then ask for a review.'); setCritique(null); return }
    setCritiquing(true)
    setCritiqueErr('')
    setCritique(null)
    try {
      const res = await critiqueDesignAction({ siteId, summary: buildDesignSummary() })
      if ('error' in res) setCritiqueErr(res.error === 'empty' ? 'Add a few elements first, then ask for a review.' : 'Couldn’t reach the reviewer — please try again.')
      else setCritique(res)
    } catch {
      setCritiqueErr('Couldn’t reach the reviewer — please try again.')
    } finally {
      setCritiquing(false)
    }
  }

  // Apply the review's concrete suggestions in one click (undoable). Each edit only sets
  // whitelisted style fields validated server-side; unknown ids and locked elements are skipped.
  const applyCritique = () => {
    const edits = critique?.edits
    if (!edits || !edits.length) return
    const map = new Map(edits.map(ed => [ed.targetId, ed.set]))
    const willHit = elsRef.current.some(e => map.has(e.id) && !e.locked)
    if (!willHit) { setCritique(c => (c ? { ...c, edits: [] } : c)); return }
    snapshot(true)
    setEls(p => p.map(e => (map.has(e.id) && !e.locked ? { ...e, ...map.get(e.id)! } : e)))
    touch()
    setCritique(c => (c ? { ...c, edits: [] } : c)) // applied → hide the button (Ctrl+Z to revert)
  }

  // Persist the site-wide brand voice (on blur). Skips a no-op save and shows a brief tick.
  const saveBrandVoice = async () => {
    const v = brandVoice.trim()
    if (v === savedBrandVoice.current.trim()) return
    const res = await setBrandVoiceAction(siteId, v)
    if (res.ok) {
      savedBrandVoice.current = v
      setVoiceSaved(true)
      setTimeout(() => setVoiceSaved(false), 1800)
    }
  }

  // Rewrite every text/button's copy in a chosen tone, in one batched call (undoable).
  const polishCopy = async (tone: string) => {
    if (polishBusy) return
    const items = elsRef.current.filter(e => (e.type === 'text' || e.type === 'button') && (e.text || '').trim()).map(e => ({ id: e.id, text: e.text as string }))
    if (!items.length) { alert('Add some text to the page first.'); return }
    setPolishBusy(tone)
    try {
      const res = await polishCopyAction({ siteId, tone, items })
      if ('items' in res && res.items.length) {
        const map = new Map(res.items.map(it => [it.id, it.text]))
        snapshot(true)
        setEls(p => p.map(e => (map.has(e.id) ? { ...e, text: map.get(e.id) as string } : e)))
        touch()
      } else {
        alert('Couldn’t polish the copy — please try again.')
      }
    } catch {
      alert('Couldn’t polish the copy — please try again.')
    } finally {
      setPolishBusy('')
    }
  }

  // Ask Claude for a cohesive brand palette and drop it into the swatches (undoable).
  const suggestPalette = async () => {
    if (paletteBusy) return
    setPaletteBusy(true)
    try {
      const res = await suggestPaletteAction(siteId)
      if ('colors' in res && res.colors.length) { snapshot(true); setPalette(res.colors.slice(0, MAX_PALETTE)); touch() }
      else alert('Couldn’t suggest a palette — please try again.')
    } catch {
      alert('Couldn’t suggest a palette — please try again.')
    } finally {
      setPaletteBusy(false)
    }
  }

  // Set the site-wide page-transition style (fire-and-forget; it's a site-level setting,
  // separate from the per-page canvas save).
  const changePageTransition = (kind: PageTransitionKind) => {
    setPageTransition(kind)
    void setPageTransitionAction(siteId, kind)
  }

  // One-click "motion personality": cascade coherent reveal + hover + stagger onto the
  // content elements (in top-to-bottom order), or clear all motion with 'none'.
  const applyMood = (mood: 'calm' | 'playful' | 'energetic' | 'none') => {
    snapshot(true)
    const CONTENT = ['text', 'button', 'image', 'carousel', 'icon', 'form', 'embed']
    const order = els.filter(e => CONTENT.includes(e.type)).slice().sort((a, b) => a.y - b.y).map(e => e.id)
    setEls(prev => prev.map((e): CanvasElement => {
      if (mood === 'none') return { ...e, reveal: undefined, revealDelay: undefined, hover: undefined }
      if (!CONTENT.includes(e.type)) return e
      const idx = Math.max(0, order.indexOf(e.id))
      const tappable = e.type === 'button' || e.type === 'image' || e.type === 'icon'
      if (mood === 'calm') return { ...e, reveal: 'fade', revealDelay: Math.min(idx * 120, 1000) || undefined, hover: undefined }
      if (mood === 'playful') return { ...e, reveal: idx % 2 ? 'up' : 'zoom', revealDelay: Math.min(idx * 90, 900) || undefined, hover: tappable ? 'grow' : undefined }
      return { ...e, reveal: 'up', revealDelay: Math.min(idx * 60, 700) || undefined, hover: tappable ? 'lift' : undefined }
    }))
    touch()
  }

  // Add a ruler guide (deduped, in range, capped). axis 'x' = vertical line, 'y' = horizontal.
  const addGuide = (axis: 'x' | 'y', pos: number) => {
    const max = axis === 'x' ? CANVAS_W : Math.min(desktopH, 40000) // 40000 = the gate's guidesY cap
    const p = Math.max(0, Math.min(max, Math.round(pos)))
    const setter = axis === 'x' ? setGuidesX : setGuidesY
    setter(prev => (prev.length >= 24 || prev.some(g => Math.abs(g - p) < 2) ? prev : [...prev, p].sort((a, b) => a - b)))
    touch()
  }
  const removeGuide = (axis: 'x' | 'y', i: number) => {
    ;(axis === 'x' ? setGuidesX : setGuidesY)(prev => prev.filter((_, j) => j !== i))
    touch()
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
        // Edge handles change one axis only ('e' = width, 's' = height); the corner ('se') does both.
        const useW = d.dir !== 's'
        const useH = d.dir !== 'e'
        let nw = useW ? Math.max(24, Math.round(d.w + dx)) : d.w
        let nh = useH ? Math.max(20, Math.round(d.h + dy)) : d.h
        // Hold Shift on the CORNER to keep proportions; otherwise snap the moving axes to the grid.
        if (e.shiftKey && d.ar > 0 && d.dir === 'se') { nh = Math.max(20, Math.round(nw / d.ar)) }
        else if (gridSnapRef.current) { const g = gridSizeRef.current; if (useW) nw = Math.max(24, Math.round(nw / g) * g); if (useH) nh = Math.max(20, Math.round(nh / g) * g) }
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
          if (gridSnapRef.current) {
            // Snap-to-grid replaces edge/guide snapping while the grid is on.
            const g = gridSizeRef.current
            nx = Math.round(nx / g) * g
            ny = Math.max(0, Math.round(ny / g) * g)
          } else {
            const allOthers = elsRef.current.filter(el => el.id !== s0.id)
            const T = 8
            // X-snap is universal — x is one shared frame for body and footer elements.
            const vlines = [W / 2, ...(!d.m && showRulersRef.current ? guidesXRef.current : []), ...allOthers.flatMap(el => [ax(el), ax(el) + aw(el) / 2, ax(el) + aw(el)])]
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
              const hlines = [...(!d.m && showRulersRef.current ? guidesYRef.current : []), ...yOthers.flatMap(el => [ay(el), ay(el) + ah(el) / 2, ay(el) + ah(el)])]
              const mys = [ny, ny + ah(me) / 2, ny + ah(me)]
              for (const line of hlines) {
                const hit = mys.findIndex(m => Math.abs(m - line) <= T)
                if (hit >= 0) { ny = Math.max(0, ny + line - mys[hit]); gyLine = line; break }
              }
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
        if (gridSnapRef.current) {
          // Align the group's top-left corner to the grid; the group keeps its shape.
          const g = gridSizeRef.current
          sdx = Math.round((gMinX + dx) / g) * g - gMinX
          sdy = Math.round((gMinY + dy) / g) * g - gMinY
        } else {
          const others = elsRef.current.filter(e => !selSet.has(e.id))
          const oy = (e: CanvasElement) => (e.pin === 'footer' && !d.m ? bb + ay(e) : ay(e))
          const vlines = [W / 2, ...(!d.m && showRulersRef.current ? guidesXRef.current : []), ...others.flatMap(e => [ax(e), ax(e) + aw(e) / 2, ax(e) + aw(e)])]
          const gxs = [gMinX + dx, (gMinX + gMaxX) / 2 + dx, gMaxX + dx]
          for (const line of vlines) { const hit = gxs.findIndex(m => Math.abs(m - line) <= T); if (hit >= 0) { sdx = dx + (line - gxs[hit]); gxLine = line; break } }
          const hlines = [...(!d.m && showRulersRef.current ? guidesYRef.current : []), ...others.flatMap(e => [oy(e), oy(e) + ah(e) / 2, oy(e) + ah(e)])]
          const gys = [gMinY + dy, (gMinY + gMaxY) / 2 + dy, gMaxY + dy]
          for (const line of hlines) { const hit = gys.findIndex(m => Math.abs(m - line) <= T); if (hit >= 0) { sdy = dy + (line - gys[hit]); gyLine = line; break } }
        }
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
      if (drawMode) { if (e.key === 'Escape') exitDraw(); return } // draw mode owns the keyboard; use the toolbar for undo/done
      if (showShortcuts) { if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); setShowShortcuts(false) } return }
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(true); return } // open the cheatsheet
      if (e.key === 'Escape') setCtxMenu(null)
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
      if (mod && !e.shiftKey && k === 'c' && selectedIds.length) { e.preventDefault(); copySelection(selectedIds); return }
      if (mod && !e.shiftKey && k === 'v' && clip.current.length) { e.preventDefault(); pasteClipboard(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) { e.preventDefault(); removeMany(selectedIds); return }
      if (selectedIds.length && e.key.startsWith('Arrow')) {
        e.preventDefault()
        // With the grid on, arrows step by one cell and land on the grid; otherwise 1px (10 with Shift).
        const g = gridSnapRef.current ? gridSizeRef.current : 0
        const s = g || (e.shiftKey ? 10 : 1)
        const dx = e.key === 'ArrowLeft' ? -s : e.key === 'ArrowRight' ? s : 0
        const dy = e.key === 'ArrowUp' ? -s : e.key === 'ArrowDown' ? s : 0
        snapshot()
        const set = new Set(selectedIds)
        setEls(p => p.map(el => {
          if (!(set.has(el.id) && !el.locked)) return el
          let nx = gx(el) + dx, ny = Math.max(0, gy(el) + dy)
          if (g) { nx = Math.round(nx / g) * g; ny = Math.max(0, Math.round(ny / g) * g) }
          return { ...el, ...patchXY(nx, ny) }
        }))
        touch()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds, editingMobile, drawMode, showShortcuts])

  // Draft recovery: on open, offer to restore an autosaved draft that differs from
  // what loaded (i.e. the last session didn't get saved — a crash or navigation away).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return
      const d = JSON.parse(raw)
      // Compare the WHOLE canvas (not just elements) against the saved state, normalised the
      // same way both sides serialise, so unsaved background/palette/banner/popup/font/guide
      // edits also trigger the recovery prompt instead of being silently discarded.
      const sig = (c: PageCanvas | null | undefined) => JSON.stringify([
        c?.elements || [], c?.bg || '', c?.bgGradient || null, c?.bgImage || '', c?.bgVideo || '', c?.bgOpacity ?? 100,
        c?.width === 'contained' ? 'contained' : 'full', c?.palette || [], c?.fonts || [], c?.components || [], c?.uploads || [],
        c?.fontSystem || '', c?.guidesX || [], c?.guidesY || [], c?.textStyles || null, c?.banner || null, c?.popup || null,
        !!c?.mobileCustom, c?.mobileCustom ? (c?.mobileH || 0) : 0,
      ])
      if (d?.canvas && sig(d.canvas) !== sig(initial)) {
        draftCanvas.current = d.canvas
        setDraftAt(typeof d.ts === 'number' ? d.ts : Date.now())
      } else {
        localStorage.removeItem(draftKey)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Autosave the working draft to localStorage (debounced) so a crash or accidental
  // navigation never loses work. This does NOT publish — only the Save button does.
  useEffect(() => {
    if (!dirty.current) return
    if (draftAt) return // a recovery draft is pending — don't overwrite it until the owner restores/discards
    const t = setTimeout(() => {
      try {
        const payload = JSON.stringify({ ts: Date.now(), canvas: buildCanvas() })
        if (payload.length < 3_000_000) localStorage.setItem(draftKey, payload) // stay under the localStorage quota
      } catch { /* full / over quota — the manual Save still works */ }
    }, 1500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [els, bg, bgGrad, bgImage, bgVideo, bgOpacity, pageWidth, mobileCustom, mobileH, palette, fonts, components, uploads, fontSys, guidesX, guidesY, textStyles, banner, popup])

  // Continuous SERVER auto-save (debounced) so the owner never has to press Save and
  // switching pages can't lose work. Backs off quietly on the same guards save() would
  // hit (mid component-edit, >80 els) so it never pops an error while editing.
  useEffect(() => {
    if (!dirty.current) return
    if (draftAt) return // a recovery draft is pending — never auto-save over / clear it before the owner restores
    if (editingComp || elsRef.current.length > 80) return
    const t = setTimeout(() => { void save(true) }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [els, bg, bgGrad, bgImage, bgVideo, bgOpacity, pageWidth, mobileCustom, mobileH, palette, fonts, components, uploads, fontSys, guidesX, guidesY, textStyles, banner, popup])

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

  const startDrag = (e: RPointerEvent, el: CanvasElement, mode: 'move' | 'resize', dir: 'se' | 'e' | 's' = 'se') => {
    e.stopPropagation()
    e.preventDefault()
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const scale = rect.width / CW
    if (mode === 'resize') {
      setSelectedIds([el.id])
      snapshot(true)
      dragRef.current = { kind: 'resize', id: el.id, px: e.clientX, py: e.clientY, scale, m: editingMobile, w: gw(el), h: gh(el), ar: gh(el) > 0 ? gw(el) / gh(el) : 1, dir }
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
  // --- Freehand draw mode ----------------------------------------------------------------
  const drawPt = (e: RPointerEvent): { x: number; y: number } | null => {
    const r = canvasRef.current?.getBoundingClientRect()
    if (!r) return null
    // Clamp to the canvas so a stray drag past the edge (pointer capture keeps firing) can't
    // push the baked box off-canvas out of sync with its paths.
    const x = ((e.clientX - r.left) / r.width) * CW
    const y = ((e.clientY - r.top) / r.height) * CH
    return { x: Math.max(0, Math.min(CW, x)), y: Math.max(0, Math.min(CH, y)) }
  }
  const drawDown = (e: RPointerEvent) => {
    const p = drawPt(e)
    if (!p) return
    e.preventDefault()
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId) } catch { /* not all browsers */ }
    drawActive.current = true
    curRef.current = [p]
    setDrawCur([p])
  }
  const drawMove = (e: RPointerEvent) => {
    if (!drawActive.current) return
    if (curRef.current.length >= 1200) return // keep one stroke comfortably under the gate's per-path cap
    const p = drawPt(e)
    if (!p) return
    // Decimate: skip points within ~2px of the last so a long stroke stays compact (and well
    // under the gate's per-path char cap) while still reading as smooth.
    const last = curRef.current[curRef.current.length - 1]
    if (last && Math.abs(p.x - last.x) < 2 && Math.abs(p.y - last.y) < 2) return
    curRef.current = [...curRef.current, p]
    setDrawCur(curRef.current)
  }
  const drawEnd = () => {
    if (!drawActive.current) return
    drawActive.current = false
    if (curRef.current.length > 1) { const s = curRef.current; setDrawStrokes(prev => [...prev, s]) }
    curRef.current = []
    setDrawCur(null)
  }
  const exitDraw = () => { setDrawMode(false); setDrawStrokes([]); setDrawCur(null); drawActive.current = false; curRef.current = [] }
  const undoStroke = () => setDrawStrokes(prev => prev.slice(0, -1))
  // Bake the captured strokes into one 'draw' element (paths normalised to a 0..1000 box).
  const finishDraw = () => {
    const all = drawStrokes.filter(s => s.length > 1)
    if (!all.length) { exitDraw(); return }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    all.forEach(s => s.forEach(p => { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }))
    const pad = drawWidth // leave room so stroke width isn't clipped at the box edge
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    const w = Math.max(8, maxX - minX), h = Math.max(8, maxY - minY)
    const paths = all.map(s => 'M' + s.map(p => `${(((p.x - minX) / w) * 1000).toFixed(1)} ${(((p.y - minY) / h) * 1000).toFixed(1)}`).join(' L'))
    snapshot(true)
    const maxZ = els.reduce((m, e) => Math.max(m, e.z ?? 0), 0)
    const R = MOBILE_W / CANVAS_W
    // Captured coords are in whichever device's design space we're editing; store canonical
    // desktop x/y/w/h plus phone m* so the drawing lands right on both.
    const box = editingMobile
      ? { x: Math.round(minX / R), y: Math.round(minY / R), w: Math.round(w / R), h: Math.round(h / R), mx: Math.round(minX), my: Math.round(minY), mw: Math.round(w), mh: Math.round(h) }
      : { x: Math.round(minX), y: Math.round(minY), w: Math.round(w), h: Math.round(h), ...(mobileCustom ? { mx: Math.round(minX * R), my: Math.round(minY * R), mw: Math.round(w * R), mh: Math.round(h * R) } : {}) }
    const el: CanvasElement = { id: 'e' + idc.current++, type: 'draw', z: maxZ + 1, opacity: 100, paths, color: drawColor, strokeW: drawWidth, ...box }
    setEls(p => [...p, el])
    setSelectedIds([el.id])
    touch()
    exitDraw()
  }
  // Draw mode needs the live editable canvas. Switching device or phone-layout mode can
  // unmount it (the auto-phone view is read-only) while the portaled toolbar floats on — so
  // leave draw mode whenever that happens, discarding any in-progress strokes.
  useEffect(() => { if (drawMode) exitDraw() }, [device, mobileCustom]) // eslint-disable-line react-hooks/exhaustive-deps
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

  // The current page assembled into a PageCanvas (used by Save + the draft autosave).
  const buildCanvas = (): PageCanvas => ({
    h: desktopH,
    width: pageWidth === 'contained' ? 'contained' : undefined,
    bg: bg.trim() || undefined,
    bgGradient: bgGrad || undefined,
    bgImage: bgImage.trim() || undefined,
    bgOpacity: bgOpacity >= 100 ? undefined : Math.max(0, bgOpacity),
    bgVideo: bgVideo.trim() || undefined,
    elements: els,
    mobileCustom: mobileCustom || undefined,
    mobileH: mobileCustom ? mobileH : undefined,
    palette: palette.length ? palette : undefined,
    fonts: fonts.length ? fonts : undefined,
    components: components.length ? components : undefined,
    uploads: uploads.length ? uploads : undefined,
    fontSystem: fontSys || undefined,
    guidesX: guidesX.length ? guidesX : undefined,
    guidesY: guidesY.length ? guidesY : undefined,
    textStyles,
    banner: banner && banner.text.trim() ? banner : undefined,
    popup: popup && popup.text.trim() ? popup : undefined,
  })
  // Load a whole PageCanvas into the editor state (used by draft recovery).
  const loadCanvas = (c: PageCanvas) => {
    setEls((c.elements || []).map(e => ({ ...e })))
    setBg(c.bg || '')
    setBgGrad(c.bgGradient || null)
    setBgImage(c.bgImage || '')
    setBgVideo(c.bgVideo || '')
    setBgOpacity(c.bgOpacity ?? 100)
    setPageWidth(c.width === 'contained' ? 'contained' : 'full')
    setMobileCustom(!!c.mobileCustom)
    setPalette(c.palette || [])
    setFonts(c.fonts || [])
    setComponents(c.components || [])
    setUploads(c.uploads || [])
    setFontSys(c.fontSystem || fontSystem)
    setGuidesX(c.guidesX || [])
    setGuidesY(c.guidesY || [])
    setTextStyles(c.textStyles ?? defaultTextStyles())
    setBanner(c.banner ?? null)
    setPopup(c.popup ?? null)
    setShowRulers(v => v || !!(c.guidesX?.length || c.guidesY?.length))
    setSelectedIds([])
    setEditingId('')
    const maxId = (c.elements || []).reduce((m, e) => { const n = parseInt(String(e.id).replace(/[^0-9]/g, ''), 10); return Number.isFinite(n) ? Math.max(m, n) : m }, 0)
    idc.current = Math.max(idc.current, maxId + 1)
  }
  async function save(auto = false) {
    // finish or cancel the master edit first — never persist mid-edit loose elements.
    // On auto-save, skip quietly so we never pop an error mid-edit.
    if (editingComp) { if (auto) return; setSaveError('Finish or cancel the component edit before saving or switching pages.'); setFocusMode(false); return }
    // The save gate keeps only the first 80 elements; never report "Saved" while silently
    // dropping the rest — warn and abort so the owner can trim the page first.
    if (elsRef.current.length > 80) { if (auto) return; setSaveError('This page has more than 80 elements — only the first 80 can be saved. Combine or remove a few, then save again.'); setFocusMode(false); return }
    setSaving(true)
    const canvas = buildCanvas()
    const payload = JSON.stringify(canvas)
    // Guard against the Server Actions body limit (12 MB, see next.config) — embedded
    // images add up fast. Warn with something actionable instead of a silent failure.
    if (payload.length > 11_500_000) {
      setSaving(false)
      if (auto) return // auto-save backs off quietly; the manual Save still surfaces this
      setSaveError('This page is too heavy to save — its images add up to more than ~11 MB. Remove some uploads or use smaller/fewer photos, then save again.')
      setFocusMode(false) // make the error visible if the panel is hidden
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
      try { localStorage.removeItem(draftKey) } catch { /* ignore */ } // work is persisted; drop the recovery draft
      setDraftAt(null)
    } catch {
      // Keep dirty so the work isn't considered saved; tell the user it failed.
      setSaveError('Couldn’t save — please check your connection and try again. If it keeps failing, your page may have too many large images.')
    } finally {
      setSaving(false)
    }
  }

  // Expose a flush so the top "Pages" tabs (a separate client component) can persist the
  // current page before navigating — switching pages can't lose work. `save` is a hoisted
  // function declaration, so referencing it here is safe; the ref keeps it current.
  const saveRef = useRef<(auto?: boolean) => Promise<void>>(save)
  saveRef.current = save
  useEffect(() => {
    ;(window as unknown as { __cvFlush?: () => Promise<void> }).__cvFlush = async () => {
      if (dirty.current) await saveRef.current(true)
    }
    return () => { delete (window as unknown as { __cvFlush?: () => Promise<void> }).__cvFlush }
  }, [])

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
    if (el.type === 'draw')
      return (
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block', overflow: 'visible', pointerEvents: 'none' }}>
          {(el.paths ?? []).map((d, i) => <path key={i} d={d} style={{ fill: 'none', stroke: el.color || '#111111', strokeWidth: el.strokeW || 6, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }} />)}
        </svg>
      )
    if (el.type === 'group') {
      const flow = el.flow || { dir: 'row' as const, gap: 16, padX: 0, padY: 0, align: 'start' as const, justify: 'start' as const }
      const kids = flowChildren(el, els)
      return (
        <div style={{ ...flowContainerStyle(flow, cqv), background: el.fill || undefined, borderRadius: cqv(el.radius || 0), pointerEvents: 'none' }}>
          {kids.map(k => <div key={k.id} style={flowItemStyle(k, flow, cqv)}>{elInner(k)}</div>)}
        </div>
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
    if (el.type === 'embed') {
      const ok = !!(el.embedUrl && embedSrc(el.embedUrl))
      return (
        <div style={{ width: '100%', height: '100%', background: '#0e0e12', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: cqv(6), borderRadius: cqv(el.radius || 0), pointerEvents: 'none' }}>
          <span style={{ fontSize: cqv(34) }}>▶</span>
          <span style={{ fontSize: cqv(13), opacity: 0.7 }}>{ok ? 'Video / map' : 'Paste a video or map link'}</span>
        </div>
      )
    }
    if (el.type === 'form') {
      const r = cqv(Math.max(0, (el.radius ?? 10) - 2))
      const fieldStyle: CSSProperties = { width: '100%', padding: `${cqv(9)} ${cqv(11)}`, borderRadius: r, border: '1px solid rgba(0,0,0,0.16)', background: 'rgba(255,255,255,0.86)', color: 'rgba(0,0,0,0.42)', fontSize: cqv(15), marginBottom: cqv(8), boxSizing: 'border-box', overflow: 'hidden', whiteSpace: 'nowrap' }
      const list = el.fields && el.fields.length ? el.fields : defaultFormFields()
      return (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', pointerEvents: 'none', fontFamily: fontVar(el.fontFamily), overflow: 'hidden' }}>
          {list.map((f, i) => (
            <div key={i} style={{ ...(f.type === 'textarea' ? { ...fieldStyle, flex: 1, minHeight: cqv(36) } : fieldStyle), opacity: f.showIf ? 0.55 : 1, ...(i > 0 && f.newStep ? { borderTop: '2px dashed rgba(0,0,0,0.22)', paddingTop: cqv(7), marginTop: cqv(4) } : {}) }}>{f.label}{f.required ? ' *' : ''}{f.type === 'select' ? ' ▾' : ''}</div>
          ))}
          <div style={{ padding: `${cqv(9)} ${cqv(16)}`, borderRadius: r, background: el.fill || accent, color: '#fff', fontSize: cqv(15), fontWeight: 600, textAlign: 'center' }}>{el.text || 'Send message'}</div>
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
          color: isBtn ? '#fff' : !isBtn && el.gradient && !editing ? 'transparent' : el.color || t.text,
          background: isBtn ? gradientCss(el.gradient) || el.fill || accent : undefined,
          backgroundImage: !isBtn && el.gradient && !editing ? gradientCss(el.gradient) : undefined,
          WebkitBackgroundClip: !isBtn && el.gradient && !editing ? 'text' : undefined,
          backgroundClip: !isBtn && el.gradient && !editing ? 'text' : undefined,
          borderRadius: isBtn ? cqv(el.radius ?? 6) : undefined,
          boxShadow: isBtn ? shadowCss(el.shadow) : undefined,
          fontWeight: el.weight ?? (el.bold ? 700 : 400),
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
  const elIcon = (el: CanvasElement) => (el.type === 'text' ? 'T' : el.type === 'image' ? '▦' : el.type === 'carousel' ? '▷' : el.type === 'shape' ? '◣' : el.type === 'icon' ? '◈' : el.type === 'component' ? '❖' : el.type === 'button' ? '▭' : el.type === 'menu' ? '☰' : el.type === 'form' ? '✉' : el.type === 'embed' ? '▶' : el.type === 'draw' ? '✎' : el.type === 'group' ? '▦' : '◻')
  const elName = (el: CanvasElement) => {
    if (el.type === 'text') return (el.text || 'Text').replace(/\s+/g, ' ').trim() || 'Text'
    if (el.type === 'button') return (el.text || 'Button').replace(/\s+/g, ' ').trim() || 'Button'
    if (el.type === 'image') return 'Picture'
    if (el.type === 'carousel') return 'Slideshow'
    if (el.type === 'shape') return 'Shape divider'
    if (el.type === 'draw') return 'Drawing'
    if (el.type === 'group') return 'Layout group'
    if (el.type === 'icon') return 'Icon · ' + (el.icon || 'star')
    if (el.type === 'component') return components.find(c => c.id === el.componentId)?.name || 'Component'
    if (el.type === 'menu') return 'Page menu'
    if (el.type === 'form') return 'Contact form'
    if (el.type === 'embed') return 'Video / Map'
    if (el.w >= CANVAS_W * 0.8 && el.h >= 120) return 'Section band'
    if (el.h <= 10) return 'Line'
    return 'Box'
  }
  const selectFromList = (e: ReactMouseEvent, id: string) => {
    if (e.shiftKey) toggleGroupInSelection([id])
    else setSelectedIds(withGroup([id]))
  }
  const layerBtn = (onSel: boolean, disabled: boolean): CSSProperties => ({ fontSize: 11, width: 17, height: 17, lineHeight: '15px', textAlign: 'center', borderRadius: 3, color: onSel ? '#fff' : ui, opacity: disabled ? 0.25 : 1, flexShrink: 0 })
  const swatch: CSSProperties = swatchCss
  // A colour value resolved for display: a brand token shows its current swatch colour.
  const resolveCol = (v?: string) => { if (v && isBrandToken(v)) { return palette[Number(v.slice(-2, -1))] || '#888888' } return v || '' }
  // A colour control (native picker + name/hex text box + brand-swatch chips).
  const colorField = (value: string | undefined, onChange: (v: string) => void, fallback: string) => (
    <ColorField value={value} onChange={onChange} fallback={fallback} palette={palette} />
  )
  // A compact on/off multi-stop gradient editor, reused for boxes, buttons, text and
  // the page background. 2 stops use from/to; 3-6 stops use an explicit `stops` list
  // (kept in user order; gradientCss sorts by position at render time).
  const gradStopsOf = (gr: Gradient): { color: string; at: number }[] =>
    gr.stops && gr.stops.length >= 2 ? gr.stops : [{ color: gr.from, at: 0 }, { color: gr.to, at: 100 }]
  const gradientControls = (g: Gradient | null | undefined, onChange: (g: Gradient | null) => void) => {
    const writeStops = (gr: Gradient, next: { color: string; at: number }[]) => {
      const clean = next.slice(0, 6)
      if (clean.length <= 2) onChange({ ...gr, from: clean[0]?.color || gr.from, to: clean[1]?.color || clean[0]?.color || gr.to, stops: undefined })
      else onChange({ ...gr, stops: clean, from: clean[0].color, to: clean[clean.length - 1].color })
    }
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span style={labelCss}>Gradient</span>
          <button type="button" onClick={() => onChange(g ? null : { from: accent, to: '#1a1612', angle: 90 })} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 9px', borderRadius: 3, border: `1px solid ${g ? ui : 'rgba(0,0,0,0.15)'}`, background: g ? ui : 'transparent', color: g ? '#fff' : '#666' }}>{g ? 'On' : 'Off'}</button>
        </div>
        {g && (() => {
          const stops = gradStopsOf(g)
          const multi = stops.length > 2
          return (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                {stops.map((s, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <input type="color" value={s.color} onChange={e => writeStops(g, stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} style={swatch} title={`Stop ${i + 1}`} />
                    {stops.length > 2 && (
                      <button type="button" onClick={() => writeStops(g, stops.filter((_, j) => j !== i))} title="Remove stop" style={{ position: 'absolute', top: -5, right: -5, width: 14, height: 14, borderRadius: 999, background: '#fff', border: '1px solid rgba(0,0,0,0.25)', fontSize: 9, lineHeight: '12px', color: '#888' }}>×</button>
                    )}
                  </div>
                ))}
                {stops.length < 6 && (
                  <button type="button" onClick={() => writeStops(g, [...stops, { color: accent, at: 50 }])} title="Add a colour stop" style={{ width: 24, height: 24, borderRadius: 4, border: '1px dashed rgba(0,0,0,0.3)', color: '#888', fontSize: 15, lineHeight: '20px' }}>+</button>
                )}
                <div className="flex items-center gap-1 ml-auto">
                  {(['linear', 'radial', 'conic'] as const).map(k => (
                    <button key={k} type="button" title={k} onClick={() => onChange({ ...g, kind: k === 'linear' ? undefined : k })} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 6px', borderRadius: 3, border: `1px solid ${(g.kind || 'linear') === k ? ui : 'rgba(0,0,0,0.15)'}`, background: (g.kind || 'linear') === k ? ui : 'transparent', color: (g.kind || 'linear') === k ? '#fff' : '#666' }}>{k[0]}</button>
                  ))}
                </div>
              </div>
              {multi && (
                <div className="space-y-1">
                  {stops.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span style={{ width: 13, height: 13, borderRadius: 3, background: s.color, border: '1px solid rgba(0,0,0,0.2)', flex: 'none' }} />
                      <input type="range" min={0} max={100} value={s.at} onChange={e => writeStops(g, stops.map((x, j) => (j === i ? { ...x, at: Number(e.target.value) } : x)))} style={{ flex: 1 }} />
                      <span style={{ fontSize: 10, color: '#888', width: 30 }}>{s.at}%</span>
                    </div>
                  ))}
                </div>
              )}
              {g.kind !== 'radial' && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span style={labelCss}>Direction</span>
                    {([['↓', 180], ['↑', 0], ['→', 90], ['←', 270], ['↘', 135], ['↗', 45]] as [string, number][]).map(([sym, ang]) => (
                      <button key={ang} type="button" title={ang === 180 ? 'Top → bottom' : ang === 0 ? 'Bottom → top' : `${ang}°`} onClick={() => onChange({ ...g, angle: ang })} style={{ width: 22, height: 22, fontSize: 13, lineHeight: '20px', textAlign: 'center', borderRadius: 3, border: `1px solid ${g.angle === ang ? accent : 'rgba(0,0,0,0.18)'}`, background: g.angle === ang ? ui : 'transparent', color: g.angle === ang ? '#fff' : '#555' }}>{sym}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={labelCss}>Angle</span>
                    <input type="range" min={0} max={360} value={g.angle} onChange={e => onChange({ ...g, angle: Number(e.target.value) })} style={{ flex: 1 }} />
                  </div>
                </>
              )}
            </>
          )
        })()}
      </div>
    )
  }

  return (
    <div className="lg:flex lg:gap-4 lg:items-start rounded-2xl p-3 md:p-4 lg:w-[92vw] lg:ml-[calc(50%-46vw)]" style={{ background: '#f4f4f7' }}>
      {fonts.length > 0 && <style dangerouslySetInnerHTML={{ __html: fontFaceCss(fonts) }} />}
      {/* LEFT: a Canva-style icon rail + the active tool panel (hidden in focus mode) */}
      {!focusMode && (
      <div className="lg:sticky lg:top-2 lg:shrink-0 flex gap-2.5 mb-4 lg:mb-0">
        <div className="flex flex-col gap-1.5 shrink-0">
          {([['pages', '▭', 'Pages'], ['design', '◍', 'Design'], ['elements', '＋', 'Add'], ['text', 'T', 'Text'], ['uploads', '⤒', 'Uploads'], ['layers', '▤', 'Layers']] as const).map(([key, icon, lbl]) => {
            const on = lib && panelTab === key
            return (
              <button key={key} type="button" onClick={() => { setPanelTab(key); setSelectedIds([]); setEditingId('') }} title={lbl}
                className="flex flex-col items-center justify-center gap-1 rounded-xl transition-colors"
                style={{ width: 50, height: 52, border: 'none', background: on ? ui : '#ffffff', color: on ? '#fff' : '#6b7280', boxShadow: on ? 'none' : '0 1px 2px rgba(17,17,26,0.05)' }}>
                <span style={{ fontSize: 17, lineHeight: 1, fontWeight: key === 'text' ? 700 : 400 }}>{icon}</span>
                <span style={{ fontSize: 8.5, letterSpacing: 0.3, textTransform: 'uppercase', fontWeight: 600 }}>{lbl}</span>
              </button>
            )
          })}
          <button type="button" onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)" className="flex items-center justify-center rounded-xl transition-colors hover:bg-gold/10" style={{ width: 50, height: 34, marginTop: 2, border: '1px solid #ececef', background: '#ffffff', color: '#9aa0ab', fontSize: 15 }}>?</button>
        </div>
        <div className="lg:w-[284px] lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto rounded-2xl px-4 py-4 flex flex-col gap-4" style={{ background: '#ffffff', border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(17,17,26,0.04), 0 14px 34px -16px rgba(17,17,26,0.22)' }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 14, fontWeight: 600, color: '#2a2e3a', letterSpacing: 0.2 }}>{lib ? ({ design: 'Design', text: 'Text', elements: 'Add', uploads: 'Uploads', layers: 'Layers', pages: 'Pages' } as const)[panelTab] : 'Selected'}</span>
          <div className="flex items-center gap-2.5">
            {siteStatus === 'live' && (
              <a href={pageSlug ? `/s/${siteSlug}/${pageSlug}` : `/s/${siteSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, fontWeight: 600, color: '#9aa0ab' }} className="hover:text-gold">View ↗</a>
            )}
            <button type="button" onClick={() => setFocusMode(true)} title="Hide this panel (or double-click the canvas)" style={{ fontSize: 16, lineHeight: 1, color: '#b6bbc4', width: 20 }} className="hover:text-gold">⟨</button>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={() => save()} disabled={saving || !!editingComp} title={editingComp ? 'Finish editing the component first' : undefined} style={{ background: saved ? '#1f9d6b' : ui }} className="text-white hover:brightness-110 text-[12px] font-semibold tracking-wide px-4 py-2.5 rounded-xl disabled:opacity-50 transition">
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save & publish'}
          </button>
          {/* Auto-save status — the owner never has to press Save; this just reassures. */}
          <span className="font-label text-[9px] tracking-[1px] uppercase" style={{ color: '#9aa0ab' }}>
            {saving ? 'Saving…' : (saved && !dirty.current) ? 'Saved' : (dirty.current && !saving) ? 'Unsaved…' : ''}
          </span>
        </div>
        {saveError && (
          <p className="font-body text-[11px] leading-relaxed rounded-sm px-2.5 py-2" style={{ color: '#8a2b1d', background: '#fbe9e6', border: '1px solid rgba(179,64,47,0.3)' }}>{saveError}</p>
        )}
        {draftAt && (
          <div className="rounded-lg px-2.5 py-2 flex flex-col gap-1.5" style={{ background: '#f3f6f1', border: '1px solid #d9e4d3' }}>
            <span className="font-body text-[11px] leading-relaxed" style={{ color: '#4b5a45' }}>You have unsaved changes from a previous session.</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { if (draftCanvas.current) { snapshot(true); loadCanvas(draftCanvas.current); touch() } setDraftAt(null) }} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-2.5 py-1.5 rounded-sm">↩ Restore them</button>
              <button type="button" onClick={() => { try { localStorage.removeItem(draftKey) } catch { /* ignore */ } setDraftAt(null) }} className="font-label text-[9px] tracking-[1px] uppercase text-ash/60 hover:text-gold px-2 py-1.5">Discard</button>
            </div>
          </div>
        )}
        {/* Write-with-AI + switch to the block editor */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setAiPageOpen(o => !o)} title="Write this page with AI" className="flex-1 font-label text-[9px] tracking-[1px] uppercase border px-2 py-1.5 rounded-sm" style={{ borderColor: aiPageOpen ? ui : 'rgba(103,144,93,0.4)', background: aiPageOpen ? ui : 'transparent', color: aiPageOpen ? '#fff' : ui }}>✨ AI</button>
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
          <button type="button" onClick={() => setShowGrid(g => { const n = !g; try { localStorage.setItem('cveditor:showGrid', n ? '1' : '0') } catch { /* ignore */ } return n })} title={showGrid ? 'Grid on — elements snap to it' : 'Snap to grid'} className="font-label text-[9px] tracking-[1px] uppercase px-2 py-1.5 rounded-sm border" style={{ borderColor: showGrid ? ui : 'rgba(0,0,0,0.2)', background: showGrid ? ui : 'transparent', color: showGrid ? '#fff' : '#888' }}>▦</button>
          {showGrid && (
            <select value={gridSize} onChange={e => { const v = Number(e.target.value); setGridSize(v); try { localStorage.setItem('cveditor:gridSize', String(v)) } catch { /* ignore */ } }} title="Grid size" className="rounded-sm border" style={{ fontSize: 10, padding: '2px 3px', borderColor: 'rgba(0,0,0,0.2)', color: '#666', background: '#fff' }}>
              {GRID_SIZES.map(g => <option key={g} value={g}>{g}px</option>)}
            </select>
          )}
        </div>

        {lib && panelTab === 'pages' && (() => {
          const pwf = allPages.map(p => ({ ...p, folder: folderMap[p.slug] }))
          const folders = Array.from(new Set(pwf.map(p => p.folder).filter((f): f is string => !!f)))
          const topLevel = pwf.filter(p => !p.folder)
          const dropOnto = (target: string) => { const s = dragPageRef.current; dragPageRef.current = null; setDragOverFolder(null); if (s != null) assignFolder(s, target === '__top' ? '' : target) }
          const row = (p: { slug: string; title: string; hidden?: boolean; folder?: string }) => {
            const on = p.slug === pageSlug
            return (
              <div key={p.slug || 'home'} className="group flex items-center gap-0.5">
                <span draggable onDragStart={e => { dragPageRef.current = p.slug; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', p.slug) } catch { /* some browsers */ } }} onDragEnd={() => { dragPageRef.current = null; setDragOverFolder(null) }} title="Drag into a folder" style={{ cursor: 'grab', color: '#c8c8cd', fontSize: 12, flex: 'none', padding: '0 2px', lineHeight: 1 }}>⠿</span>
                <a href={`/sites/${siteId}/design?page=${p.slug}`} onClick={e => { if (dirty.current) { e.preventDefault(); if (on) void save(); else void goToPage(p.slug) } }} draggable={false} title={p.hidden ? 'Hidden from the menu' : undefined} className="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors flex-1 min-w-0" style={{ background: on ? ui : '#fff', color: on ? '#fff' : '#3a3f4a', border: on ? 'none' : '1px solid #ececef' }}>
                  <span style={{ fontSize: 13, flex: 'none', opacity: on ? 1 : 0.65 }}>{p.slug === '' ? '⌂' : '▭'}</span>
                  <span style={{ fontSize: 13, fontWeight: on ? 600 : 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || (p.slug === '' ? 'Home' : p.slug)}</span>
                  {p.hidden && <span style={{ fontSize: 9, color: on ? 'rgba(255,255,255,0.75)' : '#aaa', flex: 'none' }}>hidden</span>}
                </a>
                <select value="" onChange={e => { const v = e.target.value; e.currentTarget.blur(); if (v === '__new') { const name = (window.prompt('New folder name:') || '').trim(); if (name) assignFolder(p.slug, name) } else if (v === '__none') assignFolder(p.slug, ''); else if (v) assignFolder(p.slug, v) }} title="File this page into a folder" style={{ fontSize: 11, color: '#9aa0ab', border: '1px solid #ececef', borderRadius: 6, padding: '3px 2px', background: '#fff', flex: 'none', width: 28, cursor: 'pointer' }}>
                  <option value="">📁</option>
                  {folders.filter(f => f !== p.folder).map(f => <option key={f} value={f}>→ {f}</option>)}
                  {p.folder && <option value="__none">✕ Out of “{p.folder}”</option>}
                  <option value="__new">+ New folder…</option>
                </select>
                <button type="button" onClick={() => void pageAction('dup', p.slug, p.title)} title="Duplicate this page" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 12, color: '#9aa0ab', padding: '0 2px', flex: 'none' }}>⎘</button>
                {p.slug !== '' && (
                  <button type="button" onClick={() => void pageAction('del', p.slug, p.title)} title="Delete this page" className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: 12, color: '#c0392b', padding: '0 2px', flex: 'none' }}>🗑</button>
                )}
              </div>
            )
          }
          return (
            <div className="space-y-2">
              <p className="font-body text-ash/50 text-[11px] leading-relaxed">Every page on your site — click one to open it. Drag a page by its ⠿ handle (or use the 📁) to file it into a folder. Folders tidy this panel only; your URLs never change.</p>
              <div
                className="flex flex-col gap-1 rounded-lg"
                onDragOver={e => { if (dragPageRef.current != null) { e.preventDefault(); setDragOverFolder('__top') } }}
                onDrop={e => { e.preventDefault(); dropOnto('__top') }}
                style={{ outline: dragOverFolder === '__top' ? `2px dashed ${ui}` : '2px dashed transparent', outlineOffset: 2 }}
              >
                {topLevel.map(row)}
                {!topLevel.length && dragOverFolder === '__top' && <p className="font-body text-[11px] px-2 py-1" style={{ color: ui }}>Drop here to take it out of its folder</p>}
                {folders.map(f => {
                  const open = !collapsedFolders.has(f)
                  const kids = pwf.filter(p => p.folder === f)
                  const over = dragOverFolder === f
                  return (
                    <div key={f}
                      onDragOver={e => { if (dragPageRef.current != null) { e.preventDefault(); e.stopPropagation(); setDragOverFolder(f) } }}
                      onDrop={e => { e.preventDefault(); e.stopPropagation(); dropOnto(f) }}
                      className="rounded-lg"
                      style={{ background: over ? 'rgba(103,144,93,0.08)' : 'transparent', outline: over ? `2px dashed ${ui}` : '2px dashed transparent', outlineOffset: -1 }}
                    >
                      <button type="button" onClick={() => toggleFolder(f)} className="flex items-center gap-1.5 w-full rounded-lg px-2 py-1.5 hover:bg-gold/5" style={{ color: '#6a6f7a' }}>
                        <span style={{ fontSize: 10, width: 10, flex: 'none' }}>{open ? '▾' : '▸'}</span>
                        <span style={{ fontSize: 12, flex: 'none' }}>📁</span>
                        <span style={{ fontSize: 12, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{f}</span>
                        <span style={{ fontSize: 10, color: '#b3b7be', flex: 'none' }}>{kids.length}</span>
                      </button>
                      {open && <div className="flex flex-col gap-1 mt-1" style={{ paddingLeft: 10, marginLeft: 8, borderLeft: '1px solid #ececef' }}>{kids.map(row)}</div>}
                    </div>
                  )
                })}
              </div>
              <button type="button" onClick={() => void addPage()} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-2 rounded-sm w-full">+ Add a page</button>
              <p className="font-body text-ash/40 text-[11px] leading-relaxed">Rename, reorder, hide or delete pages from the bar above the canvas.</p>
            </div>
          )
        })()}

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
            <div>
              <p style={labelCss}>Page menu</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <button type="button" onClick={() => place(PRESETS.menu)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ Page menu</button>
              </div>
            </div>
            <div>
              <p style={labelCss}>Sections</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([['header', 'Header'], ['footer', 'Footer'], ['banner', 'Banner'], ['bar', 'Bar']] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => addTemplate(k)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelCss}>Shapes</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([['box', 'Box'], ['line', 'Line'], ['section', 'Section'], ['shape', 'Divider']] as [string, string][]).map(([key, lbl]) => (
                  <button key={key} type="button" onClick={() => place(PRESETS[key])} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
                ))}
                <button type="button" onClick={() => { setSelectedIds([]); setDrawMode(true) }} className="font-label text-[10px] tracking-[1px] uppercase bg-gold/10 border border-gold/40 text-gold hover:bg-gold/20 px-2.5 py-1.5 rounded-sm">✎ Draw / write</button>
              </div>
              <p className="font-body text-ash/50 text-[11px] mt-1.5 leading-relaxed"><b>Draw / write</b> lets you sketch or hand-write freely on the canvas — drag to draw, then Done.</p>
            </div>
            <div>
              <p style={labelCss}>Media &amp; buttons</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {([['image', 'Picture'], ['carousel', 'Slideshow'], ['button', 'Button'], ['form', 'Contact form'], ['embed', 'Video / Map'], ['contact', 'Email button']] as [string, string][]).map(([key, lbl]) => (
                  <button key={key} type="button" onClick={() => place(PRESETS[key])} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
                ))}
                {([['card', 'Card'], ['faq', 'FAQ']] as const).map(([k, lbl]) => (
                  <button key={k} type="button" onClick={() => addTemplate(k)} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">+ {lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelCss}>Icons</p>
              <div className="flex flex-wrap gap-1 mt-1" style={{ maxHeight: 156, overflowY: 'auto' }}>
                {ICON_GROUPS.flatMap(g => g.keys).map(k => (
                  <button key={k} type="button" title={k} onClick={() => place({ type: 'icon', icon: k, w: 72, h: 72, color: '#111111' })} style={{ width: 30, height: 30, padding: 5, borderRadius: 4, border: '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#3a2e20' }}>{canvasIcon(k)}</button>
                ))}
              </div>
            </div>
            <div>
              <p style={labelCss}>My blocks</p>
              <p className="font-body text-ash/50 text-[11px] mt-1 mb-1.5 leading-relaxed">Select elements on the canvas, right-click &rarr; &ldquo;Save as block&rdquo;. Your blocks are reusable across all your sites.</p>
              {blocks.length === 0 ? (
                <p className="font-body text-ash/40 text-[11px]">No saved blocks yet.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {blocks.map(b => (
                    <div key={b.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => insertBlock(b)} title="Insert this block" className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm flex-1 text-left truncate">+ {b.name}</button>
                      <button type="button" title="Delete block" onClick={() => deleteBlock(b.id)} style={{ fontSize: 13, color: '#b3402f', width: 18, flex: 'none' }}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
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
        <button type="button" onClick={() => setShowTemplates(true)} className="font-label text-[10px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-2.5 rounded-sm">🎨 Start from a template</button>

        <div className="h-px bg-gold/15" />
        <div>
          <div className="flex items-center justify-between">
            <p style={labelCss}>Design review</p>
            <button type="button" onClick={reviewDesign} disabled={critiquing} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 px-2.5 py-1.5 rounded-sm">{critiquing ? 'Reviewing…' : '✦ Review my page'}</button>
          </div>
          <p className="font-body text-ash/50 text-[11px] mt-1 leading-relaxed">A kind second pair of eyes — hierarchy, contrast, spacing &amp; warmth.</p>
          {critiqueErr && <p className="font-body text-[11px] mt-2" style={{ color: '#b4532e' }}>{critiqueErr}</p>}
          {critique && (
            <div className="mt-2.5 space-y-2">
              <p className="font-body text-[12px] italic leading-relaxed" style={{ color: '#5a5a5a' }}>{critique.summary}</p>
              {critique.findings.map((f, i) => {
                const c = f.severity === 'praise' ? '#3b7d4f' : f.severity === 'fix' ? '#b4532e' : '#9a7b1f'
                return (
                  <div key={i} className="flex gap-2">
                    <span style={{ flex: 'none', marginTop: 5, width: 6, height: 6, borderRadius: 999, background: c }} />
                    <p className="font-body text-[12px] leading-relaxed" style={{ color: '#3a3a3a' }}>
                      <span style={{ color: c, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginRight: 6, fontWeight: 600 }}>{f.area}</span>
                      {f.note}
                    </p>
                  </div>
                )
              })}
              <div className="flex items-center gap-3 flex-wrap pt-0.5">
                {!!critique.edits?.length && (
                  <button type="button" onClick={applyCritique} className="font-label text-[9px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-2.5 py-1.5 rounded-sm">✦ Apply {critique.edits.length} suggested change{critique.edits.length > 1 ? 's' : ''}</button>
                )}
                <button type="button" onClick={reviewDesign} disabled={critiquing} className="font-label text-[9px] tracking-[1px] uppercase text-gold/70 hover:text-gold disabled:opacity-50">↻ Review again</button>
              </div>
              {!!critique.edits?.length && <p className="font-body text-ash/45 text-[10.5px] leading-relaxed">Applies safe colour/size/alignment tweaks to the elements above — Ctrl/⌘+Z to undo.</p>}
            </div>
          )}
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Polish copy</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-1.5 leading-relaxed">Rewrite every heading &amp; paragraph in one go — same meaning, new tone, in your brand voice.</p>
          <div className="flex flex-wrap gap-1.5">
            {([['warmer', 'Warmer'], ['calmer', 'Calmer'], ['more premium', 'Premium'], ['punchier', 'Punchier']] as [string, string][]).map(([tone, lbl]) => (
              <button key={tone} type="button" onClick={() => polishCopy(tone)} disabled={!!polishBusy} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 px-2.5 py-1.5 rounded-sm">{polishBusy === tone ? '…' : lbl}</button>
            ))}
          </div>
          <button type="button" onClick={fillAllAlt} disabled={altAllBusy} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 px-2.5 py-1.5 rounded-sm mt-2">{altAllBusy ? 'Writing alt text…' : '✦ Fill missing alt text'}</button>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <div className="flex items-center justify-between">
            <p style={labelCss}>Brand voice</p>
            {voiceSaved && <span className="font-label text-[9px] tracking-[1px] uppercase text-gold/70">✓ Saved</span>}
          </div>
          <textarea value={brandVoice} onChange={e => setBrandVoice(e.target.value)} onBlur={saveBrandVoice} rows={3} maxLength={600} placeholder="e.g. Warm, grounded and a little poetic. Speaks to overwhelmed founders. Calm, never hype-y; short sentences; British spelling." style={{ ...inputCss, width: '100%', fontSize: 12, resize: 'vertical', marginTop: 6 }} />
          <p className="font-body text-ash/50 text-[11px] mt-1 leading-relaxed">Used across this whole site — every AI rewrite, copy suggestion &amp; design review will sound like you.</p>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Page transitions</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {([['fade', 'Fade'], ['slide', 'Slide up'], ['none', 'Off']] as [PageTransitionKind, string][]).map(([k, lbl]) => {
              const on = pageTransition === k
              return (
                <button key={k} type="button" onClick={() => changePageTransition(k)} className="font-label text-[9px] tracking-[1px] uppercase px-2.5 py-1.5 rounded-sm" style={{ border: `1px solid ${on ? ui : 'rgba(0,0,0,0.15)'}`, background: on ? ui : 'transparent', color: on ? '#fff' : '#666' }}>{lbl}</button>
              )
            })}
          </div>
          <p className="font-body text-ash/50 text-[11px] mt-1 leading-relaxed">A gentle animation as each page loads — applied across the whole site.</p>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Font style</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-2 leading-relaxed">The title, subtitle &amp; body fonts for this page.</p>
          <div className="grid grid-cols-2 gap-1.5">
            {FONT_SYSTEMS.map(f => {
              const on = fontSys === f.key
              return (
                <button key={f.key} type="button" onClick={() => { setFontSys(f.key); touch() }} title={f.name} style={{ ...fontVars(f.key), textAlign: 'left', padding: '6px 9px', borderRadius: 5, border: on ? `2px solid ${ui}` : '1px solid rgba(0,0,0,0.15)', background: '#fff' } as CSSProperties}>
                  <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, color: '#222', display: 'block', lineHeight: 1.15 }}>Aa</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: '#777', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <div className="flex items-center justify-between">
            <p style={labelCss}>Announcement bar</p>
            <button type="button" onClick={() => { setBanner(banner ? null : { text: 'Free shipping this week ✦' }); touch() }} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 9px', borderRadius: 3, border: `1px solid ${banner ? ui : 'rgba(0,0,0,0.15)'}`, background: banner ? ui : 'transparent', color: banner ? '#fff' : '#666' }}>{banner ? 'On' : 'Off'}</button>
          </div>
          {banner && (
            <div className="mt-1.5 space-y-1.5">
              <input value={banner.text} onChange={e => { setBanner({ ...banner, text: e.target.value }); touch() }} placeholder="Your announcement…" style={{ ...inputCss, width: '100%', fontSize: 12 }} />
              <div className="flex items-center gap-2">
                <span style={labelCss}>Bar</span>
                {colorField(banner.bg, v => { setBanner({ ...banner, bg: v }); touch() }, '#141414')}
                <span style={labelCss}>Text</span>
                {colorField(banner.color, v => { setBanner({ ...banner, color: v }); touch() }, '#ffffff')}
              </div>
              <input value={banner.href || ''} onChange={e => { setBanner({ ...banner, href: e.target.value || undefined }); touch() }} placeholder="Optional link (https://…)" style={{ ...inputCss, width: '100%', fontSize: 11 }} />
              <p className="font-body text-ash/50" style={{ fontSize: 11 }}>Shows a thin bar across the top of this page. Visitors can dismiss it.</p>
            </div>
          )}
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <div className="flex items-center justify-between">
            <p style={labelCss}>Popup</p>
            <button type="button" onClick={() => { setPopup(popup ? null : { text: 'Join the list for 10% off ✦', title: 'Welcome', ctaLabel: 'Sign up', delay: 3 }); touch() }} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 9px', borderRadius: 3, border: `1px solid ${popup ? ui : 'rgba(0,0,0,0.15)'}`, background: popup ? ui : 'transparent', color: popup ? '#fff' : '#666' }}>{popup ? 'On' : 'Off'}</button>
          </div>
          {popup && (
            <div className="mt-1.5 space-y-1.5">
              <input value={popup.title || ''} onChange={e => { setPopup({ ...popup, title: e.target.value || undefined }); touch() }} placeholder="Title (optional)" style={{ ...inputCss, width: '100%', fontSize: 12 }} />
              <textarea value={popup.text} onChange={e => { setPopup({ ...popup, text: e.target.value }); touch() }} rows={2} placeholder="Your message…" style={{ ...inputCss, width: '100%', fontSize: 12, resize: 'none' }} />
              <div className="flex items-center gap-2">
                <span style={labelCss}>Card</span>
                {colorField(popup.bg, v => { setPopup({ ...popup, bg: v }); touch() }, '#ffffff')}
                <span style={labelCss}>Text</span>
                {colorField(popup.color, v => { setPopup({ ...popup, color: v }); touch() }, '#1a1612')}
              </div>
              <div className="flex items-center gap-1.5">
                <input value={popup.ctaLabel || ''} onChange={e => { setPopup({ ...popup, ctaLabel: e.target.value || undefined }); touch() }} placeholder="Button" style={{ ...inputCss, fontSize: 12, flex: 1 }} />
                <input value={popup.ctaHref || ''} onChange={e => { setPopup({ ...popup, ctaHref: e.target.value || undefined }); touch() }} placeholder="Button link (https://…)" style={{ ...inputCss, fontSize: 11, flex: 1.4 }} />
              </div>
              <div className="flex items-center gap-2">
                <span style={labelCss}>Delay</span>
                <input type="range" min={0} max={60} value={popup.delay ?? 2} onChange={e => { setPopup({ ...popup, delay: Number(e.target.value) }); touch() }} style={{ flex: 1 }} />
                <span style={{ fontSize: 11, color: '#666', width: 30 }}>{popup.delay ?? 2}s</span>
              </div>
              <p className="font-body text-ash/50" style={{ fontSize: 11 }}>Shows once per visitor, {popup.delay ?? 2}s after they arrive. They can close it.</p>
            </div>
          )}
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Page width</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {(['full', 'contained'] as const).map(w => (
              <button key={w} type="button" onClick={() => { setPageWidth(w); touch() }} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, padding: '4px 10px', borderRadius: 3, border: `1px solid ${pageWidth === w ? ui : 'rgba(0,0,0,0.15)'}`, background: pageWidth === w ? ui : 'transparent', color: pageWidth === w ? '#fff' : '#666' }}>{w === 'full' ? 'Full width' : 'Contained'}</button>
            ))}
          </div>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Movement</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-1.5 leading-relaxed">One click sets how the whole page comes alive as visitors scroll. You can still fine-tune any element under its Motion settings.</p>
          <div className="flex flex-wrap gap-1.5">
            {([['calm', 'Calm'], ['playful', 'Playful'], ['energetic', 'Energetic'], ['none', 'None']] as ['calm' | 'playful' | 'energetic' | 'none', string][]).map(([k, lbl]) => (
              <button key={k} type="button" onClick={() => applyMood(k)} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">{lbl}</button>
            ))}
          </div>
        </div>

        <div className="h-px bg-gold/15" />
        <div>
          <p style={labelCss}>Text styles</p>
          <p className="font-body text-ash/50 text-[11px] mt-1 mb-1.5 leading-relaxed">Set Heading, Body and the rest once — every text you&rsquo;ve linked to a style updates together. Link a text from its own panel.</p>
          <div className="space-y-1">
            {TEXT_STYLE_KEYS.map(key => {
              const s = textStyles[key] || defaultTextStyles()[key]
              const open = styleOpen === key
              const usedBy = els.filter(e => e.styleRef === key).length
              return (
                <div key={key} className="rounded-sm" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
                  <button type="button" onClick={() => setStyleOpen(open ? '' : key)} className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left">
                    <span style={{ fontFamily: fontVar(s.fontFamily), fontSize: Math.min(s.fontSize, 20), fontWeight: s.weight ?? 400, fontStyle: s.italic ? 'italic' : undefined, color: '#2a2a2a', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{TEXT_STYLE_LABELS[key]}</span>
                    <span className="font-body text-ash/40 text-[10px] shrink-0">{usedBy > 0 ? `${usedBy} linked ` : ''}{open ? '▴' : '▾'}</span>
                  </button>
                  {open && (
                    <div className="px-2.5 pb-2.5 pt-1 space-y-1.5" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <div className="flex items-center gap-2">
                        <span style={labelCss}>Size</span>
                        <input type="range" min={10} max={120} value={s.fontSize} onChange={e => editStyle(key, { fontSize: Number(e.target.value) })} style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, color: '#666', width: 26 }}>{s.fontSize}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select value={s.fontFamily || 'display'} onChange={e => editStyle(key, { fontFamily: e.target.value })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                          <option value="display">Title font</option><option value="body">Body font</option><option value="label">Label font</option>
                          {fonts.map(f => <option key={f.id} value={`custom:${f.id}`}>{f.name}</option>)}
                        </select>
                        <select value={s.weight ?? 400} onChange={e => editStyle(key, { weight: Number(e.target.value) })} style={{ ...inputCss, fontSize: 11, padding: '3px 4px', width: 'auto' }}>
                          <option value={300}>Light</option><option value={400}>Regular</option><option value={500}>Medium</option><option value={600}>Semibold</option><option value={700}>Bold</option><option value={900}>Black</option>
                        </select>
                        <button type="button" title="Italic" onClick={() => editStyle(key, { italic: !s.italic })} style={{ fontStyle: 'italic', fontSize: 13, color: s.italic ? ui : '#888', width: 22 }}>I</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={labelCss}>Colour</span>
                        {colorField(s.color, v => editStyle(key, { color: v }), '#111111')}
                        <span style={labelCss}>Lines</span>
                        <input type="range" min={0.8} max={2.4} step={0.05} value={s.lineHeight ?? 1.3} onChange={e => editStyle(key, { lineHeight: Number(e.target.value) })} style={{ flex: 1 }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span style={labelCss}>Spacing</span>
                        <input type="range" min={-5} max={30} value={s.letterSpacing ?? 0} onChange={e => editStyle(key, { letterSpacing: Number(e.target.value) || undefined })} style={{ flex: 1 }} title="Letter spacing" />
                        <span style={{ fontSize: 11, color: '#666', width: 24 }}>{s.letterSpacing ?? 0}</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
          <div className="flex flex-wrap gap-1.5">
            {([{ c: '#ffffff' }, { c: '#000000' }, { c: '#f5f5f4' }, { c: '#e7e7e4' }, { c: '#1f2430' }, { g: { from: '#fbeaf0', to: '#e4f0fb', angle: 135, stops: [{ color: '#fbeaf0', at: 0 }, { color: '#f3ecfa', at: 50 }, { color: '#e4f0fb', at: 100 }] } }, { g: { from: '#fce9d8', to: '#e7f3ea', angle: 160, stops: [{ color: '#fce9d8', at: 0 }, { color: '#f7e3ec', at: 45 }, { color: '#e7f3ea', at: 100 }] } }] as { c?: string; g?: Gradient }[]).map((p, i) => (
              <button key={i} type="button" title="Apply this background" onClick={() => { if (p.c) { setBg(p.c); setBgGrad(null) } else if (p.g) { setBgGrad(p.g); setBg('') } touch() }} style={{ width: 26, height: 26, borderRadius: 5, border: '1px solid rgba(0,0,0,0.2)', background: p.c || gradientCss(p.g) || '#fff' }} />
            ))}
          </div>
          {(bg || bgGrad || bgImage) && (
            <div className="flex items-center gap-2">
              <span style={labelCss}>Opacity</span>
              <input type="range" min={0} max={100} value={bgOpacity} onChange={e => { setBgOpacity(Number(e.target.value)); touch() }} style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: '#666', width: 32 }}>{bgOpacity}%</span>
            </div>
          )}
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
            <button type="button" onClick={suggestPalette} disabled={paletteBusy} title="Let AI suggest a cohesive palette" className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 px-2.5 py-1.5 rounded-sm">{paletteBusy ? 'Mixing…' : '✦ Suggest'}</button>
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
                    style={{ background: isSel ? ui : 'transparent', color: isSel ? '#fff' : '#5a513f' }}
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
              <span style={labelCss}>{sel.type === 'text' ? 'Text' : sel.type === 'image' ? 'Picture' : sel.type === 'carousel' ? 'Slideshow' : sel.type === 'shape' ? 'Shape divider' : sel.type === 'draw' ? 'Drawing' : sel.type === 'group' ? 'Layout group' : sel.type === 'icon' ? 'Icon' : sel.type === 'component' ? 'Component' : sel.type === 'button' ? 'Button' : sel.type === 'menu' ? 'Page menu' : sel.type === 'form' ? 'Contact form' : sel.type === 'embed' ? 'Video / Map' : 'Box'}</span>
              <div className="flex items-center gap-2">
                <button type="button" title="Copy style (Ctrl+Shift+C)" onClick={() => copyStyle(sel)} style={{ fontSize: 12, color: accent }}>🖌</button>
                {hasStyle && <button type="button" title="Paste style (Ctrl+Shift+V)" onClick={() => pasteStyle([sel.id])} style={{ fontSize: 11, color: accent, border: `1px solid ${ui}`, borderRadius: 3, padding: '0 4px' }}>paste</button>}
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

            {!sel.locked && (
              <div className="flex items-center gap-1.5" title="Exact size in pixels">
                <span style={labelCss}>Size</span>
                <input type="number" min={1} value={Math.round(gw(sel))} onChange={e => { const w = Math.max(1, Number(e.target.value) || 1); const h = lockRatio ? Math.max(1, Math.round(w * (gh(sel) / Math.max(1, gw(sel))))) : gh(sel); update(sel.id, patchWH(w, h)) }} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 60 }} />
                <span style={{ fontSize: 11, color: '#999' }}>×</span>
                <input type="number" min={1} value={Math.round(gh(sel))} onChange={e => { const h = Math.max(1, Number(e.target.value) || 1); const w = lockRatio ? Math.max(1, Math.round(h * (gw(sel) / Math.max(1, gh(sel))))) : gw(sel); update(sel.id, patchWH(w, h)) }} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 60 }} />
                <button type="button" title={lockRatio ? 'Proportions locked' : 'Lock proportions'} onClick={() => setLockRatio(v => !v)} style={{ fontSize: 12, color: lockRatio ? ui : '#999', width: 24 }}>{lockRatio ? '🔒' : '🔓'}</button>
              </div>
            )}

            {!sel.locked && ['image', 'box', 'carousel', 'embed', 'icon', 'shape'].includes(sel.type) && (
              <div className="flex items-center gap-1 flex-wrap" title="Snap to an aspect ratio (keeps the width)">
                <span style={labelCss}>Ratio</span>
                {([['1:1', 1, 1], ['4:3', 4, 3], ['3:4', 3, 4], ['16:9', 16, 9], ['9:16', 9, 16]] as [string, number, number][]).map(([lbl, rw, rh]) => (
                  <button key={lbl} type="button" onClick={() => { const w = Math.round(gw(sel)); update(sel.id, patchWH(w, Math.max(8, Math.round((w * rh) / rw)))) }} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2 py-1 rounded-sm">{lbl}</button>
                ))}
              </div>
            )}

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
                {sel.type === 'text' && (
                  <div>
                    <div className="flex flex-wrap gap-1">
                      {TEXT_STYLE_KEYS.map(key => {
                        const on = sel.styleRef === key
                        return (
                          <button key={key} type="button" onClick={() => applyStyle(sel.id, key)} title={`Apply the ${TEXT_STYLE_LABELS[key]} style`} className="font-label text-[9px] tracking-[1px] uppercase px-2 py-1 rounded-sm border" style={{ borderColor: on ? accent : 'rgba(0,0,0,0.18)', background: on ? ui : 'transparent', color: on ? '#fff' : '#666' }}>{TEXT_STYLE_LABELS[key]}</button>
                        )
                      })}
                    </div>
                    {sel.styleRef && (
                      <p className="font-body text-ash/50 text-[11px] mt-1">Linked to the <b className="text-ash">{TEXT_STYLE_LABELS[sel.styleRef as TextStyleKey]}</b> style — edit it under <b>Design → Text styles</b> to change every linked text. <button type="button" onClick={() => update(sel.id, { styleRef: undefined })} className="text-gold hover:text-goldLight underline">Unlink</button></p>
                    )}
                  </div>
                )}
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
                  {(() => { const ew = sel.weight ?? (sel.bold ? 700 : 400); return (
                    <>
                      <button type="button" title="Bold" onClick={() => update(sel.id, { weight: ew >= 700 ? 400 : 700, bold: undefined })} style={{ fontWeight: 700, fontSize: 13, color: ew >= 700 ? ui : '#888', width: 24 }}>B</button>
                      <button type="button" title="Italic" onClick={() => update(sel.id, { italic: !sel.italic })} style={{ fontStyle: 'italic', fontSize: 13, color: sel.italic ? ui : '#888', width: 24 }}>I</button>
                      <select value={ew} onChange={e => update(sel.id, { weight: Number(e.target.value), bold: undefined })} title="Font weight" style={{ ...inputCss, fontSize: 11, padding: '3px 4px', width: 'auto' }}>
                        <option value={300}>Light</option>
                        <option value={400}>Regular</option>
                        <option value={500}>Medium</option>
                        <option value={600}>Semibold</option>
                        <option value={700}>Bold</option>
                        <option value={800}>Extra</option>
                        <option value={900}>Black</option>
                      </select>
                    </>
                  ) })()}
                </div>
                {(() => {
                  // Gentle WCAG contrast hint: text vs the box/page behind it; button label (white) vs the button fill.
                  let fg: string | null
                  let bgc: string | null
                  if (sel.type === 'button') {
                    if (sel.gradient) return null
                    fg = '#ffffff'
                    bgc = resolveColor(sel.fill || accent, palette)
                  } else {
                    if (sel.gradient) return null
                    fg = resolveColor(sel.color, palette) || '#1a1612'
                    const cx = sel.x + sel.w / 2
                    const cy = sel.y + sel.h / 2
                    const behind = els.filter(e => e.id !== sel.id && e.type === 'box' && !e.hidden && !e.gradient && e.fill && (e.z ?? 0) <= (sel.z ?? 0) && e.x <= cx && cx <= e.x + e.w && e.y <= cy && cy <= e.y + e.h)
                    if (behind.length) bgc = resolveColor(behind.reduce((a, b) => ((b.z ?? 0) >= (a.z ?? 0) ? b : a)).fill, palette)
                    else if (bgImage) bgc = null
                    else if (bgGrad) bgc = resolveColor(bgGrad.from, palette)
                    else bgc = resolveColor(bg, palette) || '#ffffff'
                  }
                  if (!fg || !bgc) return null
                  const ratio = contrastRatio(fg, bgc)
                  if (ratio == null) return null
                  const v = contrastVerdict(ratio, (sel.fontSize || 24) >= 24)
                  return (
                    <p className="font-body text-[11px]" style={{ color: v.ok ? '#3f7d4f' : '#9a7d2e' }} title="Contrast between this text and what's behind it (WCAG). Aim for ‘Readable’ or better.">
                      {v.ok ? '✓' : '⚠'} {v.label}{!v.ok ? ' — may be hard to read' : ''}
                    </p>
                  )
                })()}
                <div className="flex items-center gap-1.5">
                  <span style={labelCss}>Align</span>
                  {(['left', 'center', 'right'] as SiteAlign[]).map(a => (
                    <button key={a} type="button" title={a} onClick={() => update(sel.id, { align: a })} style={{ fontSize: 10, padding: '2px 10px', borderRadius: 3, border: `1px solid ${sel.align === a ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.align === a ? ui : 'transparent', color: sel.align === a ? '#fff' : '#666' }}>{a[0].toUpperCase()}</button>
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
                    <button type="button" onClick={() => update(sel.id, { dropCap: !sel.dropCap })} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 3, border: `1px solid ${sel.dropCap ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.dropCap ? ui : 'transparent', color: sel.dropCap ? '#fff' : '#666' }}>Drop cap {sel.dropCap ? 'on' : 'off'}</button>
                    <div>
                      <div className="flex items-center justify-between">
                        <span style={labelCss}>Gradient text</span>
                        <button type="button" onClick={() => update(sel.id, { gradient: sel.gradient ? undefined : { kind: 'linear', from: sel.color && sel.color.startsWith('#') ? sel.color : '#a85c36', to: '#5b2c9a', angle: 90 } })} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 9px', borderRadius: 3, border: `1px solid ${sel.gradient ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.gradient ? ui : 'transparent', color: sel.gradient ? '#fff' : '#666' }}>{sel.gradient ? 'on' : 'off'}</button>
                      </div>
                      {sel.gradient && <div className="mt-1.5">{gradientControls(sel.gradient, g => update(sel.id, { gradient: g || undefined }))}</div>}
                    </div>
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
                    {sel.ctaType === 'link' && <button type="button" onClick={() => update(sel.id, { newTab: !sel.newTab })} title="Open in a new tab" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 7px', borderRadius: 3, border: `1px solid ${sel.newTab ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.newTab ? ui : 'transparent', color: sel.newTab ? '#fff' : '#666' }}>↗ New tab</button>}
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
                {sel.ctaType === 'link' && <button type="button" onClick={() => update(sel.id, { newTab: !sel.newTab })} title="Open in a new tab" style={{ alignSelf: 'flex-start', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 7px', borderRadius: 3, border: `1px solid ${sel.newTab ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.newTab ? ui : 'transparent', color: sel.newTab ? '#fff' : '#666' }}>↗ New tab</button>}
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
                <div>
                  <div className="flex items-center gap-1.5">
                    <input value={sel.alt || ''} onChange={e => update(sel.id, { alt: e.target.value })} placeholder="Describe this image (alt text — for SEO &amp; screen readers)" style={{ ...inputCss, fontSize: 12, flex: 1 }} />
                    {sel.src && (
                      <button type="button" onClick={() => void suggestAlt(sel.id)} disabled={altBusy} title="Let AI describe this image" className="shrink-0 font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2 py-1.5 rounded-sm disabled:opacity-50">{altBusy ? '…' : '✨ Suggest'}</button>
                    )}
                  </div>
                  {sel.src && !(sel.alt || '').trim() && (
                    <p className="font-body text-[11px] mt-1" style={{ color: '#9a7d2e' }}>A short description helps screen readers and Google. ✨ Suggest writes one for you.</p>
                  )}
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
                <button type="button" onClick={() => update(sel.id, { lightbox: !sel.lightbox })} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, alignSelf: 'flex-start', padding: '3px 9px', borderRadius: 3, border: `1px solid ${sel.lightbox ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.lightbox ? ui : 'transparent', color: sel.lightbox ? '#fff' : '#666' }}>Click to enlarge {sel.lightbox ? 'on' : 'off'}</button>
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
                    <button key={a} type="button" onClick={() => update(sel.id, { align: a })} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, border: `1px solid ${sel.align === a ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.align === a ? ui : 'transparent', color: sel.align === a ? '#fff' : '#666' }}>{a[0].toUpperCase()}</button>
                  ))}
                </div>
                <div>
                  <span style={labelCss}>Menu style</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {([['plain', 'Plain'], ['underline', 'Underline'], ['pills', 'Pills'], ['boxed', 'Boxed'], ['stacked', 'Stacked ↕']] as [MenuStyle, string][]).map(([k, lbl]) => (
                      <button key={k} type="button" onClick={() => update(sel.id, { menuStyle: k })} className="font-label text-[9px] tracking-[1px] uppercase px-2.5 py-1.5 rounded-sm border" style={{ borderColor: (sel.menuStyle || 'plain') === k ? ui : 'rgba(0,0,0,0.15)', background: (sel.menuStyle || 'plain') === k ? ui : 'transparent', color: (sel.menuStyle || 'plain') === k ? '#fff' : '#666' }}>{lbl}</button>
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
                    <button key={k} type="button" title={k} onClick={() => update(sel.id, { shape: k })} style={{ width: 42, height: 28, padding: 2, borderRadius: 3, border: sel.shape === k ? `2px solid ${ui}` : '1px solid rgba(0,0,0,0.2)', background: '#fff' }}>
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
            {sel.type === 'draw' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Colour</span>
                  {colorField(sel.color, v => update(sel.id, { color: v }), '#111111')}
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Thickness</span>
                  <input type="range" min={1} max={40} value={sel.strokeW || 6} onChange={e => update(sel.id, { strokeW: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#666', width: 30 }}>{sel.strokeW || 6}px</span>
                </div>
                <p className="font-body text-ash/50" style={{ fontSize: 11 }}>A freehand sketch. Drag its edges to resize; recolour or rethicken here.</p>
              </>
            )}
            {sel.type === 'icon' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Colour</span>
                  {colorField(sel.color, v => update(sel.id, { color: v }), accent)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span style={labelCss}>Icon link</span>
                  <select value={sel.ctaType || 'none'} onChange={e => update(sel.id, { ctaType: e.target.value as CtaType })} style={{ ...inputCss, fontSize: 12, padding: '4px 6px', width: 'auto' }}>
                    <option value="none">No link</option>
                    <option value="link">Web / social URL</option>
                    <option value="email">Email me</option>
                    <option value="booking">Booking page</option>
                  </select>
                  {sel.ctaType === 'link' && <input value={sel.href || ''} onChange={e => update(sel.id, { href: e.target.value })} placeholder="https://instagram.com/…" style={{ ...inputCss, width: '100%', fontSize: 12 }} />}
                  {sel.ctaType === 'link' && <button type="button" onClick={() => update(sel.id, { newTab: !sel.newTab })} title="Open in a new tab" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, padding: '3px 7px', borderRadius: 3, border: `1px solid ${sel.newTab ? ui : 'rgba(0,0,0,0.15)'}`, background: sel.newTab ? ui : 'transparent', color: sel.newTab ? '#fff' : '#666' }}>↗ New tab</button>}
                </div>
                <p style={labelCss}>Pick an icon</p>
                <div className="flex flex-wrap gap-1" style={{ maxHeight: 170, overflowY: 'auto' }}>
                  {ICON_GROUPS.flatMap(g => g.keys).map(k => (
                    <button key={k} type="button" title={k} onClick={() => update(sel.id, { icon: k })} style={{ width: 30, height: 30, padding: 5, borderRadius: 4, border: sel.icon === k ? `2px solid ${ui}` : '1px solid rgba(0,0,0,0.15)', background: '#fff', color: '#5a513f' }}>{canvasIcon(k)}</button>
                  ))}
                </div>
              </>
            )}
            {sel.type === 'embed' && (
              <>
                <input value={sel.embedUrl || ''} onChange={e => update(sel.id, { embedUrl: e.target.value })} placeholder="Paste a YouTube, Vimeo or Google Maps link" style={{ ...inputCss, fontSize: 12 }} />
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Round</span>
                  <input type="range" min={0} max={40} value={sel.radius || 0} onChange={e => update(sel.id, { radius: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
                {sel.embedUrl && !embedSrc(sel.embedUrl) && <p className="font-body text-[11px]" style={{ color: '#9a7d2e' }}>That link isn&rsquo;t recognised. Use a YouTube, Vimeo or Google Maps link.</p>}
                <p className="font-body text-ash/50" style={{ fontSize: 11 }}>The video or map shows on your live site. In the editor you&rsquo;ll see a placeholder so it stays easy to move.</p>
              </>
            )}
            {sel.type === 'form' && (
              <>
                <div>
                  <span style={labelCss}>Button text</span>
                  <input value={sel.text || ''} onChange={e => update(sel.id, { text: e.target.value })} placeholder="Send message" style={{ ...inputCss, width: '100%', marginTop: 4 }} />
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Button</span>
                  {colorField(sel.fill, v => update(sel.id, { fill: v }), '#111111')}
                  <span style={labelCss}>Text</span>
                  {colorField(sel.color, v => update(sel.id, { color: v }), '#1a1612')}
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Round</span>
                  <input type="range" min={0} max={40} value={sel.radius ?? 10} onChange={e => update(sel.id, { radius: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
                {(() => {
                  const fl = sel.fields && sel.fields.length ? sel.fields : defaultFormFields()
                  const setFields = (next: typeof fl) => update(sel.id, { fields: next })
                  return (
                    <div>
                      <span style={labelCss}>Fields</span>
                      <div className="space-y-1.5 mt-1">
                        {fl.map((f, i) => {
                          const earlierSelects = fl.slice(0, i).filter(x => x.type === 'select' && (x.options ?? []).length > 0)
                          const ctrlField = f.showIf ? fl.find(x => x.id === f.showIf!.field) : undefined
                          return (
                            <div key={i} className="rounded-sm" style={{ padding: '1px 0' }}>
                              {i > 0 && f.newStep && <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: ui, borderTop: `1px dashed ${ui}66`, paddingTop: 3, marginTop: 3, marginBottom: 2 }}>New step ↓</div>}
                              <div className="flex items-center gap-1">
                                <input value={f.label} onChange={e => setFields(fl.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={{ ...inputCss, fontSize: 12, flex: 1, padding: '4px 6px' }} />
                                <select value={f.type} onChange={e => {
                                  const nt = e.target.value as FormFieldType
                                  const fid = f.id
                                  // Leaving 'select' drops stale options and any other field's condition that pointed here.
                                  setFields(fl.map((x, j) => (j === i ? { ...x, type: nt, options: nt === 'select' ? x.options : undefined } : nt !== 'select' && x.showIf?.field === fid ? { ...x, showIf: undefined } : x)))
                                }} style={{ ...inputCss, fontSize: 11, padding: '3px 4px', width: 'auto' }}>
                                  {FORM_FIELD_TYPES.map(t => <option key={t} value={t}>{FORM_FIELD_LABELS[t]}</option>)}
                                </select>
                                <button type="button" title={f.required ? 'Required' : 'Optional'} onClick={() => setFields(fl.map((x, j) => (j === i ? { ...x, required: !x.required } : x)))} style={{ fontSize: 12, color: f.required ? ui : '#bbb', width: 18 }}>{f.required ? '✸' : '○'}</button>
                                {i > 0 && <button type="button" title={f.newStep ? 'Starts a new step' : 'Start a new step here'} onClick={() => setFields(fl.map((x, j) => (j === i ? { ...x, newStep: !x.newStep } : x)))} style={{ fontSize: 12, color: f.newStep ? ui : '#cbb', width: 16 }}>⤓</button>}
                                {fl.length > 1 && <button type="button" title="Remove field" onClick={() => { const rid = f.id; setFields(fl.filter((_, j) => j !== i).map(x => (x.showIf?.field === rid ? { ...x, showIf: undefined } : x))) }} style={{ fontSize: 13, color: '#b3402f', width: 16 }}>×</button>}
                              </div>
                              {f.type === 'select' && (
                                <textarea value={(f.options ?? []).join('\n')} onChange={e => setFields(fl.map((x, j) => (j === i ? { ...x, options: e.target.value.split('\n').map(s => s.slice(0, 60)).slice(0, 12) } : x)))} rows={2} placeholder="One choice per line" style={{ ...inputCss, fontSize: 11, width: '100%', marginTop: 3, resize: 'vertical' }} />
                              )}
                              {earlierSelects.length > 0 && (
                                <div className="flex items-center gap-1 mt-1" style={{ fontSize: 11, color: '#999' }}>
                                  <span>Show if</span>
                                  <select value={f.showIf?.field ?? ''} onChange={e => {
                                    const fid = e.target.value
                                    if (!fid) { setFields(fl.map((x, j) => (j === i ? { ...x, showIf: undefined } : x))); return }
                                    const tgt = fl.find(x => x.id === fid)
                                    const eq = f.showIf?.field === fid ? f.showIf.equals : ((tgt?.options ?? [])[0] ?? '')
                                    setFields(fl.map((x, j) => (j === i ? { ...x, showIf: { field: fid, equals: eq } } : x)))
                                  }} style={{ ...inputCss, fontSize: 11, padding: '2px 4px', width: 'auto' }}>
                                    <option value="">always</option>
                                    {earlierSelects.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                                  </select>
                                  {f.showIf && ctrlField && (
                                    <>
                                      <span>is</span>
                                      <select value={f.showIf.equals} onChange={e => setFields(fl.map((x, j) => (j === i ? { ...x, showIf: { field: f.showIf!.field, equals: e.target.value } } : x)))} style={{ ...inputCss, fontSize: 11, padding: '2px 4px', width: 'auto', flex: 1 }}>
                                        {(ctrlField.options ?? []).map((opt, oi) => <option key={oi} value={opt}>{opt}</option>)}
                                      </select>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      {fl.length < 12 && (
                        <button type="button" onClick={() => setFields([...fl, { id: 'f' + (idc.current++).toString(36), label: 'New field', type: 'text' }])} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1 rounded-sm mt-1.5">+ Add field</button>
                      )}
                    </div>
                  )
                })()}
                <p className="font-body text-ash/50" style={{ fontSize: 11 }}>✸ = required. The <b>Email</b> field fills the sender&rsquo;s address; everything lands in <b>Messages</b> in your dashboard — no email setup needed.</p>
              </>
            )}
            {sel.type === 'group' && (() => {
              const gFlow: FlowConfig = sel.flow || { dir: 'row', gap: 16, padX: 0, padY: 0, align: 'start', justify: 'start' }
              const setFlow = (patch: Partial<FlowConfig>) => update(sel.id, { flow: { ...gFlow, ...patch } })
              const toggleBtn = (active: boolean) => ({ fontSize: 10, padding: '3px 9px', borderRadius: 3, border: `1px solid ${active ? ui : 'rgba(0,0,0,0.15)'}`, background: active ? ui : 'transparent', color: active ? '#fff' : '#666' } as CSSProperties)
              return (
              <>
                <div>
                  <span style={labelCss}>Direction</span>
                  <div className="flex gap-1.5 mt-1.5">
                    {([['row', 'Row →'], ['col', 'Column ↓']] as [FlowConfig['dir'], string][]).map(([d, lbl]) => (
                      <button key={d} type="button" onClick={() => setFlow({ dir: d })} style={{ ...toggleBtn(gFlow.dir === d), flex: 1 }}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Gap</span>
                  <input type="range" min={0} max={120} value={gFlow.gap} onChange={e => setFlow({ gap: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#666', width: 32 }}>{gFlow.gap}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Pad X</span>
                  <input type="range" min={0} max={120} value={gFlow.padX} onChange={e => setFlow({ padX: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#666', width: 32 }}>{gFlow.padX}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Pad Y</span>
                  <input type="range" min={0} max={120} value={gFlow.padY} onChange={e => setFlow({ padY: Number(e.target.value) })} style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: '#666', width: 32 }}>{gFlow.padY}px</span>
                </div>
                <div>
                  <span style={labelCss}>Align</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {([['start', 'Start'], ['center', 'Centre'], ['end', 'End'], ['stretch', 'Stretch']] as [FlowConfig['align'], string][]).map(([a, lbl]) => (
                      <button key={a} type="button" onClick={() => setFlow({ align: a })} style={toggleBtn(gFlow.align === a)}>{lbl}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <span style={labelCss}>Justify</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {([['start', 'Start'], ['center', 'Centre'], ['end', 'End'], ['between', 'Space']] as [FlowConfig['justify'], string][]).map(([j, lbl]) => (
                      <button key={j} type="button" onClick={() => setFlow({ justify: j })} style={toggleBtn(gFlow.justify === j)}>{lbl}</button>
                    ))}
                  </div>
                </div>
                {(() => {
                  const kids = flowChildren(sel, els)
                  return kids.length ? (
                    <div>
                      <span style={labelCss}>Contents</span>
                      <div className="flex flex-col gap-1 mt-1.5">
                        {kids.map((k, i) => (
                          <div key={k.id} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: '#fff', border: '1px solid #ececef' }}>
                            <span style={{ fontSize: 12, flex: 'none', color: '#9aa0ab', width: 14, textAlign: 'center' }}>{elIcon(k)}</span>
                            <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#3a3f4a' }}>{elName(k)}</span>
                            <button type="button" disabled={i === 0} onClick={() => moveChildInGroup(k.id, -1)} title="Move earlier" style={{ fontSize: 13, color: i === 0 ? '#d4d4d8' : '#888', flex: 'none', cursor: i === 0 ? 'default' : 'pointer' }}>↑</button>
                            <button type="button" disabled={i === kids.length - 1} onClick={() => moveChildInGroup(k.id, 1)} title="Move later" style={{ fontSize: 13, color: i === kids.length - 1 ? '#d4d4d8' : '#888', flex: 'none', cursor: i === kids.length - 1 ? 'default' : 'pointer' }}>↓</button>
                            <button type="button" onClick={() => removeFromGroup(k.id)} title="Take out of the group" style={{ fontSize: 12, color: '#c0392b', flex: 'none' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}
                <button type="button" onClick={() => unwrapFlowGroup(sel.id)} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm self-start">Ungroup layout</button>
                <p className="font-body text-ash/50 text-[11px] leading-relaxed">A layout group arranges its items in a row or column. Drag its edges to resize, reorder or take items out above, or <b>Ungroup layout</b> to free them all.</p>
              </>
              )
            })()}
            {sel.type === 'box' && (
              <>
                <div className="flex items-center gap-2">
                  <span style={labelCss}>Fill</span>
                  {colorField(sel.fill, v => update(sel.id, { fill: v }), '#e8dcc0')}
                  {sel.fill && <button type="button" onClick={() => update(sel.id, { fill: '' })} style={{ fontSize: 11, color: '#999' }}>×</button>}
                  <span style={labelCss}>Round</span>
                  <input type="range" min={0} max={120} value={sel.radius || 0} onChange={e => update(sel.id, { radius: Number(e.target.value) })} style={{ flex: 1 }} />
                </div>
                {(gh(sel) <= 24 || gw(sel) / Math.max(1, gh(sel)) >= 8) && (
                  <div className="flex items-center gap-2">
                    <span style={labelCss}>Thickness</span>
                    <input type="range" min={1} max={40} value={Math.min(40, Math.round(gh(sel)))} onChange={e => { const h = Math.max(1, Math.min(40, Number(e.target.value) || 1)); update(sel.id, editingMobile ? { mh: h } : { h }) }} style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: '#666', width: 34 }}>{Math.round(gh(sel))}px</span>
                  </div>
                )}
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
              <input type="range" min={0} max={100} value={sel.opacity ?? 100} onChange={e => update(sel.id, { opacity: Number(e.target.value) })} style={{ flex: 1 }} />
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
                {hasStyle && <button type="button" title="Paste style onto all (Ctrl+Shift+V)" onClick={() => pasteStyle(selectedIds)} style={{ fontSize: 11, color: accent, border: `1px solid ${ui}`, borderRadius: 3, padding: '0 4px' }}>paste style</button>}
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
              {els.filter(e => selectedIds.includes(e.id) && !e.locked && e.type !== 'component' && e.type !== 'group' && !e.parentId).length >= 2 && <button type="button" onClick={makeFlowGroup} title="Lay these out in a row or column that auto-arranges (a flow group)" className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">⊟ Group into a layout</button>}
              {els.some(e => selectedIds.includes(e.id) && e.groupId) && <button type="button" onClick={ungroupSelected} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">Ungroup</button>}
              {!editingComp && <button type="button" onClick={() => makeComponent(selectedIds)} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-2.5 py-1.5 rounded-sm">❖ Make component</button>}
            </div>
            <p className="font-body text-ash/50 text-[11px] leading-relaxed">{els.some(e => selectedIds.includes(e.id) && e.groupId) ? 'Grouped — they select and move together. Ungroup to edit one on its own.' : 'Drag any selected element to move them all together. Group to keep them as one. Shift-click to add or remove.'}</p>
          </div>
        ) : null)}
      </div>
      </div>
      )}

      {/* CANVAS */}
      <div className="flex-1 min-w-0">
        {focusMode && (
          <button type="button" onClick={() => setFocusMode(false)} title="Show the editing panel (or double-click the canvas)" className="mb-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-semibold transition hover:brightness-95" style={{ background: '#fff', color: '#4b5563', border: '1px solid #e6e6e9', boxShadow: '0 1px 2px rgba(17,17,26,0.06)' }}>⟩&nbsp; Show panel</button>
        )}
        {editingComp && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg px-3.5 py-2.5" style={{ background: '#f3f6f1', border: '1px solid #d9e4d3' }}>
            <span className="font-body text-[12px]" style={{ color: '#4b5a45' }}>✎ Editing <b>{components.find(c => c.id === editingComp.id)?.name || 'component'}</b> — rearrange these elements, then save to update every instance.</span>
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
            <button key={d} type="button" onClick={() => { setDevice(d); setSelectedIds([]); setEditingId('') }} className="font-label text-[10px] tracking-[1px] uppercase px-3.5 py-1.5 rounded-sm border" style={{ borderColor: device === d ? ui : 'rgba(0,0,0,0.15)', background: device === d ? ui : 'transparent', color: device === d ? '#fff' : '#888' }}>{lbl}</button>
          ))}
        </div>
        )}

        {device === 'mobile' ? (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 text-center">
            {mobileCustom ? (
              <>
                <span className="font-body text-ash/60 text-[11px]">Custom phone layout — drag, resize and arrange just like desktop.</span>
                <button type="button" onClick={aiArrangeMobile} disabled={mobileBusy} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 px-2.5 py-1 rounded-sm">{mobileBusy ? 'Arranging…' : '✦ AI arrange'}</button>
                <button type="button" onClick={seedMobile} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-2.5 py-1 rounded-sm">↺ Re-stack</button>
                <button type="button" onClick={useAutoMobile} className="font-label text-[9px] tracking-[1px] uppercase text-ash/60 hover:text-gold px-2 py-1">Back to automatic</button>
              </>
            ) : (
              <>
                <span className="font-body text-ash/60 text-[11px]">Your phone layout is automatic — everything stacks neatly top to bottom.</span>
                <button type="button" onClick={aiArrangeMobile} disabled={mobileBusy} className="font-label text-[9px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 disabled:opacity-50 px-3 py-1.5 rounded-sm">{mobileBusy ? 'Arranging…' : '✦ AI arrange for phone'}</button>
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
              <MobileStack canvas={{ h: desktopH, bg: bg.trim() || undefined, bgGradient: bgGrad || undefined, bgImage: bgImage.trim() || undefined, bgOpacity: bgOpacity >= 100 ? undefined : bgOpacity, elements: els, palette: palette.length ? palette : undefined, components }} accent={accent} siteSlug={siteSlug} contactEmail={contactEmail} safeHref={h => h} navPages={navPages} />
            </div>
          </div>
        ) : (
          <>
            {!editingMobile && (
              <div className="flex items-center justify-center gap-1.5 mb-2">
                <button type="button" onClick={() => setZoomClamped(zoom - 0.1)} title="Zoom out" className="font-label text-[12px] text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ width: 26, height: 24, lineHeight: '22px' }}>−</button>
                <button type="button" onClick={() => setZoom(1)} title="Reset to 100%" className="font-label text-[10px] tracking-[1px] text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ width: 54, height: 24 }}>{Math.round(zoom * 100)}%</button>
                <button type="button" onClick={() => setZoomClamped(zoom + 0.1)} title="Zoom in" className="font-label text-[12px] text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ width: 26, height: 24, lineHeight: '22px' }}>+</button>
                {!editingMobile && <button type="button" onClick={fitToScreen} title="Fit the whole page on screen" className="font-label text-[9px] tracking-[1px] uppercase text-gold border border-gold/30 hover:bg-gold/10 rounded-sm" style={{ height: 24, padding: '0 8px' }}>⤢ Fit</button>}
                {!editingMobile && <button type="button" onClick={() => setShowRulers(v => !v)} title="Rulers & guides — click a ruler to drop a guide elements snap to" className="font-label text-[9px] tracking-[1px] uppercase rounded-sm border" style={{ height: 24, padding: '0 8px', borderColor: showRulers ? ui : 'rgba(0,0,0,0.2)', background: showRulers ? ui : 'transparent', color: showRulers ? '#fff' : '#a98', }}>📐 Rulers</button>}
                {!editingMobile && showRulers && (guidesX.length > 0 || guidesY.length > 0) && <button type="button" onClick={() => { setGuidesX([]); setGuidesY([]); touch() }} title="Remove all guides" className="font-label text-[9px] tracking-[1px] uppercase text-gold/70 border border-gold/20 hover:bg-gold/10 rounded-sm" style={{ height: 24, padding: '0 8px' }}>Clear</button>}
              </div>
            )}
          <div ref={viewportRef} onWheel={e => { if (!editingMobile && (e.ctrlKey || e.metaKey)) { e.preventDefault(); setZoomClamped(zoom - e.deltaY * 0.0015) } }} style={{ overflow: 'auto', maxHeight: '80vh' }}>
          <div className={`rounded-sm overflow-hidden border border-gold/15 ${zoom === 1 || editingMobile ? 'mx-auto' : ''} ${!editingMobile && pageWidth === 'contained' && zoom === 1 ? 'max-w-3xl' : ''}`} style={{ ...fontVars(fontSys), width: editingMobile ? 380 : zoom === 1 ? '100%' : `${zoom * 100}%`, maxWidth: editingMobile ? 380 : undefined } as CSSProperties}>
            {banner && banner.text.trim() && (
              <div style={{ background: banner.bg || '#141414', color: banner.color || '#ffffff', fontSize: 13, lineHeight: 1.3, padding: '8px 12px', textAlign: 'center', position: 'relative' }}>
                {banner.text}
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.7, fontSize: 16 }}>×</span>
              </div>
            )}
            <div
              ref={canvasRef}
              onPointerDown={bgPointerDown}
              onDoubleClick={e => { if (e.target === e.currentTarget) setFocusMode(f => !f) }}
              onContextMenu={e => { if (e.target === e.currentTarget) { e.preventDefault(); setSelectedIds([]); setCtxMenu({ x: e.clientX, y: e.clientY }) } }}
              onDragOver={e => { if (dragUploadSrc.current) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' } }}
              onDrop={onCanvasDrop}
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: `${CW} / ${CH}`,
                containerType: 'inline-size',
                ...pageBackground({ bg: bg || t.bg, bgGradient: bgGrad, bgImage, bgOpacity }),
                ...brandVars,
              } as CSSProperties}
            >
              {bgVideo.trim() && <video src={bgVideo.trim()} autoPlay muted loop playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />}
              {showGrid && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.07) 0 1px, transparent 1px ${cqv(gridSize)}), repeating-linear-gradient(90deg, rgba(0,0,0,0.07) 0 1px, transparent 1px ${cqv(gridSize)})` }} />}
              {[...els].filter(el => !el.parentId).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)).map(el => {
                const elHidden = el.hidden || (editingMobile && el.mHidden)
                return (
                  <div
                    key={el.id}
                    onPointerDown={e => { if (el.locked || editingId === el.id) return; startDrag(e, el, 'move') }}
                    onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (!selectedIds.includes(el.id)) setSelectedIds(withGroup([el.id])); setCtxMenu({ x: e.clientX, y: e.clientY }) }}
                    onDoubleClick={() => { if (!el.locked && (el.type === 'text' || el.type === 'button')) { setSelectedIds([el.id]); setEditingId(el.id) } }}
                    style={{ position: 'absolute', left: cqv(gx(el)), top: cqv(topOf(el)), width: cqv(gw(el)), height: cqv(gh(el)), opacity: (elHidden ? 0.3 : 1) * (el.opacity ?? 100) / 100, transform: el.rotate ? `rotate(${el.rotate}deg)` : undefined, mixBlendMode: el.blend, cursor: el.locked ? 'default' : editingId === el.id ? 'text' : 'move', touchAction: 'none', outline: selectedIds.includes(el.id) ? `2px solid ${ui}` : elHidden ? '1px dashed rgba(0,0,0,0.25)' : undefined, outlineOffset: 1 }}
                  >
                    {elInner(el)}
                    {selectedId === el.id && !el.locked && (
                      <>
                        {/* East: width only (drag a line wider without thickening it) */}
                        <div onPointerDown={e => startDrag(e, el, 'resize', 'e')} title="Drag to change width" style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 26, borderRadius: 4, background: '#fff', border: `1.5px solid ${ui}`, cursor: 'ew-resize', touchAction: 'none', zIndex: 2 }} />
                        {/* South: height only */}
                        <div onPointerDown={e => startDrag(e, el, 'resize', 's')} title="Drag to change height" style={{ position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)', width: 26, height: 8, borderRadius: 4, background: '#fff', border: `1.5px solid ${ui}`, cursor: 'ns-resize', touchAction: 'none', zIndex: 2 }} />
                        {/* Corner: both (Shift = keep proportions) */}
                        <div onPointerDown={e => startDrag(e, el, 'resize', 'se')} title="Drag to resize · Shift keeps proportions" style={{ position: 'absolute', right: -7, bottom: -7, width: 14, height: 14, borderRadius: 3, background: ui, border: '2px solid #fff', cursor: 'nwse-resize', touchAction: 'none', zIndex: 2 }} />
                      </>
                    )}
                  </div>
                )
              })}
              {!editingMobile && els.some(e => e.pin === 'footer') && (
                <div style={{ position: 'absolute', left: 0, top: cqv(bodyBottom), width: '100%', height: 0, borderTop: '1px dashed rgba(103,144,93,0.55)', pointerEvents: 'none', zIndex: 4 }}>
                  <span style={{ position: 'absolute', left: 6, top: 3, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(103,144,93,0.85)' }}>Footer — pinned to the bottom</span>
                </div>
              )}
              {guides.x !== null && <div style={{ position: 'absolute', left: cqv(guides.x), top: 0, width: 1, height: '100%', background: '#3b82f6', pointerEvents: 'none', zIndex: 5 }} />}
              {guides.y !== null && <div style={{ position: 'absolute', top: cqv(guides.y), left: 0, height: 1, width: '100%', background: '#3b82f6', pointerEvents: 'none', zIndex: 5 }} />}
              {marquee && <div style={{ position: 'absolute', left: cqv(marquee.x), top: cqv(marquee.y), width: cqv(marquee.w), height: cqv(marquee.h), border: '1px solid #3b82f6', background: 'rgba(59,130,246,0.10)', pointerEvents: 'none', zIndex: 6 }} />}
              {showRulers && !editingMobile && (
                <>
                  {/* persistent guide lines (snap targets; editor-only, never published) */}
                  {guidesX.map((g, i) => (
                    <div key={`gx${i}`} style={{ position: 'absolute', left: cqv(g), top: 0, width: 1, height: '100%', background: '#12b5c9', opacity: 0.75, pointerEvents: 'none', zIndex: 7 }} />
                  ))}
                  {guidesY.map((g, i) => (
                    <div key={`gy${i}`} style={{ position: 'absolute', top: cqv(g), left: 0, height: 1, width: '100%', background: '#12b5c9', opacity: 0.75, pointerEvents: 'none', zIndex: 7 }} />
                  ))}
                  {/* top ruler — click to drop a vertical guide; ◆ removes one */}
                  <div
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { const r = e.currentTarget.getBoundingClientRect(); if (r.width) addGuide('x', ((e.clientX - r.left) / r.width) * CANVAS_W) }}
                    title="Click to drop a vertical guide"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 16, background: 'rgba(24,22,30,0.6)', backgroundImage: `repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 1px, transparent 1px ${cqv(50)})`, cursor: 'crosshair', zIndex: 40 }}
                  >
                    {guidesX.map((g, i) => (
                      <button key={`nx${i}`} type="button" onClick={ev => { ev.stopPropagation(); removeGuide('x', i) }} title="Remove this guide" style={{ position: 'absolute', left: cqv(g), top: 0, transform: 'translateX(-50%)', width: 14, height: 16, lineHeight: '15px', padding: 0, border: 0, background: 'transparent', color: '#12b5c9', cursor: 'pointer', fontSize: 11, zIndex: 41 }}>◆</button>
                    ))}
                  </div>
                  {/* left ruler — click to drop a horizontal guide */}
                  <div
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { const r = e.currentTarget.getBoundingClientRect(); if (r.height) addGuide('y', ((e.clientY - r.top) / r.height) * desktopH) }}
                    title="Click to drop a horizontal guide"
                    style={{ position: 'absolute', top: 0, left: 0, width: 16, height: '100%', background: 'rgba(24,22,30,0.6)', backgroundImage: `repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0 1px, transparent 1px ${cqv(50)})`, cursor: 'crosshair', zIndex: 40 }}
                  >
                    {guidesY.map((g, i) => (
                      <button key={`ny${i}`} type="button" onClick={ev => { ev.stopPropagation(); removeGuide('y', i) }} title="Remove this guide" style={{ position: 'absolute', top: cqv(g), left: 0, transform: 'translateY(-50%)', width: 16, height: 14, lineHeight: '14px', padding: 0, border: 0, background: 'transparent', color: '#12b5c9', cursor: 'pointer', fontSize: 11, zIndex: 41 }}>◆</button>
                    ))}
                  </div>
                </>
              )}
              {els.length === 0 && !drawMode && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, pointerEvents: 'none', zIndex: 3, padding: 24, textAlign: 'center' }}>
                  <div style={{ fontSize: 30, opacity: 0.4, lineHeight: 1 }}>✎</div>
                  <p style={{ fontSize: 16, fontWeight: 600, color: 'rgba(20,20,28,0.5)' }}>This page is empty</p>
                  <p style={{ fontSize: 13, color: 'rgba(20,20,28,0.42)', maxWidth: 320, lineHeight: 1.5 }}>Add a heading, picture or button from the panel — or start from a ready-made template.</p>
                  <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                    <button type="button" onClick={() => { setFocusMode(false); setPanelTab('elements') }} className="font-label text-[10px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-2 rounded-sm">+ Add an element</button>
                    <button type="button" onClick={() => { setFocusMode(false); setShowTemplates(true) }} className="font-label text-[10px] tracking-[1px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm" style={{ background: '#fff' }}>🎨 Start from a template</button>
                  </div>
                </div>
              )}
              {drawMode && (
                <div
                  onPointerDown={drawDown}
                  onPointerMove={drawMove}
                  onPointerUp={drawEnd}
                  onPointerCancel={drawEnd}
                  style={{ position: 'absolute', inset: 0, zIndex: 55, cursor: 'crosshair', touchAction: 'none' }}
                >
                  <svg viewBox={`0 0 ${CW} ${CH}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
                    {[...drawStrokes, ...(drawCur ? [drawCur] : [])].map((s, i) => (s.length > 1 ? (
                      <path key={i} d={'M' + s.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} style={{ fill: 'none', stroke: drawColor, strokeWidth: drawWidth, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }} />
                    ) : null))}
                  </svg>
                </div>
              )}
            </div>
          </div>
          </div>
          </>
        )}
        {drawMode && createPortal(
          <div style={{ position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)', zIndex: 9998, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e6e6e9', borderRadius: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.16)', padding: '8px 12px', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: ui }}>✎ Draw</span>
            <span style={{ display: 'flex', gap: 5 }}>
              {Array.from(new Set(['#111111', '#ffffff', '#b4532e', '#3b6ea5', ui, ...palette])).slice(0, 8).map(c => (
                <button key={c} type="button" title={c} onClick={() => setDrawColor(c)} style={{ width: 18, height: 18, borderRadius: '50%', background: c, border: drawColor.toLowerCase() === c.toLowerCase() ? `2px solid ${ui}` : '1px solid #ccc', cursor: 'pointer' }} />
              ))}
            </span>
            <input type="range" min={1} max={40} value={drawWidth} onChange={e => setDrawWidth(Number(e.target.value))} title="Brush size" style={{ width: 72 }} />
            <span style={{ fontSize: 11, color: '#888', width: 30 }}>{drawWidth}px</span>
            <button type="button" onClick={undoStroke} disabled={!drawStrokes.length} style={{ fontSize: 12, color: drawStrokes.length ? '#555' : '#c4c4c8', cursor: drawStrokes.length ? 'pointer' : 'default' }}>↶ Undo</button>
            <button type="button" onClick={exitDraw} style={{ fontSize: 12, color: '#888' }}>Cancel</button>
            <button type="button" onClick={finishDraw} className="font-label text-[10px] tracking-[1px] uppercase bg-gold text-background hover:bg-goldLight px-3 py-1.5 rounded-sm">✓ Done</button>
          </div>,
          document.body,
        )}
        {showShortcuts && createPortal((() => {
          const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
          const M = isMac ? '⌘' : 'Ctrl'
          const kbd: CSSProperties = { display: 'inline-block', minWidth: 16, textAlign: 'center', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#3a3f4a', background: '#f1f2f4', border: '1px solid #e0e1e5', borderRadius: 5, padding: '2px 6px', lineHeight: 1.3 }
          const groups: { title: string; items: [string[], string][] }[] = [
            { title: 'Edit', items: [[[M, 'Z'], 'Undo'], [[M, '⇧', 'Z'], 'Redo'], [[M, 'D'], 'Duplicate'], [['Del'], 'Delete']] },
            { title: 'Copy', items: [[[M, 'C'], 'Copy'], [[M, 'V'], 'Paste'], [[M, '⇧', 'C'], 'Copy style'], [[M, '⇧', 'V'], 'Paste style']] },
            { title: 'Select & group', items: [[[M, 'A'], 'Select all'], [[M, 'G'], 'Group'], [[M, '⇧', 'G'], 'Ungroup'], [['Esc'], 'Deselect']] },
            { title: 'Move', items: [[['←', '↑', '→', '↓'], 'Nudge 1px'], [['⇧', 'arrows'], 'Nudge 10px'], [['drag edge'], 'Resize one side'], [['?'], 'This help'] as [string[], string]] },
          ]
          return (
            <div onClick={() => setShowShortcuts(false)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(20,20,28,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 24px 70px rgba(0,0,0,0.32)', padding: 24, width: 'min(560px, 94vw)', maxHeight: '86vh', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#2a2e3a' }}>Keyboard shortcuts</h3>
                  <button type="button" onClick={() => setShowShortcuts(false)} style={{ fontSize: 20, color: '#999', lineHeight: 1 }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 28px' }}>
                  {groups.map(g => (
                    <div key={g.title}>
                      <p style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600, color: ui, marginBottom: 8 }}>{g.title}</p>
                      {g.items.map(([keys, label]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '4px 0' }}>
                          <span style={{ fontSize: 12.5, color: '#3a3f4a' }}>{label}</span>
                          <span style={{ display: 'flex', gap: 4, flex: 'none' }}>{keys.map((k, i) => <kbd key={i} style={kbd}>{k}</kbd>)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: '#9aa0ab', marginTop: 18 }}>Press <kbd style={kbd}>?</kbd> any time to open this · {isMac ? '⌘ = Cmd' : 'Ctrl on Windows, ⌘ on Mac'}.</p>
              </div>
            </div>
          )
        })(), document.body)}
      </div>

      {cropId && (() => {
        const el = els.find(e => e.id === cropId)
        return el && el.src ? (
          <CropModal src={el.src} onApply={u => { update(cropId, { src: u }); setCropId('') }} onClose={() => setCropId('')} />
        ) : null
      })()}

      {stockId && <StockPhotos onSelect={u => { update(stockId, { src: u }); setStockId('') }} onClose={() => setStockId('')} />}

      {showTemplates && (
        <div onClick={() => setShowTemplates(false)} style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="rounded-lg p-5 flex flex-col" style={{ background: '#faf7f2', width: 'min(760px, 95vw)', maxHeight: '90vh' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#9a7d2e' }}>Start from a template</span>
              <button type="button" onClick={() => setShowTemplates(false)} style={{ fontSize: 16, color: '#888', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, paddingRight: 4 }}>
              {CANVAS_TEMPLATES.map(tpl => (
                <button key={tpl.key} type="button" onClick={() => applyTemplate(tpl)} className="text-left rounded-md overflow-hidden hover:opacity-95" style={{ border: '1px solid rgba(0,0,0,0.12)', background: '#fff' }}>
                  <div style={{ height: 210, overflow: 'hidden', background: '#fff', pointerEvents: 'none', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <CanvasView canvas={tpl.build(accent)} accent={accent} siteSlug={siteSlug} contactEmail={contactEmail} safeHref={h => h} navPages={navPages} />
                  </div>
                  <div className="px-2.5 py-2 font-label" style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: '#5a513f' }}>{tpl.name}</div>
                </button>
              ))}
            </div>
            <p className="font-body text-ash/50 text-[11px] mt-3">Pick one to drop it onto your canvas — then change the words, colours and images. (Undoable.)</p>
          </div>
        </div>
      )}

      {/* Right-click menu */}
      {ctxMenu && (() => {
        const hasSel = selectedIds.length > 0
        const many = selectedIds.length > 1
        const one = selectedIds.length === 1 ? els.find(e => e.id === selectedIds[0]) : null
        const anyGrouped = els.some(e => selectedIds.includes(e.id) && e.groupId)
        const run = (fn: () => void) => { fn(); setCtxMenu(null) }
        type Item = { label: string; sc?: string; fn: () => void; danger?: boolean }
        const items: (Item | 'sep')[] = hasSel ? [
          { label: 'Copy', sc: 'Ctrl C', fn: () => copySelection(selectedIds) },
          ...(clip.current.length ? [{ label: 'Paste', sc: 'Ctrl V', fn: pasteClipboard } as Item] : []),
          { label: 'Duplicate', sc: 'Ctrl D', fn: () => (many ? duplicateMany(selectedIds) : duplicate(selectedIds[0])) },
          { label: 'Save as block', fn: () => saveAsBlock(selectedIds) },
          'sep',
          { label: 'Bring to front', fn: () => layerMany(selectedIds, 1) },
          { label: 'Send to back', fn: () => layerMany(selectedIds, -1) },
          'sep',
          ...(many ? [{ label: 'Group', sc: 'Ctrl G', fn: groupSelected } as Item] : []),
          ...(anyGrouped ? [{ label: 'Ungroup', sc: 'Ctrl ⇧ G', fn: ungroupSelected } as Item] : []),
          { label: one?.locked ? 'Unlock' : 'Lock', fn: () => selectedIds.forEach(id => { const e = els.find(x => x.id === id); update(id, { locked: !e?.locked }) }) },
          'sep',
          { label: 'Delete', sc: 'Del', danger: true, fn: () => (many ? removeMany(selectedIds) : remove(selectedIds[0])) },
        ] : [
          ...(clip.current.length ? [{ label: 'Paste', sc: 'Ctrl V', fn: pasteClipboard } as Item] : []),
          { label: 'Select all', sc: 'Ctrl A', fn: () => setSelectedIds(elsRef.current.map(x => x.id)) },
        ]
        const vw = typeof window !== 'undefined' ? window.innerWidth : 9999
        const vh = typeof window !== 'undefined' ? window.innerHeight : 9999
        const left = Math.max(6, Math.min(ctxMenu.x, vw - 200))
        const top = Math.max(6, Math.min(ctxMenu.y, vh - (items.length * 32 + 14)))
        return (
          <>
            <div onPointerDown={() => setCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setCtxMenu(null) }} style={{ position: 'fixed', inset: 0, zIndex: 200 }} />
            <div style={{ position: 'fixed', left, top, zIndex: 201, background: '#fff', border: '1px solid rgba(0,0,0,0.14)', borderRadius: 7, boxShadow: '0 8px 28px rgba(0,0,0,0.2)', padding: 4, minWidth: 186 }}>
              {items.map((it, i) => it === 'sep'
                ? <div key={i} style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '4px 6px' }} />
                : (
                  <button key={i} type="button" onClick={() => run(it.fn)} className="w-full flex items-center justify-between rounded-sm" style={{ padding: '6px 9px', fontSize: 12.5, color: it.danger ? '#b3402f' : '#3a2e20', textAlign: 'left', background: 'transparent' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,92,54,0.10)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span>{it.label}</span>{it.sc && <span style={{ fontSize: 10, color: '#b0a99c', marginLeft: 16 }}>{it.sc}</span>}
                  </button>
                ))}
            </div>
          </>
        )
      })()}
    </div>
  )
}
