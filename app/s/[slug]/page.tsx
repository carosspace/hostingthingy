import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getPages } from '@/lib/sites/types'
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
  const share = home.seoImage || (home.heroImage && home.heroImage.startsWith('http') ? home.heroImage : undefined)
  const img = share && share.startsWith('http') ? [share] : undefined
  return {
    title,
    description,
    icons: c?.faviconImage ? { icon: c.faviconImage } : undefined,
    openGraph: { title, description, images: img, type: 'website' },
    twitter: { card: 'summary_large_image', title, description, images: img },
  }
}

export default async function HomePage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const pages = getPages(site.content)
  const home = pages.find(p => p.slug === '') ?? pages[0]

  return (
    <PublicPage
      siteSlug={site.slug}
      siteName={site.name}
      content={site.content}
      page={home}
      pages={pages}
      currentSlug={home.slug}
    />
  )
}
