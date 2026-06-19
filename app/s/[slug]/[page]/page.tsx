import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getPages } from '@/lib/sites/types'
import { jsonLd } from '@/lib/sites/jsonld'
import { siteBaseUrl } from '@/lib/sites/baseurl'
import PublicPage from '../PublicPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string; page: string } }): Promise<Metadata> {
  const site = await getPublicSite(params.slug)
  if (!site) return {}
  const c = site.content
  const brand = c?.brand || site.name
  const page = getPages(c).find(p => p.slug === params.page)
  if (!page) return {}
  const title = page.seoTitle || `${page.title || page.headline || 'Page'} · ${c?.seoTitle || brand}`
  const description = page.seoDescription || c?.seoDescription || page.subheadline || brand
  const share = page.seoImage || (page.heroImage && page.heroImage.startsWith('http') ? page.heroImage : undefined)
  const img = share && share.startsWith('http') ? [share] : undefined
  return {
    title,
    description,
    icons: c?.faviconImage ? { icon: c.faviconImage } : undefined,
    openGraph: { title, description, images: img, type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: img },
  }
}

export default async function SubPage({ params }: { params: { slug: string; page: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const pages = getPages(site.content)
  const page = pages.find(p => p.slug === params.page)
  if (!page) notFound()

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(site, page, siteBaseUrl()) }} />
      <PublicPage
        siteSlug={site.slug}
        siteName={site.name}
        content={site.content}
        page={page}
        pages={pages}
        currentSlug={page.slug}
      />
    </>
  )
}
