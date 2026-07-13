import { getCurrentUser } from '@/lib/auth'
import { listSites } from '@/lib/sites/store'
import { listTiers } from '@/lib/memberships/repo'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { listOwnerProducts } from '@/lib/workbooks/products'
import BooksManager, { type ProductInput } from './BooksManager'

export const dynamic = 'force-dynamic'

export default async function ResourcesManagerPage() {
  const user = await getCurrentUser()

  const sites = await listSites().catch(() => [])
  const site = sites.find(s => s.slug === PORTAL_SITE_SLUG) || sites[0]
  const tiers = await listTiers().catch(() => [])

  const listed = site && user
    ? await listOwnerProducts(user.id, site.content).catch(() => ({ products: [], workbooksOk: false }))
    : { products: [], workbooksOk: false }
  const products: ProductInput[] = listed.products.map(p => ({
    slug: p.slug, title: p.title, kind: p.kind, access: p.access, tierId: p.tierId,
    priceCents: p.priceCents, salePriceCents: p.salePriceCents, currency: p.currency,
    description: p.description, coverImage: p.coverImage, tagline: p.tagline,
    landingMode: p.landingMode, landingBody: p.landingBody, landingHtml: p.landingHtml,
    fileName: p.fileName, mime: p.mime, companionFileName: p.companionFileName, hasCompanion: p.hasCompanion,
    hidden: p.hidden, hasContent: p.hasContent, updatedAt: p.updatedAt,
  }))

  const siteBase = site?.domain ? `https://${site.domain}` : 'https://animatemple.com'

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Resources</h1>
        <p className="font-body text-ash mt-2 text-sm leading-relaxed max-w-xl">
          Everything you offer, in one place — interactive workbooks, ebooks, guided meditations, PDFs. For each one
          set a title, a cover, a description, and whether it’s free, members-only, or sold (with an optional reduced
          price). Save, and it all goes live: the card in your library, its page, the Buy button, and delivery to your
          people. Add or delete anytime.
        </p>
      </section>

      {!site ? (
        <p className="font-body text-ash/60 text-sm">No website found on your account yet.</p>
      ) : (
        <BooksManager products={products} siteBase={siteBase} tiers={tiers.map(t => ({ id: t.id, name: t.name }))} />
      )}
    </div>
  )
}
