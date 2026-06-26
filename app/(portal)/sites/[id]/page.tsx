import Link from 'next/link'
import type { Site } from '@/lib/sites/types'
import { BOOKING_LAYOUTS, BOOKING_LAYOUT_META, DEFAULT_BOOKING_LAYOUT } from '@/lib/sites/types'
import { getSite } from '@/lib/sites/store'
import {
  renameSiteAction,
  redeploySiteAction,
  pauseSiteAction,
  setDomainAction,
  deleteSiteAction,
  setBookingCopyAction,
  connectStripeAction,
  refreshStripeStatusAction,
  refreshStripeStatusFormAction,
  stripeLoginLinkAction,
  disconnectStripeAction,
} from '../actions'
import { cfConfigured, cfGetHostname, cfCnameTarget, isOwnZone, type CfHostname } from '@/lib/sites/cloudflare'
import { stripeConfigured } from '@/lib/stripe'
import SavedDesigns from './SavedDesigns'

export const dynamic = 'force-dynamic'

const STATUS: Record<Site['status'], { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'text-ash' },
  building: { label: 'Building…', cls: 'text-gold' },
  live: { label: 'Live', cls: 'text-green-400' },
  failed: { label: 'Failed', cls: 'text-red-400' },
  stopped: { label: 'Stopped', cls: 'text-ash' },
}

