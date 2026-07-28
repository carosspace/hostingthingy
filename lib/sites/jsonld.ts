import type { PublicSite } from './public'
import { getPages, type SitePage } from './types'

// Build a schema.org JSON-LD graph for a published page. Always emits the
// site Organization + WebSite; on a sub-page it adds a WebPage + breadcrumb.
// The returned string is escaped so it is safe inside a <script> tag.
export function jsonLd(site: PublicSite, page: SitePage, base: string): string {
  const c = site.content
  const brand = c?.brand || site.name
  // Match the canonical URL exactly (metadata uses `${base}/${slug}`). Pointing the graph at
  // the internal /s/<slug>/… path instead described a different address than the one being
  // indexed, which muddies how the pages are understood.
  const siteUrl = base
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

    // A page that sells one of the owner's products is a Product, not just a WebPage —
    // that's what lets search results carry the price and availability. Sale price wins,
    // mirroring what the buy route actually charges.
    const product = c?.workbookProducts?.[page.slug]
    if (product && product.access !== 'free' && product.access !== 'members') {
      const full = Number(product.priceCents)
      const sale = Number(product.salePriceCents)
      const cents = Number.isInteger(sale) && sale >= 100 && sale < full ? sale : full
      if (Number.isInteger(cents) && cents >= 100) {
        const offer: Record<string, unknown> = {
          '@type': 'Offer',
          price: (cents / 100).toFixed(2),
          priceCurrency: (product.currency || 'eur').toUpperCase(),
          availability: 'https://schema.org/InStock',
          url: pageUrl,
        }
        const prod: Record<string, unknown> = {
          '@type': 'Product',
          '@id': `${pageUrl}#product`,
          name: product.title || page.title || brand,
          brand: { '@type': 'Brand', name: brand },
          offers: offer,
        }
        const pd = product.description || pageDesc
        if (pd) prod.description = pd
        const img = page.seoImage || c?.seoImage
        if (img && img.startsWith('http')) prod.image = img
        graph.push(prod)
      }
    }
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c')
}
