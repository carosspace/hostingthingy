import Link from 'next/link'
import type { Site } from '@/lib/sites/types'
import { TEMPLATES } from '@/lib/sites/types'
import { listSites } from '@/lib/sites/store'
import { createSiteAction, redeploySiteAction, deleteSiteAction } from './actions'

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: Site['status'] }) {
  const map: Record<Site['status'], { label: string; cls: string }> = {
    queued: { label: 'Queued', cls: 'text-ash' },
    building: { label: 'Building…', cls: 'text-gold' },
    live: { label: 'Live', cls: 'text-green-400' },
    failed: { label: 'Failed', cls: 'text-red-400' },
    stopped: { label: 'Stopped', cls: 'text-ash' },
  }
  const s = map[status]
  return <span className={`font-label text-[9px] tracking-[2px] uppercase ${s.cls}`}>{s.label}</span>
}

export default async function SitesPage() {
  let sites: Site[] = []
  let dbError = false
  try {
    sites = await listSites()
  } catch {
    dbError = true
  }

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Your websites</h1>
        <p className="font-body text-ash mt-2 text-sm">Create a site and the engine puts it online.</p>
      </section>

      {/* Add a website */}
      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-4">Add a website</p>
        <form action={createSiteAction} className="flex flex-col sm:flex-row gap-3">
          <input
            name="name"
            type="text"
            required
            placeholder="My beautiful website"
            className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
          />
          <select
            name="template"
            defaultValue={TEMPLATES[0]}
            className="bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none"
          >
            {TEMPLATES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button
            type="submit"
            className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight transition-colors px-6 py-3 rounded-sm"
          >
            Create →
          </button>
        </form>
      </section>

      {/* Sites */}
      {dbError ? (
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — connect your database.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Create the platform&apos;s Supabase project and run the migration (see SETUP.md), then
            your sites will save and persist here.
          </p>
        </div>
      ) : sites.length === 0 ? (
        <div className="border border-gold/10 rounded-sm p-10 text-center">
          <p className="font-body text-ash">No websites yet — create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map(site => (
            <div
              key={site.id}
              className="border border-gold/15 rounded-sm p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/sites/${site.id}`}
                    className="font-body text-parchment text-lg hover:text-gold transition-colors"
                  >
                    {site.name}
                  </Link>
                  <StatusBadge status={site.status} />
                </div>
                <p className="font-body text-ash/60 text-sm mt-1 truncate">
                  {site.url ?? `${site.slug}.hostingthingy.app`} · <span className="text-gold/60">{site.template}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <form action={redeploySiteAction}>
                  <input type="hidden" name="id" value={site.id} />
                  <button className="font-label text-[9px] tracking-[2px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-3 py-2 rounded-sm transition-colors">
                    Redeploy
                  </button>
                </form>
                <form action={deleteSiteAction}>
                  <input type="hidden" name="id" value={site.id} />
                  <button className="font-label text-[9px] tracking-[2px] uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-sm transition-colors">
                    Delete
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
