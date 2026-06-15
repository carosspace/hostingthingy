import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getPages } from '@/lib/sites/types'
import PublicPage from '../PublicPage'

export const dynamic = 'force-dynamic'

export default async function SubPage({ params }: { params: { slug: string; page: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const pages = getPages(site.content)
  const page = pages.find(p => p.slug === params.page)
  if (!page) notFound()

  return (
    <PublicPage
      siteSlug={site.slug}
      siteName={site.name}
      content={site.content}
      page={page}
      pages={pages}
      currentSlug={page.slug}
    />
  )
}