export default async function SiteDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams?: { stripe?: string }
}) {
  // Returning from Stripe onboarding: re-read the account status BEFORE loading the site,
  // so the card reflects the latest charges_enabled. Fail-safe + dormant (no-op without a key).
  if (searchParams?.stripe === 'return') {
    try {
      await refreshStripeStatusAction(params.id)
    } catch {
      // never block the page on a status refresh
    }
  }

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
        <Link href="/dashboard" className="font-label text-[10px] tracking-[3px] uppercase text-gold hover:text-goldLight">
          ← Dashboard
        </Link>
      </div>
    )
  }

  // Custom-domain HTTPS: third-party domains go through Cloudflare for SaaS (when
  // configured); the platform's own zone (animatemple.com) is served directly.
  const ownZone = !!site.domain && isOwnZone(site.domain)
  const cfMode = cfConfigured() && !!site.domain && !ownZone
  let cf: CfHostname | null = null
  if (cfMode && site.domain) {
    try {
      cf = await cfGetHostname(site.domain)
    } catch {
      cf = null
    }
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
        <Link href="/dashboard" className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors">
          ← Dashboard
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
      </div>
      <p className="font-body text-ash/50 text-xs -mt-6">
        Build it by hand, or let AI draft it — switch between both anytime.
      </p>

      <SavedDesigns
        siteId={site.id}
        designs={(site.content?.savedDesigns ?? []).map(d => ({ id: d.id, name: d.name, savedAt: d.savedAt }))}
      />

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
          Use your own web address (e.g. <span className="text-ash">yourname.com</span>). Add it below, point your DNS, and it serves this site with automatic HTTPS.
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
        {site.domain && cfMode && (
          <div className="mt-5 border-t border-gold/10 pt-4">
            <p className="font-body text-parchment text-sm mb-2">Point <b>{site.domain}</b> here:</p>
            <ol className="font-body text-ash/70 text-xs space-y-1.5 list-decimal list-inside">
              <li>At your domain&rsquo;s DNS provider, add a <b className="text-ash">CNAME</b> record — Name <code className="text-gold/70">@</code> (your domain), Target <code className="text-gold/70">{cfCnameTarget()}</code>.</li>
              <li>Add a <b className="text-ash">CNAME</b> for <code className="text-gold/70">www</code> → <code className="text-gold/70">{cfCnameTarget()}</code> as well.</li>
            </ol>
            {(() => {
              const live = cf?.status === 'active' && cf?.sslStatus === 'active'
              const label = !cf ? 'Waiting for your DNS…' : live ? '✓ Live with HTTPS' : cf.sslStatus === 'active' ? 'Almost there…' : 'Issuing your HTTPS certificate…'
              return <p className="font-body text-[12px] mt-3" style={{ color: live ? '#3f7d4f' : '#9a7d2e' }}>{label}</p>
            })()}
            <p className="font-body text-ash/50 text-[11px] mt-1">HTTPS turns on automatically once the CNAME resolves (usually a few minutes). Refresh to update the status.</p>
          </div>
        )}
        {site.domain && !cfMode && (
          <div className="mt-5 border-t border-gold/10 pt-4">
            <p className="font-body text-parchment text-sm mb-2">Point <b>{site.domain}</b> here:</p>
            <ol className="font-body text-ash/70 text-xs space-y-1.5 list-decimal list-inside">
              <li>In your domain registrar&rsquo;s DNS settings, remove any existing redirect/parking records on <code className="text-gold/70">@</code> and <code className="text-gold/70">www</code>.</li>
              <li>Add an <b className="text-ash">A record</b> — Host <code className="text-gold/70">@</code>, Value <code className="text-gold/70">62.238.38.156</code>.</li>
              <li>Add an <b className="text-ash">A record</b> — Host <code className="text-gold/70">www</code>, Value <code className="text-gold/70">62.238.38.156</code>.</li>
            </ol>
            <p className="font-body text-ash/50 text-[11px] mt-2">DNS changes can take a few minutes to a couple of hours. HTTPS turns on automatically once the domain resolves here.</p>
          </div>
        )}
      </section>

      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">Booking page</p>
        <p className="font-body text-ash/60 text-xs mb-4">
          The words on your public booking page (<code className="text-gold/70">/book/{site.slug}</code>). Leave a field blank to use the default shown.
          {' '}Your services &amp; availability are managed in the{' '}
          <Link href="/bookings" className="text-gold hover:text-goldLight">Bookings dashboard</Link>.
        </p>
        <form action={setBookingCopyAction} className="space-y-4">
          <input type="hidden" name="id" value={site.id} />
          <div>
            <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Booking page style</label>
            <p className="font-body text-ash/40 text-[11px] mb-2.5">All styles use your site&rsquo;s colours &amp; fonts — only the layout changes.</p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {BOOKING_LAYOUTS.map(opt => {
                const meta = BOOKING_LAYOUT_META[opt]
                const checked = (site.content?.booking?.layout ?? DEFAULT_BOOKING_LAYOUT) === opt
                return (
                  <label
                    key={opt}
                    className="flex items-start gap-2.5 cursor-pointer rounded-sm border px-3.5 py-3 transition-colors border-gold/20 hover:border-gold/40 has-[:checked]:border-gold/70 has-[:checked]:bg-gold/10"
                  >
                    <input
                      type="radio"
                      name="layout"
                      value={opt}
                      defaultChecked={checked}
                      className="mt-1 accent-gold"
                    />
                    <span className="flex-1">
                      <span className="font-body text-parchment text-sm block">{meta.label}</span>
                      <span className="font-body text-ash/55 text-[11px] block mt-0.5 leading-snug">{meta.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
          <div>
            <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Heading</label>
            <input
              name="heading"
              defaultValue={site.content?.booking?.heading ?? ''}
              maxLength={80}
              placeholder="Book a session"
              className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
            />
          </div>
          <div>
            <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Intro line</label>
            <textarea
              name="intro"
              defaultValue={site.content?.booking?.intro ?? ''}
              maxLength={300}
              rows={2}
              placeholder="Choose what feels right, then a time that's open."
              className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none resize-none placeholder:text-ash/40"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Thank-you title</label>
              <input
                name="successTitle"
                defaultValue={site.content?.booking?.successTitle ?? ''}
                maxLength={80}
                placeholder="Thank you"
                className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
              />
            </div>
            <div>
              <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Closed title</label>
              <input
                name="closedTitle"
                defaultValue={site.content?.booking?.closedTitle ?? ''}
                maxLength={80}
                placeholder="Booking isn't open yet"
                className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none placeholder:text-ash/40"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Thank-you message</label>
              <textarea
                name="successBody"
                defaultValue={site.content?.booking?.successBody ?? ''}
                maxLength={300}
                rows={3}
                placeholder="Your booking request has been sent — {brand} will confirm it by email soon."
                className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none resize-none placeholder:text-ash/40"
              />
              <p className="font-body text-ash/40 text-[11px] mt-1.5">Use <code className="text-gold/70">{'{brand}'}</code> for your brand name.</p>
            </div>
            <div>
              <label className="font-label text-[9px] tracking-[2px] uppercase text-gold/60 block mb-1.5">Closed message</label>
              <textarea
                name="closedBody"
                defaultValue={site.content?.booking?.closedBody ?? ''}
                maxLength={300}
                rows={3}
                placeholder="Please check back soon."
                className="w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-3 rounded-sm outline-none resize-none placeholder:text-ash/40"
              />
            </div>
          </div>
          <button className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors">
            Save
          </button>
        </form>
      </section>

      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">Payments</p>
        {!stripeConfigured() ? (
          <p className="font-body text-ash/60 text-sm">
            Payments aren&rsquo;t enabled on the platform yet. Once they&rsquo;re switched on, you&rsquo;ll be able
            to connect your own Stripe account here and take payments on your site.
          </p>
        ) : (
          <>
            {/* PRIMARY: payments work out of the box via the owner's own Stripe (direct charge). */}
            <p className="font-body text-sm mb-1" style={{ color: '#3f7d4f' }}>
              ✓ Payments are on
            </p>
            <p className="font-body text-ash/60 text-sm">
              Buy buttons on this site charge straight to your Stripe account. No extra setup needed.
            </p>

            {/* SECONDARY / advanced: route this site's payments to a SEPARATE Stripe account (for a
                different seller). Optional — left untouched for sites that opted in. */}
            <details className="mt-5 border-t border-gold/10 pt-4">
              <summary className="font-label text-[10px] tracking-[3px] uppercase text-gold/60 cursor-pointer select-none">
                Use a separate Stripe account for this site
              </summary>
              <div className="mt-4">
                {!site.stripeAccountId || !site.stripeChargesEnabled ? (
                  <>
                    <p className="font-body text-ash/60 text-xs mb-4">
                      Optional. Connect a different Stripe account so this site&rsquo;s payments go to another
                      seller — they become the merchant of record instead of you.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <form action={connectStripeAction}>
                        <input type="hidden" name="id" value={site.id} />
                        <button className="font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors">
                          {site.stripeAccountId ? 'Finish setup on Stripe' : 'Connect a separate Stripe'}
                        </button>
                      </form>
                      {site.stripeAccountId && (
                        <form action={refreshStripeStatusFormAction}>
                          <input type="hidden" name="id" value={site.id} />
                          <button className="font-label text-[10px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-5 py-3 rounded-sm transition-colors">
                            Refresh status
                          </button>
                        </form>
                      )}
                    </div>
                    {site.stripeAccountId && (
                      <p className="font-body text-ash/50 text-[11px] mt-3">
                        You&rsquo;ve started connecting — finish the steps on Stripe to route this site&rsquo;s payments there.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-body text-sm mb-4" style={{ color: '#3f7d4f' }}>
                      ✓ A separate Stripe account is connected — this site&rsquo;s payments go there.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <form action={stripeLoginLinkAction}>
                        <input type="hidden" name="id" value={site.id} />
                        <button className="font-label text-[10px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-5 py-3 rounded-sm transition-colors">
                          Open Stripe dashboard ↗
                        </button>
                      </form>
                      <form action={disconnectStripeAction}>
                        <input type="hidden" name="id" value={site.id} />
                        <button className="font-label text-[10px] tracking-[3px] uppercase border border-red-500/30 text-red-400 hover:bg-red-500/10 px-5 py-3 rounded-sm transition-colors">
                          Disconnect
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>
            </details>
          </>
        )}
      </section>

      <section className="border border-gold/15 rounded-sm p-6">
        <p className="font-label text-[10px] tracking-[3px] uppercase text-gold mb-2">Member portal</p>
        <p className="font-body text-ash/60 text-xs mb-5">
          Your clients&rsquo; private space. Choose which rooms they see, write their welcome, and tune the
          wording &amp; accent — with a live preview of exactly what they&rsquo;ll see. Each room appears for a
          person once they actually have something in it; Messages and &ldquo;Book a session&rdquo; always stay within reach.
        </p>
        <Link
          href={`/sites/${site.id}/portal`}
          className="inline-block font-label text-[11px] tracking-[3px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-6 py-3 rounded-sm transition-colors"
        >
          ✦ Open the portal editor
        </Link>
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
