import Link from 'next/link'
import type { Site } from '@/lib/sites/types'
import { getSite } from '@/lib/sites/store'
import { renameSiteAction, redeploySiteAction, pauseSiteAction, setDomainAction, deleteSiteAction } from '../actions'

export const dynamic = 'force-dynamic'

const STATUS: Record<Site['status'], { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'text-ash' },
  building: { label: 'Building…', cls: 'text-gold' },
  live: { label: 'Live', cls: 'text-green-400' },
  failed: { label: 'Failed', cls: 'text-red-400' },
  stopped: { label: 'Stopped', cls: 'text-ash' },
}

export default async function SiteDetailPage({ params }: { params: { id: string } }) {
  let site: Site | null = null
  try {
    site = await getSite(params.id)
  } catch {
    site = null
  }

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

  const st = STATUS[site.status]
  const rows: [string, string][] = [
    ['Template', site.template],
    ['Address', `${site.slug}.hostingthingy.app`],
    ['Created', new Date(site.createdAt).toLocaleString()],
    ['Last updated', new Date(site.updatedAt).toLocaleString()],
  ]

  return (
    <div className="space-y-10">
      <div>
        <Link href="/sites" className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← All sites
        </Link>
        <div className="flex items-center gap-3 flex-wrap mt-4">
          <h1 className="font-display text-4xl italic text-parchment">{site.name}</h1>
          <span className={`font-label text-[9px] tracking-[2px] uppercase ${st.cls}`}>{st.label}</span>
        </div>
        {site.status === 'live' ? (
          <a
            href={`/s/${site.slug}`}
            target="_blank"
            rel="noreferrer"
            className="font-body text-gold hover:text-goldLight text-sm mt-2 inline-block"
          >
            Visit your live site ↗
          </a>
        ) : (
          <p className="font-body text-ash/50 text-sm mt-2">Not live yet — redeploy to publish.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/sites/${site.id}/design`}
          className="inline-block font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-3 rounded-sm transition-colors"
        >
          ✎ Edit website
        </Link>
        <Link
          href={`/sites/${site.id}/ai`}
          className="inline-block font-label text-[11px] tracking-[3px] uppercase border border-gold text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors"
        >
          ✨ Edit with AI
        </Link>
        <Link
          href={`/sites/${site.id}/edit`}
          className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors ml-1"
        >
          Form editor
        </Link>
      </div>
      <p className="font-body text-ash/50 text-xs -mt-6">
        Build it by hand, or let AI draft it — switch between both anytime.
      </p>

      <section className="border border-gold/15 rounded-sm divide-y divide-gold/10">
        {rows.map(([k, v]) => (
          <div key={k} className="px-5 py-4 flex justify-between gap-4">
            <span className="font-label text-[9px] tracking-[3px] uppercase text-gold/60">{k}</span>
            <span className="font-body text-parchment text-sm text-right break-words">{v}</span>
          </div>
        ))}
      </section>

      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-4">Rename</p>
        <form action={renameSiteAction} className="flex flex-col sm:flex-row gap-3">
          <input type="hidden" name="id" value={site.id} />
          <input
            name="name"
            defaultValue={site.name}
            required
            className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none"
          />
          <button className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors">
            Save
          </button>
        </form>
      </section>

      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">Custom domain</p>
        <p className="font-body text-ash/60 text-xs mb-4">
          {site.domain
            ? `${site.domain} will point here once real hosting is connected.`
            : 'Use your own web address (e.g. yourname.com). It hooks up for real when hosting goes live.'}
        </p>
        <form action={setDomainAction} className="flex flex-col sm:flex-row gap-3">
          <input type="hidden" name="id" value={site.id} />
          <input
            name="domain"
            defaultValue={site.domain ?? ''}
            placeholder="yourname.com"
            className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
          />
          <button className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors">
            Save
          </button>
        </form>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        {site.status === 'stopped' ? (
          <form action={redeploySiteAction}>
            <input type="hidden" name="id" value={site.id} />
            <button className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-5 py-3 rounded-sm transition-colors">
              Resume
            </button>
          </form>
        ) : (
          <form action={redeploySiteAction}>
            <input type="hidden" name="id" value={site.id} />
            <button className="font-label text-[10px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-5 py-3 rounded-sm transition-colors">
              Redeploy
            </button>
          </form>
        )}
        {site.status === 'live' && (
          <form action={pauseSiteAction}>
            <input type="hidden" name="id" value={site.id} />
            <button className="font-label text-[10px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-5 py-3 rounded-sm transition-colors">
              Pause
            </button>
          </form>
        )}
        <form action={deleteSiteAction}>
          <input type="hidden" name="id" value={site.id} />
          <button className="font-label text-[10px] tracking-[3px] uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 px-5 py-3 rounded-sm transition-colors">
            Delete
          </button>
        </form>
      </section>
    </div>
  )
}
