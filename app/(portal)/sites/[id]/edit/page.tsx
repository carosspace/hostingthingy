import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import { generateSiteAction } from '../../actions'
import SiteEditor from './SiteEditor'

export const dynamic = 'force-dynamic'

export default async function EditSitePage({ params }: { params: { id: string } }) {
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

  const inputCls =
    'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40'

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link href={`/sites/${site.id}`} className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← Back to {site.name}
        </Link>
        <h1 className="font-display text-4xl italic text-parchment mt-4">Build your website</h1>
        <p className="font-body text-ash/70 text-sm mt-2">Two ways to build — let the AI do it, or craft it yourself. Either publishes instantly.</p>
        {site.status === 'live' && (
          <a href={`/s/${site.slug}`} target="_blank" rel="noreferrer" className="inline-block mt-3 font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
            View live ↗
          </a>
        )}
      </div>

      {/* AI mode */}
      <section className="border border-gold/30 bg-gold/5 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">✨ Build with AI</p>
        <p className="font-body text-ash/70 text-sm mb-4">
          Describe your business in a sentence or two and Claude writes the whole site (and picks a fitting theme).
          It fills in the manual builder below, so you can tweak everything after.
        </p>
        <form action={generateSiteAction} className="space-y-3">
          <input type="hidden" name="id" value={site.id} />
          <textarea
            name="description"
            required
            rows={3}
            placeholder="e.g. I run a spiritual wellness practice called Anima Temple — Reiki, soul readings, and meditation circles in Lisbon."
            className={`${inputCls} resize-none`}
          />
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors">
            Generate with AI ✨
          </button>
        </form>
      </section>

      {/* Divider */}
      <div className="flex items-center gap-4">
        <div className="h-px bg-gold/15 flex-1" />
        <span className="font-label text-[9px] tracking-[3px] uppercase text-ash/60">or build it yourself</span>
        <div className="h-px bg-gold/15 flex-1" />
      </div>

      {/* Manual mode */}
      <SiteEditor siteId={site.id} siteName={site.name} initial={site.content} />
    </div>
  )
}
