import type { MetadataRoute } from 'next'
import { listPublicPages } from '@/lib/sites/public'
import { siteBaseUrl } from '@/lib/sites/baseurl'

export const dynamic = 'force-dynamic'

// Lists every live site and its pages. Until migration 008 is run (or if the DB
// is unreachable) it degrades to just the platform root.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = siteBaseUrl()
  let sites: Awaited<ReturnType<typeof listPublicPages>> = []
  try {
    sites = await listPublicPages()
  } catch {
    sites = []
  }

  const entries: MetadataRoute.Sitemap = [{ url: BASE, changeFrequency: 'weekly' }]
  for (const s of sites) {
    if (!s.slug) continue
    const lastModified = s.updatedAt ? new Date(s.updatedAt) : undefined
    const slugs = Array.from(new Set(s.pageSlugs.length ? s.pageSlugs : ['']))
    for (const p of slugs) {
      entries.push({
        url: p === '' ? `${BASE}/s/${s.slug}` : `${BASE}/s/${s.slug}/${p}`,
        lastModified,
        changeFrequency: 'weekly',
      })
    }
  }
  return entries
}
