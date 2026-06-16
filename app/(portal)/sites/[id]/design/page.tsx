import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import { getPages, type SiteContent } from '@/lib/sites/types'
import { generateSiteAction, addPageAction, removePageAction } from '../../actions'
import LiveEditor from './LiveEditor'

export const dynamic = 'force-dynamic'

export default async function DesignPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { page?: string }
}) {
  const site = await getSite(params.id)

  if (!site) {
    return (
      <div className="space-y-6">
        <p className="font-body text-ash">This website couldn&rsquo;t be found.</p>
        <Link href="/sites" className="font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
          ← Back to sites
        </Link>
      </div>
    )
  }

  const c = site.content
  const pages = getPages(c)
  const currentSlug = typeof searchParams.page === 'string' ? searchParams.page : ''
  const current = pages.find(p => p.slug === currentSlug) ?? pages[0]

  // The editor edits one page at a time: site-wide fields + the current page's fields.
  const pageView: SiteContent = {
    theme: c?.theme ?? 'sand',
    accentColor: c?.accentColor,
    brand: c?.brand,
    seoTitle: c?.seoTitle,
    seoDescription: c?.seoDescription,
    headline: current.headline,
    subheadline: current.subheadline,
    heroImage: current.heroImage,
    sections: current.sections,
    ctaLabel: current.ctaLabel,
    ctaType: current.ctaType,
    ctaHref: current.ctaHref,
    contactLabel: c?.contactLabel,
    contactEmail: c?.contactEmail ?? '',
    footer: c?.footer,
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/sites/${site.id}`} className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← {site.name}
        </Link>
        <h1 className="font-display text-3xl italic text-parchment mt-2">Design your website</h1>
      </div>

      {/* Pages */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gold/10 pb-3">
        <span className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mr-1">Pages</span>
        {pages.map(p => (
          <Link
            key={p.id}
            href={`/sites/${site.id}/design?page=${p.slug}`}
            className={`font-label text-[10px] tracking-[2px] uppercase px-3 py-1.5 rounded-sm transition-colors ${
              p.slug === current.slug ? 'bg-gold text-background' : 'border border-gold/20 text-ash hover:text-gold'
            }`}
          >
            {p.title || 'Untitled'}
          </Link>
        ))}
        <form action={addPageAction} className="flex items-center gap-1">
          <input type="hidden" name="id" value={site.id} />
          <input
            name="title"
            placeholder="New page name"
            className="bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body text-xs px-3 py-1.5 rounded-sm outline-none placeholder:text-ash/40"
            style={{ width: 130 }}
          />
          <button className="font-label text-[10px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-1.5 rounded-sm">
            + Add
          </button>
        </form>
        {current.slug !== '' && (
          <form action={removePageAction} className="ml-auto">
            <input type="hidden" name="id" value={site.id} />
            <input type="hidden" name="slug" value={current.slug} />
            <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300 px-2 py-1.5">
              Delete this page
            </button>
          </form>
        )}
      </div>

      <details className="border border-gold/30 bg-gold/5 rounded-sm p-4">
        <summary className="font-label text-[10px] tracking-[3px] uppercase text-gold cursor-pointer">✨ Write this page with AI</summary>
        <p className="font-body text-ash/70 text-sm mt-3 mb-3">Describe this page and Claude writes it — then edit it right here.</p>
        <form action={generateSiteAction} className="space-y-3">
          <input type="hidden" name="id" value={site.id} />
          <input type="hidden" name="pageSlug" value={current.slug} />
          <textarea
            name="description"
            required
            rows={3}
            placeholder="e.g. I run Anima Temple — Reiki, soul readings, and meditation circles in Lisbon."
            className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none resize-none placeholder:text-ash/40"
          />
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors">
            Generate ✨
          </button>
        </form>
      </details>

      <LiveEditor
        key={current.slug + ':' + site.updatedAt}
        siteId={site.id}
        siteSlug={site.slug}
        siteName={site.name}
        siteStatus={site.status}
        pageSlug={current.slug}
        initial={pageView}
      />
    </div>
  )
}
