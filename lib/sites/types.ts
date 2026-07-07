import { type CSSProperties } from 'react'

export type SiteStatus = 'queued' | 'building' | 'live' | 'failed' | 'stopped'

export type SiteAlign = 'left' | 'center' | 'right'

// How a section lays out: prose, cards, faq, gallery, embed, or 'layout' (free
// composition of typed blocks in columns — the Canva-style mode).
export type SectionKind = 'prose' | 'cards' | 'faq' | 'gallery' | 'embed' | 'layout'

// In a 'layout' section, each SectionItem becomes a typed block placed in a column.
export type BlockType = 'text' | 'heading' | 'subheading' | 'image' | 'button' | 'banner' | 'divider' | 'spacer' | 'social'

export type ImageSize = 'sm' | 'md' | 'full'
export type ImageFit = 'cover' | 'contain'

// For a prose section with an inline image: stack it above, or sit it beside the text.
export type SectionImageLayout = 'stack' | 'imageLeft' | 'imageRight'

export interface SectionItem {
  title?: string
  body?: string
  image?: string
  // --- 'layout' section block fields (absent on cards/faq/gallery items) ---
  block?: BlockType
  col?: 0 | 1 | 2 // layout column, OR header/footer zone (0 left, 1 centre, 2 right)
  imgH?: number // image/logo height in px for header/footer image blocks
  href?: string // button custom target
  ctaType?: CtaType // button uses the shared makeCta resolver
  boxColor?: string // recolour this block's box (hex); absent = no box
  outline?: boolean // outlined box instead of a filled one
}

export interface SiteSection {
  heading: string
  body: string
  image?: string // an inline image shown above the section text
  bgImage?: string // a full-width background photo behind the section (text overlaid)
  bgColor?: string // a solid/tinted panel colour behind the section (when no bgImage)
  borderColor?: string // the colour of the box outline around the section
  borderWidth?: number // the thickness (px, 0-8) of the box outline; 0/undefined = no outline
  textColor?: string // override colour for the section's heading + body text
  textScale?: 'sm' | 'lg' // smaller / larger section text (md is the default when absent)
  align?: SiteAlign // text alignment within the section
  kind?: SectionKind // cards/faq/gallery/embed/layout change the section layout
  items?: SectionItem[] // repeatable items for cards/faq, photos for gallery, or blocks for layout
  columns?: 1 | 2 | 3 // number of columns in a 'layout' section
  reveal?: boolean // fade/slide the section in as the visitor scrolls to it
  imageLayout?: SectionImageLayout // for a prose section with an image
  imageSize?: ImageSize // inline image width
  imageFit?: ImageFit // inline image crop vs fit
  overlay?: number // darkness % (0-80) over a background photo
  embedUrl?: string // a YouTube/Vimeo/Maps URL for an embed section
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
}

// A social profile link shown in the footer.
export type SocialKind = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'whatsapp' | 'email' | 'website'
export interface Social {
  kind: SocialKind
  url: string
}

// Where the navigation menu sits: a top bar, a sticky scrolling bar, or a side column.
export type MenuPosition = 'top' | 'scroll' | 'side'

// A header navigation link the owner adds by hand (external URL, mailto:, the
// booking page, or an on-page anchor) — separate from the automatic page links.
export interface NavLink {
  label: string
  href: string
  newTab?: boolean
}

// Currencies a pay button can charge in (shared by the gate, the editor picker and the
// checkout endpoint so they can never disagree). Lowercase ISO codes; 'eur' is the default.
export const PAY_CURRENCIES = ['eur', 'usd', 'gbp', 'cad', 'aud'] as const
export type PayCurrency = (typeof PAY_CURRENCIES)[number]
// Stripe charges in the smallest currency unit (cents). Clamp the stored amount to a sane band:
// Stripe's own floor is ~50 cents; the ceiling guards against a fat-fingered/over-large charge.
export const PAY_MIN_CENTS = 50
export const PAY_MAX_CENTS = 5000000

// A call-to-action button. 'booking' links to the site's /book page,
// 'email' opens a mail to the contact address, 'link' uses ctaHref, 'none' hides it.
// 'pay' (canvas buttons only) starts a Stripe Connect checkout for payAmount/payCurrency/payProduct,
// settling directly to the owner's connected account (see PayButton.tsx + /api/pay/[slug]).
export type CtaType = 'booking' | 'email' | 'link' | 'none' | 'pay'

// The content column width: 'contained' = a centred middle column,
// 'full' = the content spreads across the whole page.
export type SiteLayout = 'contained' | 'full'

export type SiteTheme = 'sand' | 'midnight' | 'sage' | 'rose'

export const THEMES: Record<
  SiteTheme,
  { bg: string; text: string; muted: string; accent: string; label: string }
> = {
  sand: { bg: '#faf7f2', text: '#1a1612', muted: '#6b6560', accent: '#9a7d2e', label: 'Sand' },
  midnight: { bg: '#0d0b08', text: '#faf7f2', muted: '#9b9389', accent: '#c9a84c', label: 'Midnight' },
  sage: { bg: '#f1f4ee', text: '#1f2a1c', muted: '#5f6b58', accent: '#5c7a52', label: 'Sage' },
  rose: { bg: '#faf2f3', text: '#2a1c1f', muted: '#7a5c61', accent: '#a85c6b', label: 'Rose' },
}

export const DEFAULT_THEME: SiteTheme = 'sand'

// --- Free canvas (Canva-style) page model ---
// Elements are positioned in design pixels on a fixed design width (CANVAS_W).
// The renderer scales the whole canvas with the viewport using cqw units, so it
// stays pixel-faithful on desktop; on phones the elements stack top-to-bottom.
export const CANVAS_W = 1000
// The phone artboard's design width. When a page's mobile layout is "custom",
// elements carry their own mx/my/mw/mh on this narrower canvas.
export const MOBILE_W = 440

// The most brand-palette swatches a page can hold. A colour can reference a
// swatch as `var(--brand-N)`; changing the swatch updates every element using it.
export const MAX_PALETTE = 6
export const brandVar = (i: number) => `var(--brand-${i})`

