export type SiteStatus = 'queued' | 'building' | 'live' | 'failed' | 'stopped'

export interface SiteSection {
  heading: string
  body: string
}

export interface SiteContent {
  headline: string
  subheadline: string
  sections: SiteSection[]
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
