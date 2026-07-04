import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getPages } from '@/lib/sites/types'
import { jsonLd } from '@/lib/sites/jsonld'
import { siteBaseUrl } from '@/lib/sites/baseurl'
import PublicPage from './PublicPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const site = await getPublicSite(params.slug)
  if (!site) return {}
  const c = site.content
  const brand = c?.brand || site.name
  const pages = getPages(c)
  const home = pages.find(p => p.slug === '') ?? pages[0]
  const title = home.seoTitle || c?.seoTitle || (home.headline ? `${brand} — ${home.headline}` : brand)
  const description = home.seoDescription || c?.seoDescription || home.subheadline || brand
  const siteShare = (c as Record<string, unknown> | null)?.seoImage
  const share = home.seoImage || (home.heroImage && home.heroImage.startsWith('http') ? home.heroImage : undefined) || (typeof siteShare === 'string' ? siteShare : undefined)
  const img = share && share.startsWith('http') ? [share] : undefined
  const canonical = siteBaseUrl()
  return {
    title,
    description,
    alternates: { canonical },
    icons: c?.faviconImage ? { icon: c.faviconImage } : undefined,
    openGraph: { title, description, url: canonical, images: img, type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: img },
  }
}

export default async function HomePage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const pages = getPages(site.content)
  const home = pages.find(p => p.slug === '') ?? pages[0]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(site, home, siteBaseUrl()) }} />
      <PublicPage
        siteSlug={site.slug}
        siteName={site.name}
        content={site.content}
        page={home}
        pages={pages}
        currentSlug={home.slug}
      />
    </>
  )
}
