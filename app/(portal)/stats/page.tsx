import { getCurrentUser } from '@/lib/auth'
import { listSites } from '@/lib/sites/store'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'
import { getSiteStats, type Named } from '@/lib/analytics/repo'

export const dynamic = 'force-dynamic'

const label = 'font-label text-[9px] tracking-[2px] uppercase text-gold/60'

function Bars({ days }: { days: { day: string; views: number }[] }) {
  const max = Math.max(1, ...days.map(d => d.views))
  return (
    <div className="flex items-end gap-[3px] h-28">
      {days.map(d => (
        <div key={d.day} className="flex-1 flex flex-col justify-end h-full group relative" title={`${d.day} · ${d.views} views`}>
          <div
            className="bg-gold/70 hover:bg-gold rounded-t-sm transition-colors"
            style={{ height: `${Math.max(d.views ? 4 : 1, (d.views / max) * 100)}%` }}
          />
        </div>
      ))}
    </div>
  )
}

function List({ title, items, total, prefix }: { title: string; items: Named[]; total: number; prefix?: string }) {
  return (
    <section className="border border-gold/15 rounded-sm p-4">
      <span className={label}>{title}</span>
      {items.length === 0 ? (
        <p className="font-body text-ash/50 text-xs mt-2">Nothing yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map(i => (
            <li key={i.name} className="font-body text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-parchment truncate">{prefix && i.name.startsWith('/') ? prefix + i.name : i.name}</span>
                <span className="text-gold tabular-nums flex-shrink-0">{i.views}</span>
              </div>
              <div className="h-[2px] bg-gold/15 mt-1">
                <div className="h-full bg-gold/50" style={{ width: `${total ? (i.views / total) * 100 : 0}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default async function StatsPage() {
  const user = await getCurrentUser()
  const sites = await listSites().catch(() => [])
  const site = sites.find(s => s.slug === PORTAL_SITE_SLUG) || sites[0]

  if (!user || !site) {
    return <p className="font-body text-ash/60 text-sm">No website found on your account yet.</p>
  }

  const stats = await getSiteStats(site.slug, 30)
  const siteUrl = site.domain ? `https://${site.domain}` : 'https://animatemple.com'
  const last7 = stats.days.slice(-7)
  const views7 = last7.reduce((n, d) => n + d.views, 0)
  const visits7 = last7.reduce((n, d) => n + d.visits, 0)

  return (
    <div className="space-y-8 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Visitors</h1>
        <p className="font-body text-ash mt-2 text-sm leading-relaxed max-w-xl">
          Who is finding your website, which pages they read, and where they came from. Counted on your own site —
          no cookies, no tracking of individual people, nothing shared with anyone else.
        </p>
      </section>

      {!stats.ready ? (
        <section className="border border-gold/25 rounded-sm p-5">
          <span className={label}>One step left</span>
          <p className="font-body text-parchment text-sm mt-2 leading-relaxed">
            Counting isn’t switched on yet — the database table still needs creating. Run migration{' '}
            <span className="text-gold">030_analytics.sql</span> in Supabase (SQL Editor → New query → paste → Run),
            and numbers will start appearing here straight away.
          </p>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { k: 'Views · 7 days', v: views7 },
              { k: 'Visits · 7 days', v: visits7 },
              { k: 'Views · 30 days', v: stats.totals.views },
              { k: 'Visits · 30 days', v: stats.totals.visits },
            ].map(c => (
              <div key={c.k} className="border border-gold/15 rounded-sm p-4">
                <span className={label}>{c.k}</span>
                <p className="font-display text-3xl italic text-parchment mt-1 tabular-nums">{c.v}</p>
              </div>
            ))}
          </section>

          <section className="border border-gold/15 rounded-sm p-4">
            <div className="flex items-center justify-between">
              <span className={label}>Last 30 days</span>
              <span className="font-body text-ash/50 text-[11px]">a bar per day</span>
            </div>
            <div className="mt-3">
              <Bars days={stats.days} />
            </div>
          </section>

          <div className="grid sm:grid-cols-2 gap-3">
            <List title="Most-read pages" items={stats.pages} total={stats.totals.views} prefix={site.domain || 'animatemple.com'} />
            <div className="space-y-3">
              <List title="Where they came from" items={stats.sources} total={stats.totals.views} />
              <List title="Phone or computer" items={stats.devices} total={stats.totals.views} />
            </div>
          </div>

          <p className="font-body text-ash/60 text-xs">
            Seeing your own visits in the numbers?{' '}
            <a href={`${siteUrl}/?notrack=1`} target="_blank" rel="noreferrer" className="text-gold border-b border-gold/40">
              Click here once on each device
            </a>{' '}
            and this browser stops being counted.
          </p>
        </>
      )}
    </div>
  )
}
