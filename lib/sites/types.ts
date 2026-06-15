export type SiteStatus = 'queued' | 'building' | 'live' | 'failed' | 'stopped'

export interface SiteSection {
  heading: string
  body: string
}

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

export interface SiteContent {
  theme: SiteTheme
  headline: string
  subheadline: string
  sections: SiteSection[]
  contactEmail: string
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