// An uploaded brand font. `src` is a base64 font data URL; it is exposed to CSS as
// the family `cvf-<id>` (id is alphanumeric, so the name can't inject CSS).
export interface SiteFont {
  id: string // [a-z0-9]+
  name: string // shown in the picker
  src: string // data:font/...;base64,...
}
export const MAX_FONTS = 4
// @font-face rules for a page's uploaded fonts. Every part is validated upstream
// (id alphanumeric, src a strict base64 font data URL), so this can't break out.
export function fontFaceCss(fonts?: SiteFont[]): string {
  return (fonts ?? []).map(f => `@font-face{font-family:'cvf-${f.id}';src:url('${f.src}');font-display:swap;}`).join('')
}
// Only an in-range brand token is a valid colour reference (airtight — no CSS injection).
export const isBrandToken = (v?: string) => /^var\(--brand-[0-5]\)$/.test(String(v ?? '').trim())

export type CanvasElementType = 'text' | 'image' | 'button' | 'box' | 'menu' | 'carousel' | 'shape' | 'icon' | 'component' | 'form' | 'embed' | 'html' | 'draw' | 'group' | 'divider'

// Flow Groups (the layout engine): a 'group' element flex-lays-out its members. Children stay
// in the flat elements[] array with parentId pointing back here; the group is the source of
// truth for membership/order. Children keep their x/y/w/h as the absolute fallback (used if the
// group is missing, and as seed geometry when a child is dragged out). Purely additive — a page
// with no groups renders byte-identically to before. See [[layout-engine-plan]].
export interface FlowConfig {
  dir: 'row' | 'col' // main axis
  gap: number // px between children (design units)
  padX: number // horizontal padding inside the group
  padY: number // vertical padding inside the group
  align: 'start' | 'center' | 'end' | 'stretch' // cross-axis alignment (align-items)
  justify: 'start' | 'center' | 'end' | 'between' // main-axis distribution (justify-content)
  wrap?: boolean // allow children to wrap to the next line
  collapsible?: boolean // accordion: the group can collapse (Stage 4)
}

// Global text styles: every text element has a TYPE (Heading/Body/etc.) it follows via
// `styleRef`. Editing a type re-syncs every element of that type — except the per-element
// properties listed in that element's `styleOverrides` (those stay individually customised).
// The sync happens in the editor, so the renderer is unchanged — elements always carry
// their own resolved typography.
export interface TextStyleProps {
  fontSize: number
  fontFamily?: string // 'display' | 'body' | 'label' | 'custom:<id>'
  weight?: number
  italic?: boolean
  lineHeight?: number
  letterSpacing?: number
  color?: string
}
// Configurable contact-form fields. Submissions still map to the existing messages
// schema (an email field → email, a text field → name, all fields → the body), so no
// DB change is needed.
export type FormFieldType = 'text' | 'email' | 'textarea' | 'tel' | 'select'
export const FORM_FIELD_TYPES: FormFieldType[] = ['text', 'email', 'textarea', 'tel', 'select']
export const FORM_FIELD_LABELS: Record<FormFieldType, string> = { text: 'Short text', email: 'Email', textarea: 'Long text', tel: 'Phone', select: 'Dropdown' }
export interface FormField {
  id: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: string[] // the choices, for a 'select' (dropdown) field
  showIf?: { field: string; equals: string } // only show this field when the named field's value equals this
  newStep?: boolean // this field starts a new step in a multi-step form
}
export const MAX_FORM_OPTIONS = 12
export const MAX_FORM_FIELDS = 12
export function defaultFormFields(): FormField[] {
  return [
    { id: 'name', label: 'Your name', type: 'text' },
    { id: 'email', label: 'Email', type: 'email', required: true },
    { id: 'message', label: 'Message', type: 'textarea', required: true },
  ]
}

export const TEXT_STYLE_KEYS = ['heading', 'subheading', 'body', 'caption', 'quote'] as const
export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number]
export const TEXT_STYLE_LABELS: Record<TextStyleKey, string> = {
  heading: 'Heading',
  subheading: 'Subheading',
  body: 'Body',
  caption: 'Caption',
  quote: 'Quote',
}
export function defaultTextStyles(): Record<TextStyleKey, TextStyleProps> {
  return {
    heading: { fontSize: 48, fontFamily: 'display', italic: true, lineHeight: 1.1, letterSpacing: 0 },
    subheading: { fontSize: 28, fontFamily: 'display', lineHeight: 1.2 },
    body: { fontSize: 18, fontFamily: 'body', lineHeight: 1.5 },
    caption: { fontSize: 13, fontFamily: 'label', lineHeight: 1.3, letterSpacing: 2 },
    quote: { fontSize: 26, fontFamily: 'display', italic: true, lineHeight: 1.4 },
  }
}

// How a page-menu element lays out its links.
export type MenuStyle = 'plain' | 'underline' | 'pills' | 'boxed' | 'stacked'
export const MENU_STYLES: MenuStyle[] = ['plain', 'underline', 'pills', 'boxed', 'stacked']

// Decorative SVG section dividers (filled with the element's colour; rotate to flip).
export type ShapeKind =
  | 'rectangle' | 'ellipse' | 'triangle' | 'rightTriangle' | 'diamond' | 'pentagon' | 'hexagon'
  | 'star' | 'sparkle' | 'heart' | 'halfCircle' | 'quarterCircle' | 'plus' | 'arrowRight'
  | 'line' | 'wave' | 'curve' | 'tilt' | 'hill' | 'zigzag'
