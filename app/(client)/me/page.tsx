import type { CSSProperties } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import {
  PORTAL_TILE_DEFAULTS,
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
import ClientLogin from './ClientLogin'
import PortalHeader from './PortalHeader'

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
          initialError={searchParams?.error === 'link' ? 'That link expired or was already used — request a new one below.' : undefined}
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

  const email = client?.email || user.email || 'friend'
  // Name comes from the portal client row first, then the auth user's metadata
  // (this is where blueprint buyers' names land — set when their account is minted).
  const metaName = typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : ''
  const displayName = client?.name?.trim() || metaName.trim() || ''
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

  // Custom tile copy (per owner), falling back to the built-in defaults. {brand}
  // (and {name}) tokens are filled. href is /me/<module>.
  const tileCopy = content?.memberPortal?.tiles
  type Tile = { title: string; icon: string; desc: string; href: string }
  const resolveTile = (k: 'blueprint' | 'bookings' | 'courses' | 'memberships' | 'resources'): Tile => {
    const d = PORTAL_TILE_DEFAULTS[k]
    return {
      icon: d.icon,
      title: fillTokens(tileCopy?.[k]?.title?.trim() || d.title, displayName, brand),
      desc: fillTokens(tileCopy?.[k]?.desc?.trim() || d.desc, displayName, brand),
      href: `/me/${k}`,
    }
  }
  const tiles: Tile[] = []
  if (hasBlueprint) tiles.push(resolveTile('blueprint'))
  if (hasBookings) tiles.push(resolveTile('bookings'))
  if (hasCourses) tiles.push(resolveTile('courses'))
  if (hasMemberships) tiles.push(resolveTile('memberships'))
  if (hasResources) tiles.push(resolveTile('resources'))

  // Always-there reachability, as small icons (gated only by the owner's toggles).
  type Quick = { label: string; icon: string; href: string }
  const quickLinks: Quick[] = []
  if (moduleOn('messages')) quickLinks.push({ label: 'Messages', icon: '✉', href: '/me/messages' })
  if (moduleOn('bookings')) quickLinks.push({ label: 'Book a session', icon: '◷', href: `/book/${slug}` })

  const welcomeText = fillTokens((content?.memberPortal?.welcome || '').trim() || DEFAULT_WELCOME, displayName, brand)
  const emptyText = fillTokens((content?.memberPortal?.emptyState || '').trim() || DEFAULT_EMPTY, displayName, brand)

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
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
            Welcome{displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="font-body mt-4" style={{ color: portalText, fontSize: 16, lineHeight: 1.7, maxWidth: 560 }}>
            {welcomeText}
          </p>
          <p className="font-body mt-3" style={{ color: portalMuted, fontSize: 12.5, lineHeight: 1.6 }}>
            Signed in as <span style={{ color: portalText }}>{email}</span>.
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

        {/* Personalized module tiles — only what they own */}
        {tiles.length > 0 ? (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {tiles.map(m => (
              <a key={m.href} href={m.href} className="p-6 flex flex-col gap-3 transition-opacity hover:opacity-80" style={cardStyle}>
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" style={{ color: accent, fontSize: 22, lineHeight: 1 }}>{m.icon}</span>
                  <span aria-hidden="true" style={{ color: accent, fontSize: 18, lineHeight: 1 }}>→</span>
                </div>
                <div>
                  <h2 className="font-display" style={{ color: portalText, fontSize: 21, lineHeight: 1.2 }}>{m.title}</h2>
                  <p className="font-body mt-1.5" style={{ color: portalMuted, fontSize: 13, lineHeight: 1.55 }}>{m.desc}</p>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <p className="font-body mt-12" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 480 }}>
            {emptyText}
          </p>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: portalMuted }}>{footer}</p>
      </footer>
    </div>
  )
}
