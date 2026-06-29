import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { listSites } from '@/lib/sites/store'
import type { Site } from '@/lib/sites/types'
import { TEMPLATE_CARDS } from '@/lib/sites/types'
import { createSiteAction, redeploySiteAction, deleteSiteAction } from '../sites/actions'
import { updateNameAction } from '../account/actions'
import { PORTAL_SITE_SLUG } from '@/lib/portal/site'

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

export default async function DashboardPage() {
  const user = await getCurrentUser()
  const displayName =
    (user?.user_metadata?.full_name as string | undefined) || user?.email
  const fullName = (user?.user_metadata?.full_name as string | undefined) ?? ''

  let sites: Site[] = []
  let dbError = false
  try {
    sites = await listSites()
  } catch {
    dbError = true
  }
  const siteCount = dbError ? null : sites.length
  // Only the owner of the portal's site sees the "client portal" card — /me is
  // hardwired to that one slug, so it's only truly "your brand" for that owner.
  const ownsPortal = !dbError && sites.some(s => s.slug === PORTAL_SITE_SLUG)

  return (
    <div className="space-y-14">
      {/* a. Welcome */}
      <section>
        <p className="font-label text-[10px] tracking-[4px] uppercase text-gold/70 mb-3">Welcome</p>
        <h1 className="font-display text-4xl italic text-parchment break-words">{displayName}</h1>
        <p className="font-body text-ash mt-3">Your temple. Let&apos;s put your work into the world.</p>
      </section>

      {/* b. Stats */}
      {!dbError && sites.length > 0 && (
        <section className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total', value: sites.length },
            { label: 'Live', value: sites.filter((s) => s.status === 'live').length },
            { label: 'Paused', value: sites.filter((s) => s.status === 'stopped').length },
          ].map((stat) => (
            <div key={stat.label} className="border border-gold/15 rounded-sm p-5">
              <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-2">{stat.label}</p>
              <p className="font-display text-3xl text-parchment">{stat.value}</p>
            </div>
          ))}
        </section>
      )}

      {/* c. Your websites — create + full list */}
      <section className="space-y-6">
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold">
          Your websites{!dbError && sites.length > 0 ? ` · ${sites.length}` : ''}
        </h2>

        {/* Add a website */}
        <div className="border border-gold/15 rounded-sm p-6">
          <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-4">Add a website</p>
          <form action={createSiteAction} className="space-y-5">
            <input
              name="name"
              type="text"
              required
              placeholder="My beautiful website"
              className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
            />
            <div>
              <p className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 mb-2">Choose a template</p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {TEMPLATE_CARDS.map((t, i) => (
                  <label key={t.name} className="cursor-pointer">
                    <input type="radio" name="template" value={t.name} defaultChecked={i === 0} className="peer sr-only" />
                    <div className="h-full border border-gold/20 peer-checked:border-gold peer-checked:bg-gold/10 rounded-sm p-4 transition-colors">
                      <p className="font-body text-parchment text-sm">{t.icon}&nbsp; {t.name}</p>
                      <p className="font-body text-ash/60 text-xs mt-1">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <button
              type="submit"
              className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight transition-colors px-6 py-3 rounded-sm"
            >
              Create website →
            </button>
          </form>
        </div>

        {/* Sites list */}
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
                    {site.url ?? 'No custom domain yet'} · <span className="text-gold/60">{site.template}</span>
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
      </section>

      {/* d. Your client portal — only for the owner of the portal site */}
      {ownsPortal && (
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-5">Your client portal</h2>
        <div className="border border-gold/15 rounded-sm p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="font-body text-ash">
            This is your clients&apos; space — their bookings, messages, courses, memberships and Divine Blueprint, in your brand.
          </p>
          <Link
            href="/me"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 font-label text-[10px] tracking-[3px] uppercase border border-gold/30 text-gold hover:bg-gold/10 px-4 py-2 rounded-sm transition-colors"
          >
            Open your client portal ↗
          </Link>
        </div>
      </section>
      )}

      {/* e. Account */}
      <section className="space-y-6 max-w-lg">
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold">Account</h2>

        <div className="border border-gold/15 rounded-sm p-6">
          <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-3">Display name</p>
          <form action={updateNameAction} className="flex flex-col sm:flex-row gap-3">
            <input
              name="name"
              defaultValue={fullName}
              placeholder="Your name"
              className="flex-1 bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
            />
            <button className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors">
              Save
            </button>
          </form>
        </div>

        <div className="border border-gold/15 rounded-sm divide-y divide-gold/10">
          <div className="px-5 py-4">
            <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Email</p>
            <p className="font-body text-parchment break-words">{user?.email}</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Websites</p>
            <p className="font-body text-parchment">{siteCount ?? '—'}</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-label text-[9px] tracking-[3px] uppercase text-gold/60 mb-1">Member since</p>
            <p className="font-body text-parchment">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </p>
          </div>
        </div>

        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors"
          >
            Sign out →
          </button>
        </form>
      </section>
    </div>
  )
}
