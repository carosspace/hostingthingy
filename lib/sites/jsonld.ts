import type { PublicSite } from './public'
import { getPages, type SitePage } from './types'

// Build a schema.org JSON-LD graph for a published page. Always emits the
// site Organization + WebSite; on a sub-page it adds a WebPage + breadcrumb.
// The returned string is escaped so it is safe inside a <script> tag.
export function jsonLd(site: PublicSite, page: SitePage, base: string): string {
  const c = site.content
  const brand = c?.brand || site.name
  const siteUrl = `${base}/s/${site.slug}`
  const pages = getPages(c)
  const home = pages.find(p => p.slug === '') ?? pages[0]
  const siteDesc = c?.seoDescription || home?.subheadline || home?.headline || brand
  const logo = c?.logoImage && c.logoImage.startsWith('http') ? c.logoImage : undefined
  const sameAs = (c?.socials ?? []).map(s => s.url).filter(u => /^https?:\/\//i.test(u))

  const org: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${siteUrl}#org`,
    name: brand,
    url: siteUrl,
  }
  if (logo) org.logo = logo
  if (siteDesc) org.description = siteDesc
  if (sameAs.length) org.sameAs = sameAs

  const website: Record<string, unknown> = {
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    name: brand,
    url: siteUrl,
    publisher: { '@id': `${siteUrl}#org` },
  }
  if (siteDesc) website.description = siteDesc

  const graph: Record<string, unknown>[] = [website, org]

  if (page.slug !== '') {
    const pageUrl = `${siteUrl}/${page.slug}`
    const pageDesc = page.seoDescription || page.subheadline || siteDesc
    const webPage: Record<string, unknown> = {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: page.seoTitle || page.title || page.headline || brand,
      isPartOf: { '@id': `${siteUrl}#website` },
    }
    if (pageDesc) webPage.description = pageDesc
    graph.push(webPage)
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: page.navLabel || page.title || page.headline || 'Page', item: pageUrl },
      ],
    })
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}
