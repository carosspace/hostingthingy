import type { MetadataRoute } from 'next'
import { listPublicPages, siteSlugForDomain } from '@/lib/sites/public'
import { siteBaseUrl } from '@/lib/sites/baseurl'

export const dynamic = 'force-dynamic'

// Lists every live site and its pages. On a CUSTOM DOMAIN (e.g. animatemple.com) the sitemap
// belongs to the single site mapped to that host and uses CLEAN URLs (BASE/page) — not the
// internal /s/<slug>/<page> paths (which would be duplicate, ugly, non-canonical). On the
// platform host it lists every live site with its /s/<slug> URLs. Degrades to the root if the
// DB is unreachable / migration 008 isn't run.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const BASE = siteBaseUrl()
  const host = BASE.replace(/^https?:\/\//, '').replace(/\/.*$/, '')

  let sites: Awaited<ReturnType<typeof listPublicPages>> = []
  try {
    sites = await listPublicPages()
  } catch {
    sites = []
  }

  let domainSlug: string | null = null
  try {
    domainSlug = await siteSlugForDomain(host)
  } catch {
    domainSlug = null
  }

  // --- Custom domain: one site, clean URLs -------------------------------------------------
  if (domainSlug) {
    const site = sites.find(s => s.slug === domainSlug)
    const lastModified = site?.updatedAt ? new Date(site.updatedAt) : undefined
    const slugs = Array.from(new Set(site?.pageSlugs.length ? site.pageSlugs : ['']))
    const entries: MetadataRoute.Sitemap = [{ url: BASE, lastModified, changeFrequency: 'weekly' }]
    for (const p of slugs) {
      if (p === '') continue // home already added as BASE
      entries.push({ url: `${BASE}/${p}`, lastModified, changeFrequency: 'weekly' })
    }
    return entries
  }

  // --- Platform host: every live site, internal /s/<slug> URLs ------------------------------
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
