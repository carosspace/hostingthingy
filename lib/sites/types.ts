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

// A call-to-action button. 'booking' links to the site's /book page,
// 'email' opens a mail to the contact address, 'link' uses ctaHref, 'none' hides it.
export type CtaType = 'booking' | 'email' | 'link' | 'none'

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

export type CanvasElementType = 'text' | 'image' | 'button' | 'box' | 'menu' | 'carousel' | 'shape' | 'icon' | 'component' | 'form' | 'embed' | 'draw'

// Global text styles: define Heading/Body/etc. once and apply to many text elements.
// A text element references a style via `styleRef`; editing the style re-syncs every
// element that uses it (the sync happens in the editor, so the renderer is unchanged —
// elements always carry their own resolved typography).
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
export type ShapeKind = 'line' | 'wave' | 'curve' | 'tilt' | 'triangle' | 'hill' | 'zigzag'
export const SHAPE_KINDS: ShapeKind[] = ['line', 'wave', 'curve', 'tilt', 'triangle', 'hill', 'zigzag']
export function shapePath(k?: ShapeKind): string {
  switch (k) {
    case 'line': return 'M0,46 L100,46 L100,54 L0,54 Z'
    case 'curve': return 'M0,100 C30,30 70,30 100,100 Z'
    case 'tilt': return 'M0,100 L100,0 L100,100 Z'
    case 'triangle': return 'M0,100 L50,0 L100,100 Z'
    case 'hill': return 'M0,100 C40,0 60,0 100,100 Z'
    case 'zigzag': return 'M0,100 L20,45 L40,100 L60,45 L80,100 L100,45 L100,100 Z'
    case 'wave':
    default: return 'M0,60 C25,95 75,25 100,60 L100,100 L0,100 Z'
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
  dropCap?: boolean // enlarge the first letter of a text block
  styleRef?: string // a global text-style key (TEXT_STYLE_KEYS); editing that style re-syncs this element
  href?: string
  ctaType?: CtaType
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
  // shape divider
  shape?: ShapeKind
  // icon (a recolourable line/fill icon — `icon` is a key in lib/sites/icons.tsx; `color` tints it)
  icon?: string
  // page menu
  menuStyle?: MenuStyle
  // embed (video / map): a pasted YouTube/Vimeo/Maps URL; render resolves it to a safe iframe
  embedUrl?: string
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
  mobileCustom?: boolean // phones use the hand-arranged mx/my/mw/mh layout (else auto-stack)
  mobileH?: number // height of the custom phone artboard in design px on MOBILE_W
  palette?: string[] // brand swatches (hex); referenced by colours as var(--brand-N)
  fonts?: SiteFont[] // uploaded brand fonts, referenced by fontFamily 'custom:<id>'
  components?: SiteComponent[] // reusable components placed via 'component' elements
  uploads?: string[] // an asset library of uploaded logos/images (data URLs) to drag onto the canvas
  fontSystem?: string // a font-bundle key (lib/sites/fonts) applied to this page's title/body/label fonts
  guidesX?: number[] // editor-only vertical guide lines (design px x); elements snap to them. Never rendered on the public page.
  guidesY?: number[] // editor-only horizontal guide lines (design px y)
  textStyles?: Record<string, TextStyleProps> // global text styles (Heading/Body/…) for this page
  banner?: SiteBanner // a dismissible announcement bar shown above the page
  popup?: SitePopup // a one-time modal shown after a delay
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
  const bodyBottom = Math.max(minBody, ...elements.filter(e => e.pin !== 'footer').map(e => e.y + e.h + 80), 0)
  const footerEls = elements.filter(e => e.pin === 'footer')
  const footerExtent = footerEls.length ? Math.max(0, ...footerEls.map(e => e.y + e.h)) + 40 : 0
  return { bodyBottom, totalH: bodyBottom + footerExtent, hasFooter: footerEls.length > 0 }
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
  seoTitle?: string // per-page <title> / share title override
  seoDescription?: string // per-page meta description / share description override
  seoImage?: string // per-page social share image (a public https URL — data URLs don't work as og:image)
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
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
  footer?: string
  socials?: Social[] // social profile links in the footer
  heroOverlay?: number // darkness % (0-80) over the hero photo
  // When set, the full list of pages (pages[0] is home, slug ''). Migrated from
  // the legacy top-level fields for older single-page sites.
  pages?: SitePage[]
  // Up to MAX_SAVED_DESIGNS whole-site snapshots the owner can switch between.
  savedDesigns?: SavedDesign[]
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
