import { CANVAS_W, THEMES, type PageCanvas, type CanvasElement, type CanvasElementType, type SiteSection, type CtaType, type SiteAlign, type SiteTheme } from './types'

export interface CanvasFromContent {
  headline?: string
  subheadline?: string
  heroImage?: string
  sections?: SiteSection[]
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
  theme?: SiteTheme
  accent?: string
}

// Lay a page's written content (hero + sections — AI-generated or hand-written) out
// as a clean, centred single-column free-canvas layout the owner can then drag,
// restyle and rearrange. Purely deterministic placement (no AI here): it turns
// "blocks" into positioned canvas elements so the free canvas and AI/block content
// can be used together. Heights are estimated from the text so nothing overlaps.
export function canvasFromContent(c: CanvasFromContent): PageCanvas {
  const theme: SiteTheme = c.theme && THEMES[c.theme] ? c.theme : 'sand'
  const textCol = THEMES[theme].text
  const accent = c.accent || THEMES[theme].accent
  const COL_X = 100
  const COL_W = CANVAS_W - COL_X * 2 // 800
  const els: CanvasElement[] = []
  let z = 0
  let y = 90
  const push = (e: Partial<CanvasElement> & { type: CanvasElementType; x: number; y: number; w: number; h: number }) => {
    els.push({ opacity: 100, z: ++z, id: 'g' + els.length.toString(36) + z.toString(36), ...e } as CanvasElement)
  }
  // Rough text height: characters-per-line from the font size, then line count × line-height.
  const estH = (t: string, fs: number, w: number, lh: number) => {
    const cpl = Math.max(6, Math.floor(w / (fs * 0.52)))
    const lines = String(t || '').split('\n').reduce((n, ln) => n + Math.max(1, Math.ceil(ln.length / cpl)), 0)
    return Math.round(lines * fs * lh + fs * 0.5)
  }

  // Hero
  if (c.headline) { const h = estH(c.headline, 56, COL_W, 1.15); push({ type: 'text', x: COL_X, y, w: COL_W, h, text: c.headline, fontSize: 56, fontFamily: 'display', italic: true, color: textCol, align: 'center' }); y += h + 18 }
  if (c.subheadline) { const h = estH(c.subheadline, 24, COL_W, 1.45); push({ type: 'text', x: COL_X, y, w: COL_W, h, text: c.subheadline, fontSize: 24, fontFamily: 'body', color: textCol, align: 'center' }); y += h + 30 }
  if (c.heroImage) { push({ type: 'image', x: COL_X, y, w: COL_W, h: 430, src: c.heroImage, fit: 'cover', radius: 8 }); y += 430 + 30 }
  if (c.ctaType && c.ctaType !== 'none' && c.ctaLabel) { const w = 260; push({ type: 'button', x: Math.round((CANVAS_W - w) / 2), y, w, h: 58, text: c.ctaLabel, fontSize: 18, fontFamily: 'label', fill: accent, radius: 6, ctaType: c.ctaType, href: c.ctaHref, align: 'center' }); y += 58 + 46 }

  // Sections, top to bottom
  for (const s of c.sections || []) {
    y += 18
    if (s.image) { push({ type: 'image', x: COL_X, y, w: COL_W, h: 360, src: s.image, fit: 'cover', radius: 8 }); y += 360 + 24 }
    const align: SiteAlign = s.align === 'center' || s.align === 'right' ? s.align : 'left'
    if (s.heading) { const h = estH(s.heading, 32, COL_W, 1.2); push({ type: 'text', x: COL_X, y, w: COL_W, h, text: s.heading, fontSize: 32, fontFamily: 'display', italic: true, color: s.textColor || textCol, align: align === 'left' ? 'center' : align }); y += h + 12 }
    if (s.body) { const h = estH(s.body, 18, COL_W, 1.6); push({ type: 'text', x: COL_X, y, w: COL_W, h, text: s.body, fontSize: 18, fontFamily: 'body', color: s.textColor || textCol, align }); y += h + 24 }
    if (s.ctaType && s.ctaType !== 'none' && s.ctaLabel) { const w = 240; push({ type: 'button', x: Math.round((CANVAS_W - w) / 2), y, w, h: 54, text: s.ctaLabel, fontSize: 17, fontFamily: 'label', fill: accent, radius: 6, ctaType: s.ctaType, href: s.ctaHref, align: 'center' }); y += 54 + 24 }
  }

  return { h: Math.max(900, y + 80), bg: '#ffffff', elements: els }
}