// The geometric "figures" (Canva-style) shown as a drop-in picker grid. The remaining
// kinds (line/wave/curve/tilt/hill/zigzag) are the older decorative edges, kept working.
export const FIGURE_KINDS: ShapeKind[] = ['rectangle', 'ellipse', 'triangle', 'rightTriangle', 'diamond', 'pentagon', 'hexagon', 'star', 'sparkle', 'heart', 'halfCircle', 'quarterCircle', 'plus', 'arrowRight']
export const SHAPE_KINDS: ShapeKind[] = [...FIGURE_KINDS, 'line', 'wave', 'curve', 'tilt', 'hill', 'zigzag']
// All on a 0 0 100 100 viewBox, filled with the element's colour, stretched to the box.
export function shapePath(k?: ShapeKind): string {
  switch (k) {
    case 'rectangle': return 'M0,0 H100 V100 H0 Z'
    case 'ellipse': return 'M0,50 A50,50 0 1 1 100,50 A50,50 0 1 1 0,50 Z'
    case 'triangle': return 'M50,0 L100,100 L0,100 Z'
    case 'rightTriangle': return 'M0,0 L0,100 L100,100 Z'
    case 'diamond': return 'M50,0 L100,50 L50,100 L0,50 Z'
    case 'pentagon': return 'M50,0 L98,36 L79,98 L21,98 L2,36 Z'
    case 'hexagon': return 'M25,0 L75,0 L100,50 L75,100 L25,100 L0,50 Z'
    case 'star': return 'M50,2 L61,37 L98,37 L68,59 L79,95 L50,73 L21,95 L32,59 L2,37 L39,37 Z'
    case 'sparkle': return 'M50,0 C54,32 68,46 100,50 C68,54 54,68 50,100 C46,68 32,54 0,50 C32,46 46,32 50,0 Z'
    case 'heart': return 'M50,90 C15,62 0,40 0,24 C0,9 12,0 26,0 C37,0 46,7 50,18 C54,7 63,0 74,0 C88,0 100,9 100,24 C100,40 85,62 50,90 Z'
    case 'halfCircle': return 'M0,100 A50,50 0 0 1 100,100 Z'
    case 'quarterCircle': return 'M0,100 L0,0 A100,100 0 0 1 100,100 Z'
    case 'plus': return 'M35,0 H65 V35 H100 V65 H65 V100 H35 V65 H0 V35 H35 Z'
    case 'arrowRight': return 'M0,30 H60 V10 L100,50 L60,90 V70 H0 Z'
    case 'line': return 'M0,44 H100 V56 H0 Z'
    case 'curve': return 'M0,100 C30,30 70,30 100,100 Z'
    case 'tilt': return 'M0,100 L100,0 L100,100 Z'
    case 'hill': return 'M0,100 C40,0 60,0 100,100 Z'
    case 'zigzag': return 'M0,100 L20,45 L40,100 L60,45 L80,100 L100,45 L100,100 Z'
    case 'wave':
    default: return 'M0,60 C25,95 75,25 100,60 L100,100 L0,100 Z'
  }
}

// Full-width decorative section dividers: organic SVG separators (waves, curves, slopes,
// arches…) the owner drops at the bottom edge of a section. Distinct from the small 'shape'
// element above — these are hand-authored to span the full width on a 0 0 1200 120 viewBox,
// bottom-filled so each reads as the bottom edge of the section. The element's `fill` colours
// the shape (hex or a brand token), and flipX/flipY mirror it (applied via render transform,
// so each kind has ONE canonical orientation here).
export const DIVIDER_KINDS = ['line', 'stars', 'lineStar', 'dashed', 'dotted', 'double', 'wave', 'waveSoft', 'waves', 'curve', 'curveDown', 'slope', 'slopeDown', 'tilt', 'arch', 'round', 'peak', 'drip'] as const
export type DividerKind = (typeof DIVIDER_KINDS)[number]
// The plain / decorative LINE dividers (thin centred separators), as opposed to the
// organic full-width section edges. Placed smaller by default so their proportions read right.
export const LINE_DIVIDER_KINDS: readonly DividerKind[] = ['line', 'stars', 'lineStar', 'dashed', 'dotted', 'double']
export const DIVIDER_LABELS: Record<DividerKind, string> = {
  line: 'Line',
  stars: 'Line + stars',
  lineStar: 'Line + star',
  dashed: 'Dashed',
  dotted: 'Dotted',
  double: 'Double line',
  wave: 'Wave',
  waveSoft: 'Soft wave',
  waves: 'Waves',
  curve: 'Curve up',
  curveDown: 'Curve down',
  slope: 'Slope',
  slopeDown: 'Slope down',
  tilt: 'Tilt',
  arch: 'Arch',
  round: 'Round',
  peak: 'Peak',
  drip: 'Drips',
}
// The SVG path `d` for a divider, on a 0 0 1200 120 viewBox spanning the full width and
// bottom-filled. Hand-authored with smooth cubic/quadratic curves so they read as soft,
// organic edges. flipX/flipY are applied at render via a transform, so each returns one
// canonical orientation (the curved/featured edge along the top, the section colour below).
// A small 4-point sparkle centred at (cx,cy) with reach r — used by the line dividers.
function sparklePath(cx: number, cy: number, r: number): string {
  const i = Math.round(r * 0.34)
  return `M${cx},${cy - r} C${cx + i},${cy - i} ${cx + i},${cy - i} ${cx + r},${cy} C${cx + i},${cy + i} ${cx + i},${cy + i} ${cx},${cy + r} C${cx - i},${cy + i} ${cx - i},${cy + i} ${cx - r},${cy} C${cx - i},${cy - i} ${cx - i},${cy - i} ${cx},${cy - r} Z`
}
export function dividerSvgPath(kind: DividerKind): string {
  switch (kind) {
    // Thin centred rule.
    case 'line':
      return 'M0,57 H1200 V63 H0 Z'
    // Two thin parallel rules.
    case 'double':
      return 'M0,48 H1200 V54 H0 Z M0,66 H1200 V72 H0 Z'
    // A dashed rule.
    case 'dashed': {
      let d = ''
      for (let x = 8; x <= 1150; x += 70) d += `M${x},57 h44 v6 h-44 Z `
      return d.trim()
    }
    // A dotted rule.
    case 'dotted': {
      let d = ''
      for (let x = 30; x <= 1176; x += 76) d += `M${x - 6},60 a6,6 0 1 0 12,0 a6,6 0 1 0 -12,0 Z `
      return d.trim()
    }
    // A rule with a single sparkle in the centre.
    case 'lineStar':
      return 'M0,57 H540 V63 H0 Z M660,57 H1200 V63 H0 Z ' + sparklePath(600, 60, 34)
    // A rule with three evenly-spaced sparkles.
    case 'stars':
      return 'M0,57 H196 V63 H0 Z M284,57 H516 V63 H0 Z M684,57 H916 V63 H0 Z M1004,57 H1200 V63 H0 Z ' +
        sparklePath(240, 60, 26) + ' ' + sparklePath(600, 60, 26) + ' ' + sparklePath(960, 60, 26)
    // A single gentle S-wave across the width.
    case 'waveSoft':
      return 'M0,70 C300,30 900,110 1200,70 L1200,120 L0,120 Z'
    // Three softer ripples.
    case 'waves':
      return 'M0,64 C150,24 250,104 400,64 C550,24 650,104 800,64 C950,24 1050,104 1200,64 L1200,120 L0,120 Z'
    // A convex hill cresting in the middle.
    case 'curve':
      return 'M0,110 C300,20 900,20 1200,110 L1200,120 L0,120 Z'
    // A concave scoop dipping in the middle.
    case 'curveDown':
      return 'M0,20 C300,110 900,110 1200,20 L1200,120 L0,120 Z'
    // A clean diagonal rising left-to-right.
    case 'slope':
      return 'M0,120 L1200,20 L1200,120 Z'
    // A clean diagonal falling left-to-right.
    case 'slopeDown':
      return 'M0,20 L1200,120 L0,120 Z'
    // A subtle tilt — a shallow diagonal band.
    case 'tilt':
      return 'M0,96 L1200,40 L1200,120 L0,120 Z'
    // A wide soft arch (half-ellipse) rising from the edges.
    case 'arch':
      return 'M0,120 C0,40 1200,40 1200,120 Z'
    // A single broad rounded bump, flatter at the sides.
    case 'round':
      return 'M0,120 C400,120 360,30 600,30 C840,30 800,120 1200,120 Z'
    // A soft rounded peak in the centre.
    case 'peak':
      return 'M0,120 C420,110 480,30 600,30 C720,30 780,110 1200,120 Z'
    // Gentle hanging drips along the bottom edge.
    case 'drip':
      return 'M0,40 L1200,40 L1200,80 C1140,80 1140,120 1080,120 C1020,120 1020,80 960,80 C900,80 900,120 840,120 C780,120 780,80 720,80 C660,80 660,120 600,120 C540,120 540,80 480,80 C420,80 420,120 360,120 C300,120 300,80 240,80 C180,80 180,120 120,120 C60,120 60,80 0,80 Z'
    // A bold single wave (the default).
    case 'wave':
    default:
      return 'M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z'
  }
}

