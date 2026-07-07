import { getCurrentUser } from '@/lib/auth'
import { listSites } from '@/lib/sites/store'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { listOwnerProducts } from '@/lib/workbooks/products'
import BooksManager, { type ProductInput } from './BooksManager'

export const dynamic = 'force-dynamic'

export default async function BooksPage() {
  const user = await getCurrentUser()

  const sites = await listSites().catch(() => [])
  const site = sites.find(s => s.slug === PORTAL_SITE_SLUG) || sites[0]

  const listed = site && user
    ? await listOwnerProducts(user.id, site.content).catch(() => ({ products: [], workbooksOk: false }))
    : { products: [], workbooksOk: false }
  const products: ProductInput[] = listed.products.map(p => ({
    slug: p.slug, title: p.title, priceCents: p.priceCents, currency: p.currency,
    description: p.description, coverImage: p.coverImage, tagline: p.tagline,
    landingMode: p.landingMode, landingBody: p.landingBody, landingHtml: p.landingHtml,
    hidden: p.hidden, hasContent: p.hasContent, updatedAt: p.updatedAt,
  }))

  const siteBase = site?.domain ? `https://${site.domain}` : 'https://animatemple.com'

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Books</h1>
        <p className="font-body text-ash mt-2 text-sm leading-relaxed max-w-xl">
          Everything for each book you sell, in one place — the price, a cover picture, the interactive workbook file,
          and the landing page. Save, and it all goes live: the card in your Resources library, the sales page, and
          the Buy button. Add a new one anytime.
        </p>
      </section>

      {!site ? (
        <p className="font-body text-ash/60 text-sm">No website found on your account yet.</p>
      ) : (
        <BooksManager products={products} siteBase={siteBase} />
      )}
    </div>
  )
}
