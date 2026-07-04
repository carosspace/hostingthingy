import type { CSSProperties } from 'react'
import { googleStack, isGoogleFamily } from '@/lib/sites/googleFonts'
import type { PortalSite } from './site'

// The client portal wears the Anima Temple WEBSITE look: a warm cream ground, dark ink, and the
// site's Cormorant / Mulish / Space Grotesk type family (loaded in app/(client)/layout.tsx).
// Single-tenant (see PORTAL_SITE_SLUG). `accent` (the gold) still comes from the site content
// (accentColor), so it stays configurable and is applied per-element by the pages.

// Resolve a Site Look role / element fontFamily to a CSS font value (kept for parity with
// CanvasView's fontVar, and in case a page renders role fonts).
export const fontVar = (f?: string): string =>
  f === 'body'
    ? 'var(--font-body)'
    : f === 'label'
      ? 'var(--font-label)'
      : f && f.startsWith('custom:')
        ? `'cvf-${f.slice(7)}', sans-serif`
        : f && f.startsWith('google:')
          ? googleStack(f.slice(7))
          : 'var(--font-display)'

// Warm ink + a soft muted, legible on the cream ground, on every portal page.
export function portalTextColors(_portal: PortalSite): { text: string; muted: string } {
  return { text: '#3a281c', muted: '#6b5f52' }
}

// The portal root style: the website's cream ground + the three brand font ROLES as CSS vars
// (--font-display / --font-body / --font-label). The font files themselves are loaded by the
// (client) layout. Colours use no site-look derivation here — the portal is intentionally pinned
// to the Anima Temple palette so it matches the public site exactly.
export function portalRootStyle(_portal: PortalSite): CSSProperties {
  return {
    color: '#3a281c',
    background: '#efe6d9',
    '--font-display': "'Cormorant Garamond', Georgia, serif",
    '--font-body': "'Mulish', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
    '--font-label': "'Space Grotesk', system-ui, sans-serif",
  } as CSSProperties
}

// Any whitelisted Google families the portal's ROLE fonts reference (display / body / label) —
// the layout emits a <link> for them, in addition to the always-on brand fonts. [] if none.
export function portalGoogleFamilies(portal: PortalSite): string[] {
  const roles = portal.fontRoles
  if (!roles) return []
  const out = new Set<string>()
  for (const ff of [roles.display, roles.body, roles.label]) {
    if (typeof ff === 'string' && ff.startsWith('google:')) {
      const name = ff.slice(7)
      if (isGoogleFamily(name)) out.add(name)
    }
  }
  return Array.from(out)
}
