export type SiteStatus = 'queued' | 'building' | 'live' | 'failed' | 'stopped'

export interface SiteSection {
  heading: string
  body: string
  image?: string // an inline image shown above the section text
  bgImage?: string // a full-width background photo behind the section (text overlaid)
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
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

export interface SitePage {
  id: string
  title: string
  slug: string
  headline: string
  subheadline: string
  heroImage?: string
  sections: SiteSection[]
  ctaLabel?: string
  ctaType?: CtaType
  ctaHref?: string
}

export interface SiteContent {
  theme: SiteTheme
  accentColor?: string
  layout?: SiteLayout
  brand?: string
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
  footer?: string
  // When set, the full list of pages (pages[0] is home, slug ''). Migrated from
  // the legacy top-level fields for older single-page sites.
  pages?: SitePage[]
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
