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

export type CanvasElementType = 'text' | 'image' | 'button' | 'box' | 'menu'

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
  // --- per-phone overrides (used only when the page's mobile layout is 'custom') ---
  mx?: number // mobile left, design px on MOBILE_W
  my?: number // mobile top
  mw?: number // mobile width
  mh?: number // mobile height
  mHidden?: boolean // shown on desktop but hidden on phones
  // text / button
  text?: string
  fontSize?: number // design px
  color?: string
  align?: SiteAlign
  bold?: boolean
  italic?: boolean
  fontFamily?: 'display' | 'body' | 'label'
  href?: string
  ctaType?: CtaType
  // image
  src?: string
  fit?: ImageFit
  // box / button / image shared
  fill?: string
  radius?: number // corner radius, design px
  borderColor?: string
  borderWidth?: number
}

export interface PageCanvas {
  h: number // canvas height in design px (width is always CANVAS_W)
  width?: 'full' | 'contained' // full = the canvas spans the screen; contained = a centred column
  bg?: string // background colour
  bgImage?: string // full background photo
  elements: CanvasElement[]
  mobileCustom?: boolean // phones use the hand-arranged mx/my/mw/mh layout (else auto-stack)
  mobileH?: number // height of the custom phone artboard in design px on MOBILE_W
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