// A gradient (used for box/button/text fills and the page background). `from`/`to`
// describe the simple two-stop case; `stops` (when present, 2-6 entries) describes a
// multi-stop gradient and takes precedence. `from`/`to` are kept in sync with the
// first/last stop so older readers and the two-stop fallback keep working.
export type GradientKind = 'linear' | 'radial' | 'conic'
export const GRADIENT_KINDS: GradientKind[] = ['linear', 'radial', 'conic']
export const MAX_GRADIENT_STOPS = 6
export interface GradientStop {
  color: string // hex
  at: number // position along the gradient, 0-100
}
export interface Gradient {
  from: string // hex
  to: string // hex
  angle: number // degrees 0-360 (the angle for linear/conic)
  kind?: GradientKind // linear (default), radial, or conic
  stops?: GradientStop[] // 2-6 colour stops; overrides from/to when present
}
// A gentle whole-page enter animation played when a visitor lands on / navigates to a page.
export type PageTransitionKind = 'fade' | 'slide' | 'none'
export const PAGE_TRANSITION_KINDS: PageTransitionKind[] = ['fade', 'slide', 'none']

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'difference' | 'soft-light'
export const BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'soft-light']

// Non-destructive photo adjustments, applied as a CSS filter at render time.
// brightness/contrast/saturate are percentages (100 = unchanged); blur is px;
// grayscale/sepia are percentages (0 = off).
export interface ImageAdjust {
  brightness?: number
  contrast?: number
  saturate?: number
  blur?: number
  grayscale?: number
  sepia?: number
}
export function filterCss(a?: ImageAdjust | null): string | undefined {
  if (!a) return undefined
  const parts: string[] = []
  if (a.brightness !== undefined && a.brightness !== 100) parts.push(`brightness(${a.brightness}%)`)
  if (a.contrast !== undefined && a.contrast !== 100) parts.push(`contrast(${a.contrast}%)`)
  if (a.saturate !== undefined && a.saturate !== 100) parts.push(`saturate(${a.saturate}%)`)
  if (a.blur) parts.push(`blur(${a.blur}px)`)
  if (a.grayscale) parts.push(`grayscale(${a.grayscale}%)`)
  if (a.sepia) parts.push(`sepia(${a.sepia}%)`)
  return parts.length ? parts.join(' ') : undefined
}

// How an element animates into view as the visitor scrolls to it, and how it reacts to hover.
export type RevealKind = 'fade' | 'up' | 'down' | 'left' | 'right' | 'zoom'
export type HoverKind = 'grow' | 'lift' | 'glow' | 'dim' | 'rotate'
export const REVEAL_KINDS: RevealKind[] = ['fade', 'up', 'down', 'left', 'right', 'zoom']
export const HOVER_KINDS: HoverKind[] = ['grow', 'lift', 'glow', 'dim', 'rotate']

// A drop shadow preset for boxes, buttons and photos (depth, or a soft glow).
export type ShadowKind = 'sm' | 'md' | 'lg' | 'xl' | 'glow'
export const SHADOW_KINDS: ShadowKind[] = ['sm', 'md', 'lg', 'xl', 'glow']

// A custom pointer cursor shown when hovering an element on the published page.
export type CursorKind = 'pointer' | 'grab' | 'zoom-in' | 'crosshair' | 'help'
export const CURSOR_KINDS: CursorKind[] = ['pointer', 'grab', 'zoom-in', 'crosshair', 'help']
export function shadowCss(s?: ShadowKind): string | undefined {
  switch (s) {
    case 'sm': return '0 1px 3px rgba(0,0,0,0.14)'
    case 'md': return '0 4px 12px rgba(0,0,0,0.16)'
    case 'lg': return '0 10px 30px rgba(0,0,0,0.20)'
    case 'xl': return '0 22px 55px rgba(0,0,0,0.26)'
    case 'glow': return '0 0 26px rgba(255,255,255,0.55)'
    default: return undefined
  }
}

