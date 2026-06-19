import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.animatemple.com'

// Let search engines crawl the published sites (/s/...) but keep the owner
// dashboard and auth routes out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/account', '/sites', '/bookings', '/messages', '/login', '/auth', '/preview'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}
