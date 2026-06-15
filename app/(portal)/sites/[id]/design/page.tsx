import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import { generateSiteAction } from '../../actions'
import LiveEditor from './LiveEditor'

export const dynamic = 'force-dynamic'

export default async function DesignPage({ params }: { params: { id: string } }) {
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

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/sites/${site.id}`} className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← {site.name}
        </Link>
        <h1 className="font-display text-3xl italic text-parchment mt-2">Design your website</h1>
      </div>

      <details className="border border-gold/30 bg-gold/5 rounded-sm p-4">
        <summary className="font-label text-[10px] tracking-[3px] uppercase text-gold cursor-pointer">✨ Start with AI</summary>
        <p className="font-body text-ash/70 text-sm mt-3 mb-3">Describe your business and Claude writes the page — then edit it right here on the page.</p>
        <form action={generateSiteAction} className="space-y-3">
          <input type="hidden" name="id" value={site.id} />
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
        key={site.updatedAt}
        siteId={site.id}
        siteSlug={site.slug}
        siteName={site.name}
        siteStatus={site.status}
        initial={site.content}
      />
    </div>
  )
}
