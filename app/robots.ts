import type { MetadataRoute } from 'next'
import { siteBaseUrl } from '@/lib/sites/baseurl'

export const dynamic = 'force-dynamic'

// Let search engines crawl the published sites (/s/...) but keep the owner
// dashboard and auth routes out of the index.
export default function robots(): MetadataRoute.Robots {
  const BASE = siteBaseUrl()
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/account', '/sites', '/bookings', '/messages', '/login', '/auth', '/preview'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