// CSS for a gradient, or undefined when it isn't valid. Prefers the multi-stop list
// (sorted by position so the rendered order is always correct, regardless of edit
// order); falls back to the two-stop from/to.
export function gradientCss(g?: Gradient | null): string | undefined {
  if (!g) return undefined
  let stopStr: string
  if (g.stops && g.stops.length >= 2) {
    stopStr = [...g.stops].sort((p, q) => p.at - q.at).map(s => `${s.color} ${s.at}%`).join(', ')
  } else if (g.from && g.to) {
    stopStr = `${g.from}, ${g.to}`
  } else {
    return undefined
  }
  const a = g.angle ?? 90
  if (g.kind === 'radial') return `radial-gradient(circle, ${stopStr})`
  if (g.kind === 'conic') return `conic-gradient(from ${a}deg, ${stopStr})`
  return `linear-gradient(${a}deg, ${stopStr})`
}

// The page-background CSS for a canvas (colour / gradient / photo), faded by bgOpacity.
// Fading is a white overlay painted over the background image (or blended into a solid),
// so at 100% (or undefined) the result is byte-identical to no fade. Pass the four bg
// fields; returns the background style props to spread onto the page root.
export function pageBackground(canvas: { bg?: string; bgGradient?: Gradient | null; bgImage?: string; bgOpacity?: number }): {
  background?: string
  backgroundImage?: string
  backgroundSize?: string
  backgroundPosition?: string
} {
  const o = canvas.bgOpacity == null ? 100 : Math.max(0, Math.min(100, canvas.bgOpacity))
  const fade = (100 - o) / 100
  const overlay = fade > 0 ? `linear-gradient(rgba(255,255,255,${fade}), rgba(255,255,255,${fade}))` : ''
  if (canvas.bgImage) {
    const img = `url('${canvas.bgImage}')`
    return { backgroundImage: overlay ? `${overlay}, ${img}` : img, backgroundSize: 'cover', backgroundPosition: 'center' }
  }
  const grad = gradientCss(canvas.bgGradient)
  if (grad) return overlay ? { backgroundImage: `${overlay}, ${grad}` } : { backgroundImage: grad }
  if (canvas.bg) return overlay ? { background: canvas.bg, backgroundImage: overlay } : { background: canvas.bg }
  return {}
}

export interface CanvasElement {
  id: string
  type: CanvasElementType
  x: number // left, design px
  y: number // top, design px
  w: number // width, design px
  h: number // height, design px
  z?: number // layer order (higher = front)
  rotate?: number // rotation in degrees (-180..180)
  opacity?: number // 0-100
  locked?: boolean // can't be moved/resized/deleted on the canvas (only via the Layers panel)
  hidden?: boolean // kept in the design but not shown on the published page (any device)
  pin?: 'footer' // anchored to the bottom: y is measured down from the end of the body content, so it always sits at the very bottom as the page grows
  // (header needs no pin — the top never moves; just place elements at the top)
  groupId?: string // elements sharing a groupId select and move together as a group
  // --- per-phone overrides (used only when the page's mobile layout is 'custom') ---
  mx?: number // mobile left, design px on MOBILE_W
  my?: number // mobile top
  mw?: number // mobile width
  mh?: number // mobile height
  mHidden?: boolean // shown on desktop but hidden on phones
  mFontSize?: number // a phone-specific text/button font size (design px)
  // text / button
  text?: string
  fontSize?: number // design px
  color?: string
  align?: SiteAlign
  bold?: boolean
  weight?: number // explicit font-weight (100-900); when set it overrides bold
  italic?: boolean
  fontFamily?: string // 'display' | 'body' | 'label', or 'custom:<fontId>' for an uploaded font
  letterSpacing?: number // design px (can be negative)
  lineHeight?: number // unitless multiplier (0.8-4)
  // Image fill for a text element: a photo/texture clipped into the letters (a text mask),
  // like the gradient-clip text but with an image. A data-URL image or an https URL, gated
  // identically to an image element's `src` (dataOrHttp). Precedence: textImage > gradient > solid.
  textImage?: string
  dropCap?: boolean // enlarge the first letter of a text block
  styleRef?: string // the element's TYPE: a global text-style key (TEXT_STYLE_KEYS). The element follows this type's style; editing the type re-syncs this element EXCEPT for properties listed in styleOverrides.
  styleOverrides?: string[] // the SYNCED_TYPO prop keys (fontSize/fontFamily/weight/italic/lineHeight/letterSpacing/color) the owner has individually customised on THIS element. A type-style change never touches these; "Reset to type" clears them. Editor-only metadata — the render still uses the element's own resolved props.
  href?: string
  ctaType?: CtaType
  // Pay button (a 'button' element with ctaType 'pay'): the price the visitor is charged via
  // Stripe Connect. payAmount is in CENTS (server-authoritative — the checkout endpoint reads
  // it from the SAVED element, never from the client). Only meaningful when ctaType === 'pay'.
  payAmount?: number // price in cents
  payCurrency?: string // lowercase ISO code (eur/usd/gbp/cad/aud); defaults to 'eur'
  payProduct?: string // the line-item name shown at checkout / stored on the sale
  newTab?: boolean // open this element's link in a new browser tab
  anchorTo?: string // id of another element on the page to smooth-scroll to (a "jump link")
  // image
  src?: string
  fit?: ImageFit
  alt?: string // image alt text (accessibility + SEO)
  adjust?: ImageAdjust // non-destructive photo adjustments (CSS filter)
  lightbox?: boolean // clicking the image opens it full-screen
  // carousel
  slides?: string[] // image data URLs for a 'carousel' element
  interval?: number // auto-advance seconds (0 = manual only)
  // freehand drawing: SVG path 'd' strings normalised to a 0..1000 viewBox; `color` is the
  // stroke colour, `strokeW` the stroke width in viewBox units.
  paths?: string[]
  strokeW?: number
  // Flow Groups (layout engine). On a 'group' element: `flow` is the layout config + optional
  // sizeW/sizeH ('fixed' fixed box, 'hug' shrink-to-content, 'fill' stretch). On a CHILD of a
  // group: `parentId` is the owning group's id (the child then flows instead of being absolute).
  parentId?: string
  flow?: FlowConfig
  sizeW?: 'fixed' | 'hug' | 'fill'
  sizeH?: 'fixed' | 'hug' | 'fill'
  // shape divider
  shape?: ShapeKind
  // full-width section divider ('divider' type): which organic separator + whether to mirror it.
  // The shape is coloured by the element's `fill` (hex or a brand token); flipX/flipY mirror it.
  dividerShape?: DividerKind
  flipX?: boolean
  flipY?: boolean
  // icon (a recolourable line/fill icon — `icon` is a key in lib/sites/icons.tsx; `color` tints it)
  icon?: string
  // page menu
  menuStyle?: MenuStyle
  // embed (video / map): a pasted YouTube/Vimeo/Maps URL; render resolves it to a safe iframe
  embedUrl?: string
  // Custom HTML (an 'html' element): raw HTML the owner pastes (e.g. an AI-designed page);
  // renders in a sandboxed srcdoc iframe. Size-capped on save. Not sanitized (owner-trusted).
  html?: string
  // Uploaded video (an 'embed' element): a stored https URL on OUR Supabase `site-videos` bucket,
  // played as a native <video>. When present it WINS over embedUrl at render. The upload goes
  // browser→Storage directly (see createVideoUploadUrl), so the file never passes through the page
  // JSON. videoPoster is an optional still shown before playback (gated like an image src).
  videoUrl?: string
  videoAutoplay?: boolean // play on load (forces muted — browsers block unmuted autoplay)
  videoLoop?: boolean // loop when it ends
  videoMuted?: boolean // start muted (ignored when autoplay, which is always muted)
  videoPoster?: string // an optional poster image (https/data URL)
  // form: the fields a visitor fills in (falls back to Name/Email/Message)
  fields?: FormField[]
  // box / button / image shared
  fill?: string
  gradient?: Gradient // a two-stop fill gradient (overrides fill on box/button)
  radius?: number // corner radius, design px
  borderColor?: string
  borderWidth?: number
  shadow?: ShadowKind // a drop shadow (box/button/image)
  blend?: BlendMode // mix-blend-mode against what's behind it
  cursor?: CursorKind // custom pointer cursor on hover (published page)
  // motion (applied on the published page, not while editing)
  reveal?: RevealKind // animate in as the visitor scrolls to it
  revealDelay?: number // ms delay before the reveal (for staggering)
  hover?: HoverKind // how it reacts to the pointer hovering over it
  parallax?: number // drift speed as the visitor scrolls (-5..5; 0 = none)
  // component instance ('component' type): which reusable component this renders
  componentId?: string
}

