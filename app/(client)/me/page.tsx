import type { CSSProperties } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import {
  DEFAULT_WELCOME,
  DEFAULT_EMPTY,
  fillTokens,
  type ModuleKey,
} from '@/lib/portal/defaults'
import { getMyBlueprints, blueprintConfigured } from '@/lib/portal/blueprint'
import { getMyAppointments } from '@/lib/portal/bookings'
import { getMyCourses } from '@/lib/portal/courses'
import { getMyMemberships } from '@/lib/portal/memberships'
import { getMyResources } from '@/lib/portal/resources'
import { getMyWorkbooks } from '@/lib/portal/workbook'
import ClientLogin from './ClientLogin'
import PortalHeader from './PortalHeader'
import SetPin from './SetPin'

export const dynamic = 'force-dynamic'

// The signed-in client row returned by the ensure_client RPC.
interface ClientRow {
  id: string
  email: string
  name: string | null
}

export default async function ClientPortalPage({ searchParams }: { searchParams: { error?: string } }) {
  const portal = await getPortalSite()
  const { slug, brand, content, theme, accent } = portal
  const rootStyle = portalRootStyle(portal)
  const { text: portalText, muted: portalMuted } = portalTextColors(portal)

  const user = await getCurrentUser()

  // --- Logged out: branded magic-link login -------------------------------
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16" style={rootStyle}>
        <ClientLogin
          brand={brand}
          logoImage={content?.logoImage}
          theme={{ bg: theme.bg, text: portalText, muted: portalMuted, accent }}
          initialError={searchParams?.error === 'link' ? 'That sign-in link had already been used. Pop your email in below and we\'ll send a fresh one.' : undefined}
        />
      </div>
    )
  }

  // --- Logged in: provision + fetch the client row ------------------------
  // ensure_client self-provisions this auth user as a client of the portal's
  // site. If migration 011 isn't applied yet, the RPC errors — degrade
  // gracefully and render the shell from the auth user's email.
  let client: ClientRow | null = null
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('ensure_client', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] ensure_client failed (migration 011 applied?):', error.message)
    } else {
      const row = Array.isArray(data) ? data[0] : data
      if (row) client = row as ClientRow
    }
  } catch (e) {
    console.error('[client-portal] ensure_client threw:', e)
  }

  // Name comes from the portal client row first, then the auth user's metadata
  // (this is where blueprint buyers' names land — set when their account is minted).
  const metaName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
  // Greet by FIRST name only (warmer, less formal than the full name).
  const firstName = (client?.name?.trim() || metaName.trim() || '').split(/\s+/)[0] || ''
  const footer = content?.footer || brand

  // Which modules the owner has enabled (default: all on for backward compatibility).
  const moduleOn = (k: ModuleKey): boolean => content?.memberPortal?.modules?.[k] ?? true

  // Per-person ownership: a big tile only appears once they actually have something
  // in that module. Only query enabled modules. Every getMy* degrades to [] on error.
  const [hasBlueprint, hasBookings, hasCourses, hasMemberships, hasResources] = await Promise.all([
    moduleOn('blueprint')
      ? (async () => {
          if (!blueprintConfigured()) return false
          const r = await getMyBlueprints(user.email || '')
          return r.length > 0
        })().catch(() => false)
      : Promise.resolve(false),
    moduleOn('bookings') ? getMyAppointments(slug).then(r => r.length > 0).catch(() => false) : Promise.resolve(false),
    moduleOn('courses') ? getMyCourses(slug).then(r => r.length > 0).catch(() => false) : Promise.resolve(false),
    moduleOn('memberships') ? getMyMemberships(slug).then(r => r.length > 0).catch(() => false) : Promise.resolve(false),
    moduleOn('resources') ? getMyResources(slug).then(r => r.length > 0).catch(() => false) : Promise.resolve(false),
  ])

  // Interactive workbooks (Tuned In, Meeting Yourself, …) live under Resources. If
  // the member owns ANY of them, the Resources star lights up. Each opens
  // full-screen at /me/workbook?w=<slug> from the Resources page.
  const myWorkbooks = await getMyWorkbooks(slug).catch(() => [])
  const hasWorkbook = myWorkbooks.some(w => w.entitled && w.hasContent)

  // The portal's tabs — each a card with a STAR that turns gold once it's the member's.
  // Flagship offerings (Divine Blueprint, Resources) always appear so a member can discover
  // + get them: not-yet-owned links OUT to buy/create; once owned the star goes gold and the
  // tab opens inside the portal. Bookings always shows (book a first session). Courses /
  // Memberships only appear once the member actually has one — no empty modules. Per-owner
  // tile copy still overrides the title/desc where the owner set it.
  const tileCopy = content?.memberPortal?.tiles
  const copy = (k: 'blueprint' | 'bookings' | 'courses' | 'memberships' | 'resources', title: string, desc: string) => ({
    title: fillTokens(tileCopy?.[k]?.title?.trim() || title, firstName, brand),
    desc: fillTokens(tileCopy?.[k]?.desc?.trim() || desc, firstName, brand),
  })
  type Tab = { key: string; title: string; desc: string; owned: boolean; href: string; action: string; external?: boolean }
  const hasRes = hasResources || hasWorkbook
  const tabs: Tab[] = []
  if (moduleOn('blueprint')) {
    tabs.push({
      key: 'blueprint', owned: hasBlueprint,
      ...copy('blueprint', 'Divine Blueprint', hasBlueprint ? 'Your sacred soul reading, to revisit anytime.' : 'A sacred portrait of your soul — drawn for you alone.'),
      href: hasBlueprint ? '/me/blueprint' : 'https://blueprint.animatemple.com',
      action: hasBlueprint ? 'Open' : 'Get yours', external: !hasBlueprint,
    })
  }
  if (moduleOn('resources')) {
    tabs.push({
      key: 'resources', owned: hasRes,
      ...copy('resources', 'Resources', hasRes ? 'Your guides, downloads & the Tuned In workbook.' : 'Guides, tools & the Tuned In workbook to live with.'),
      href: hasRes ? '/me/resources' : 'https://animatemple.com/resources',
      action: hasRes ? 'Open' : 'Explore', external: !hasRes,
    })
  }
  if (moduleOn('bookings')) {
    tabs.push({
      key: 'bookings', owned: hasBookings,
      ...copy('bookings', 'Bookings', hasBookings ? 'Your sessions with me.' : 'Book your first session with me.'),
      href: hasBookings ? '/me/bookings' : `/book/${slug}`,
      action: hasBookings ? 'Open' : 'Book a session',
    })
  }
  if (hasCourses) {
    tabs.push({ key: 'courses', owned: true, ...copy('courses', 'Courses', 'Your courses, all in one place.'), href: '/me/courses', action: 'Open' })
  }
  if (hasMemberships) {
    tabs.push({ key: 'memberships', owned: true, ...copy('memberships', 'Membership', 'Your membership & what it unlocks.'), href: '/me/memberships', action: 'Open' })
  }

  // Always-there reachability, as small icons (gated only by the owner's toggles).
  type Quick = { label: string; icon: string; href: string }
  const quickLinks: Quick[] = []
  if (moduleOn('messages')) quickLinks.push({ label: 'Messages', icon: '✉', href: '/me/messages' })

  const welcomeText = fillTokens((content?.memberPortal?.welcome || '').trim() || DEFAULT_WELCOME, firstName, brand)
  const emptyText = fillTokens((content?.memberPortal?.emptyState || '').trim() || DEFAULT_EMPTY, firstName, brand)

  const GOLD = '#c79a63'
  const tabCard: CSSProperties = {
    background: '#fbf7f1',
    border: '1px solid #e4d5bd',
    borderRadius: 18,
  }
  const quickStyle: CSSProperties = {
    background: `${accent}12`,
    border: `1px solid ${accent}2e`,
    borderRadius: 999,
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      {/* Header: brand left, sign-out right (shared with sub-pages) */}
      <PortalHeader brand={brand} logoImage={content?.logoImage} theme={{ muted: portalMuted }} accent={accent} />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        {/* Greeting + heartfelt welcome */}
        <div>
          <h1 className="font-display italic" style={{ color: portalText, fontSize: 40, lineHeight: 1.1 }}>
            Welcome{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="font-body mt-4" style={{ color: portalText, fontSize: 16, lineHeight: 1.7, maxWidth: 560 }}>
            {welcomeText}
          </p>
        </div>

        {/* Small always-there icons: Messages + Book a session */}
        {quickLinks.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {quickLinks.map(q => (
              <a
                key={q.label}
                href={q.href}
                className="flex items-center gap-2 px-4 py-2.5 transition-opacity hover:opacity-80"
                style={quickStyle}
              >
                <span aria-hidden="true" style={{ color: accent, fontSize: 15, lineHeight: 1 }}>{q.icon}</span>
                <span className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: portalText }}>
                  {q.label}
                </span>
              </a>
            ))}
          </div>
        )}

        {/* Your space — tabs, each with a star that turns gold once it's theirs */}
        <p className="font-label" style={{ marginTop: 44, marginBottom: 20, fontSize: 11, letterSpacing: '0.3em', textTransform: 'uppercase', color: GOLD }}>
          Your space
        </p>
        {tabs.length > 0 ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))' }}>
            {tabs.map(t => (
              <a
                key={t.key}
                href={t.href}
                target={t.external ? '_blank' : undefined}
                rel={t.external ? 'noreferrer' : undefined}
                className="flex flex-col items-center text-center transition-transform hover:-translate-y-1"
                style={{ ...tabCard, padding: '1.75rem 1.25rem', textDecoration: 'none', color: 'inherit', opacity: t.owned ? 1 : 0.92 }}
              >
                <span aria-hidden="true" style={{ height: 34, display: 'flex', alignItems: 'center' }}>
                  {t.owned ? (
                    <svg viewBox="0 0 24 24" width="30" height="30">
                      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95z" fill={GOLD} />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="30" height="30">
                      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.4l-5.81 3.06 1.11-6.47-4.7-4.58 6.5-.95z" fill="none" stroke="#c9b7a0" strokeWidth={1.3} />
                    </svg>
                  )}
                </span>
                <h2 className="font-display italic" style={{ color: portalText, fontSize: 22, lineHeight: 1.15, marginTop: 8 }}>{t.title}</h2>
                <p className="font-body" style={{ color: portalMuted, fontSize: 13, lineHeight: 1.5, maxWidth: '24ch', marginTop: 6 }}>{t.desc}</p>
                <span className="font-label" style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: GOLD, marginTop: 12 }}>
                  {t.action} <span aria-hidden="true">→</span>
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="font-body" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 480 }}>
            {emptyText}
          </p>
        )}

        <SetPin accent={accent} text={portalText} muted={portalMuted} />
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: portalMuted }}>{footer}</p>
      </footer>
    </div>
  )
}
