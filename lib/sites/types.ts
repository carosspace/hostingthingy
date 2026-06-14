export type SiteStatus = 'queued' | 'building' | 'live' | 'failed' | 'stopped'

export interface Site {
  id: string
  ownerId: string
  name: string
  slug: string
  template: string
  status: SiteStatus
  url: string | null
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