// A reusable component (symbol): a named mini-canvas with its own design size.
// Placed on a page as a 'component' element; every instance renders the master,
// so editing the master updates them all. Its elements never contain another
// 'component' (no nesting).
export interface SiteComponent {
  id: string
  name: string
  w: number
  h: number
  elements: CanvasElement[]
}

export interface PageCanvas {
  h: number // canvas height in design px (width is always CANVAS_W)
  width?: 'full' | 'contained' // full = the canvas spans the screen; contained = a centred column
  bg?: string // background colour
  bgGradient?: Gradient // a background gradient (used when there's no bgImage)
  bgImage?: string // full background photo
  bgOpacity?: number // 0-100; fades the page background (colour/gradient/photo) toward white
  bgVideo?: string // a full-background looping video (https URL); shown over the colour/photo
  elements: CanvasElement[]
  mobileCustom?: boolean // phones use the hand-arranged mx/my/mw/mh layout (the "Custom" mode); wins over mobileMode
  // How phones render when not Custom: 'scale' = the desktop layout scaled down to phone width
  // (the default — undefined means 'scale'), 'stack' = the automatic top-to-bottom MobileStack.
  mobileMode?: 'scale' | 'stack'
  mobileH?: number // height of the custom phone artboard in design px on MOBILE_W
  palette?: string[] // brand swatches (hex); referenced by colours as var(--brand-N)
  fonts?: SiteFont[] // uploaded brand fonts, referenced by fontFamily 'custom:<id>'
  components?: SiteComponent[] // reusable components placed via 'component' elements
  uploads?: string[] // an asset library of uploaded logos/images (data URLs) to drag onto the canvas
  fontSystem?: string // a font-bundle key (lib/sites/fonts) applied to this page's title/body/label fonts
  guidesX?: number[] // editor-only vertical guide lines (design px x); elements snap to them. Never rendered on the public page.
  guidesY?: number[] // editor-only horizontal guide lines (design px y)
  textStyles?: Record<string, TextStyleProps> // global text styles (Heading/Body/…) for this page
  // Per-role font overrides (the "Site Look" Title/Body/Accent fonts). Each value is a
  // fontFamily ('google:<Family>' | 'custom:<id>' | role) the render resolves and uses to
  // OVERRIDE that role's CSS var on the page root; '' / undefined = follow `fontSystem`.
  fontRoles?: { display?: string; body?: string; label?: string }
  // Default style for newly-added button / link elements, set in the Site Look panel so a
  // page's new buttons/links match the look. Existing elements keep their own styling.
  buttonStyle?: { fill?: string; color?: string; radius?: number; fontFamily?: string }
  linkStyle?: { color?: string; fontFamily?: string }
  banner?: SiteBanner // a dismissible announcement bar shown above the page
  popup?: SitePopup // a one-time modal shown after a delay
}

// The canonical site-wide "look": background, per-role fonts, brand colours, text styles
// and the default button/link styling. Written by applySiteLookAction (server-trusted) and
// used to seed new pages when `SiteContent.inheritLook` is on. Mirrors the per-page canvas
// look fields so "Apply to all pages" can copy them onto every page's canvas.
export interface SiteLook {
  bg?: string
  bgGradient?: Gradient | null
  bgImage?: string
  bgOpacity?: number
  fontSystem?: string
  fontRoles?: { display?: string; body?: string; label?: string }
  textStyles?: Record<string, TextStyleProps>
  palette?: string[]
  buttonStyle?: { fill?: string; color?: string; radius?: number; fontFamily?: string }
  linkStyle?: { color?: string; fontFamily?: string }
}

// A modal shown to a visitor a few seconds after arriving (once per visitor).
export interface SitePopup {
  text: string
  title?: string
  bg?: string
  color?: string
  ctaLabel?: string
  ctaHref?: string
  delay?: number // seconds before it appears (0-60)
}

// A thin announcement bar at the very top of a published page (e.g. "Free shipping
// this week"). Dismissible per visitor; reappears when the text changes.
export interface SiteBanner {
  text: string
  bg?: string
  color?: string
  href?: string // optional click-through
}

// The most images a page's upload library can hold.
export const MAX_UPLOADS = 24
// The most ruler guides a page can hold (per axis).
export const MAX_GUIDES = 24

// Where the body content ends and where footer-pinned elements anchor. The body
// height grows continuously with the content; footer-pinned elements (pin:'footer')
// are then laid out below it (their y is an offset down from bodyBottom), so a
// footer always sits at the very end of the page no matter how much content grows.
// Used identically by the editor and the public renderer so they never disagree.
export function canvasLayout(elements: CanvasElement[], minBody = 900) {
  // Breathing room below the lowest element — but a full-width band (e.g. a footer), a
  // divider, or a thin line is meant to sit flush at the page edge, so it adds none. This
  // stops a pasted full-page design (which ends in a coloured footer band) from showing a
  // strip of page background beneath it.
  const pad = (e: CanvasElement) => (e.type === 'divider' || e.w >= CANVAS_W * 0.94 || e.h <= 24 ? 0 : 80)
  const bodyBottom = Math.max(minBody, ...elements.filter(e => e.pin !== 'footer').map(e => e.y + e.h + pad(e)), 0)
  const footerEls = elements.filter(e => e.pin === 'footer')
  const footerExtent = footerEls.length ? Math.max(0, ...footerEls.map(e => e.y + e.h)) + 40 : 0
  return { bodyBottom, totalH: bodyBottom + footerExtent, hasFooter: footerEls.length > 0 }
}

// Flow Groups render helpers — the ONE place that maps a FlowConfig to CSS, used by all three
// render paths (CanvasView desktop + MobileStack + the editor) so they can never disagree.
// `cqf` is the caller's design-px→unit function (cqw on the page, cqv in the editor).
const FLEX_ALIGN = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch', between: 'space-between' } as const
export function flowContainerStyle(flow: FlowConfig, cqf: (px: number) => string): CSSProperties {
  return {
    display: 'flex',
    flexDirection: flow.dir === 'col' ? 'column' : 'row',
    gap: cqf(flow.gap),
    padding: `${cqf(flow.padY)} ${cqf(flow.padX)}`,
    alignItems: FLEX_ALIGN[flow.align],
    justifyContent: FLEX_ALIGN[flow.justify],
    flexWrap: flow.wrap ? 'wrap' : 'nowrap',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
  }
}
export function flowItemStyle(child: { w: number; h: number }, flow: FlowConfig, cqf: (px: number) => string): CSSProperties {
  const row = flow.dir !== 'col'
  const stretch = flow.align === 'stretch'
  return {
    flex: 'none',
    position: 'relative',
    width: row ? cqf(child.w) : stretch ? '100%' : cqf(child.w),
    height: row ? (stretch ? '100%' : cqf(child.h)) : cqf(child.h),
  }
}
// The ordered children of a group: every element whose parentId is this group's id, in array order.
export function flowChildren(group: CanvasElement, all: CanvasElement[]): CanvasElement[] {
  return all.filter(e => e.parentId === group.id)
}

export interface SitePage {
  id: string
  title: string
  slug: string
  navLabel?: string // the menu label (falls back to title); lets you rename without changing the URL
  hidden?: boolean // keep the page reachable by URL but out of the header menu
  headline: string
  subheadline: string
  heroImage?: string
  sections: SiteSection[]
  canvas?: PageCanvas // when present, this page is a free-canvas page (replaces sections)
  canvasHidden?: boolean // the canvas is kept but the page is shown in block mode (so switching modes never loses work)
  offline?: boolean // taken off the live site (404 + out of the menu); kept safe in the editor, reversible anytime
  fullHtml?: string // when set, this page renders as this complete raw HTML, full-page, with NO site chrome (a pasted external design). Reversible: clearing it restores the canvas/sections.
  hideChrome?: boolean // hide the built-in site header + footer on this page (e.g. a pasted full-page design in a Custom HTML box brings its own). Also auto-on when a big full-width HTML box fills the page.
  seoTitle?: string // per-page <title> / share title override
  seoDescription?: string // per-page meta description / share description override
  seoImage?: string // per-page social share image (a public https URL — data URLs don't work as og:image)
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
}

// A sellable interactive book/workbook the owner manages on the Books page. The HTML
// content itself lives in the `workbooks` table (keyed by owner + this slug); this record
// holds everything that lives in site content: price, cover, library copy, and the landing
// page (either a simple form the system renders, or the owner's own pasted HTML).
export interface WorkbookProduct {
  title: string
  priceCents: number
  currency?: string // default 'eur'
  description?: string // short line for the Resources library card + the form-landing intro
  coverImage?: string // data URL (resized) shown on the library card + landing
  tagline?: string // optional italic sub-title on the form landing
  landingMode?: 'form' | 'html' // 'form' = system renders from the fields; 'html' = owner's own
  landingBody?: string // form mode: the body, paragraphs separated by blank lines
  landingHtml?: string // html mode: the owner's raw landing HTML (pre render-safe transform)
  order?: number // library sort order (lower first)
  hidden?: boolean // keep it off the library without deleting
}

// A whole-site snapshot the owner can keep in one of a few slots and switch back to.
// `snapshot` is a full SiteContent copy WITHOUT its own savedDesigns (no nesting).
export interface SavedDesign {
  id: string
  name: string
  savedAt: string // ISO timestamp
  snapshot: SiteContent
}

export const MAX_SAVED_DESIGNS = 3

// The member portal (app.animatemple.com/me): which client-facing modules are
// enabled for this site, plus an owner-written welcome message. When unset, every
// module is treated as ON (backward-compatible default).
export interface MemberPortalConfig {
  modules?: {
    blueprint?: boolean
    bookings?: boolean
    messages?: boolean
    courses?: boolean
    memberships?: boolean
    resources?: boolean
  }
  welcome?: string // a heartfelt welcome shown on the portal home; supports {name} and {brand} tokens
  // Optional custom copy per big tile — each falls back to its built-in default.
  tiles?: {
    blueprint?: { title?: string; desc?: string }
    bookings?: { title?: string; desc?: string }
    courses?: { title?: string; desc?: string }
    memberships?: { title?: string; desc?: string }
    resources?: { title?: string; desc?: string }
  }
  emptyState?: string // shown to a client who owns nothing yet; supports {name}/{brand}
  accent?: string // optional portal accent override (#rrggbb); else inherits the site accent
}

export interface SiteContent {
  theme: SiteTheme
  accentColor?: string
  pageBg?: string // a custom background colour for the whole site (overrides the theme background)
  layout?: SiteLayout
  fontSystem?: string
  brand?: string
  brandVoice?: string // a short description of how this brand sounds; fed to every AI copy/review prompt
  pageTransition?: PageTransitionKind // a gentle enter animation applied to every published page
  logoImage?: string // a logo shown in the header instead of the brand text
  headerLogoPos?: 0 | 1 | 2 // which header zone the logo sits in (0 left, 1 centre, 2 right) when a custom header bar is used
  faviconImage?: string // the little icon shown in the browser tab
  menuPosition?: MenuPosition // where the navigation menu sits
  navLinks?: NavLink[] // extra header links added by hand (in addition to the page menu)
  headerItems?: SectionItem[] // a hand-composed header bar (logo/text/links); falls back to the default when empty
  footerItems?: SectionItem[] // a hand-composed footer row; falls back to the footer text when empty
  seoTitle?: string
  seoDescription?: string
  // The home page's fields live at the top level (legacy + mirror of pages[0]).
  headline: string
  subheadline: string
  heroImage?: string
  sections: SiteSection[]
  // The home page's call-to-action button (mirror of pages[0]).
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
  contactLabel?: string
  contactEmail: string
  bookingHost?: string // the name shown to clients on booking confirmations
  booking?: BookingCopy // editable copy for the public booking page (/book/[slug])
  footer?: string
  socials?: Social[] // social profile links in the footer
  heroOverlay?: number // darkness % (0-80) over the hero photo
  // When set, the full list of pages (pages[0] is home, slug ''). Migrated from
  // the legacy top-level fields for older single-page sites.
  pages?: SitePage[]
  // Up to MAX_SAVED_DESIGNS whole-site snapshots the owner can switch between.
  savedDesigns?: SavedDesign[]
  // The canonical "Site Look" (set via "Apply to all pages") + whether new pages inherit it.
  siteLook?: SiteLook
  inheritLook?: boolean
  // The member portal: which modules clients can see + a custom welcome message.
  memberPortal?: MemberPortalConfig
  // Sellable interactive books/workbooks, managed on the Books page. Keyed by product slug.
  workbookProducts?: Record<string, WorkbookProduct>
  // Legacy single-workbook (Tuned In) buy config, mirrored into workbookProducts['tuned-in'].
  workbookPriceCents?: number
  workbookCurrency?: string
  workbookTitle?: string
}

// Always returns the page list, migrating a legacy single-page site on the fly.
export function getPages(content: SiteContent | null): SitePage[] {
  if (content?.pages && content.pages.length) return content.pages
  return [
    {
      id: 'home',
      title: 'Home',
      slug: '',
      headline: content?.headline ?? '',
      subheadline: content?.subheadline ?? '',
      heroImage: content?.heroImage,
      sections: content?.sections ?? [],
      ctaLabel: content?.ctaLabel,
      ctaType: content?.ctaType,
      ctaHref: content?.ctaHref,
    },
  ]
}

// The structural "look" of the public booking page. Only the LAYOUT differs — every
// style uses the site's own theme/accent/fonts and the exact same booking behaviour.
// 'minimal' is the original look (day-pill strip + time grid); the others rearrange
// the same controls. Default 'minimal' everywhere it's read.
export const BOOKING_LAYOUTS = ['minimal', 'calendar', 'cards', 'split'] as const
export type BookingLayout = (typeof BOOKING_LAYOUTS)[number]
export const DEFAULT_BOOKING_LAYOUT: BookingLayout = 'minimal'
// Labels + one-line descriptions for the owner's style picker.
export const BOOKING_LAYOUT_META: Record<BookingLayout, { label: string; description: string }> = {
  minimal: { label: 'Minimal', description: 'A clean strip of days, then times — the classic look.' },
  calendar: { label: 'Calendar', description: 'Pick the day from a full month calendar.' },
  cards: { label: 'Service cards', description: 'Show your services as rich cards first.' },
  split: { label: 'Split', description: 'A two-column layout: details on the left, picker on the right.' },
}

// Editable copy for the public booking page (/book/[slug]). Every field is optional;
// the page falls back to sensible defaults when a field (or the whole object) is absent,
// so existing sites with no `booking` keep working unchanged. {brand} in successBody is
// substituted with the site's brand name when rendered.
export interface BookingCopy {
  heading?: string // the main italic display heading
  intro?: string // the muted line under the heading
  successTitle?: string // shown after a request is sent
  successBody?: string // body under the success title ({brand} → the brand name)
  closedTitle?: string // shown when booking isn't open (no services / no data)
  closedBody?: string // body under the closed title
  layout?: BookingLayout // the page LOOK (structure only); defaults to 'minimal'
}

// A stock photo search result (from the Pexels proxy). Transient — not stored.
export interface StockPhoto {
  id: string
  thumb: string // small preview URL
  url: string // the full-size CDN URL stored as the image src
  alt: string
  credit: string // photographer name
}

export interface Site {
  id: string
  ownerId: string
  name: string
  slug: string
  template: string
  status: SiteStatus
  url: string | null
  domain: string | null
  content: SiteContent | null
  // Stripe Connect (the owner's own Express account). Top-level columns, not in `content`.
  stripeAccountId: string | null
  stripeChargesEnabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateSiteInput {
  name: string
  template: string
}

export const TEMPLATES = [
  'Coming soon page',
  'Portfolio',
  'Business site',
  'Blog',
  'Blank',
] as const

// Display metadata for the template picker.
export const TEMPLATE_CARDS: { name: string; description: string; icon: string }[] = [
  { name: 'Coming soon page', description: 'A simple "launching soon" page.', icon: '✦' },
  { name: 'Portfolio', description: 'Show your work and how to reach you.', icon: '❖' },
  { name: 'Business site', description: 'Home, about, services, contact.', icon: '⌘' },
  { name: 'Blog', description: 'Write and publish posts.', icon: '✍' },
  { name: 'Blank', description: 'Start from nothing.', icon: '◇' },
]
