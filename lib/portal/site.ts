import { getPublicSite } from '@/lib/sites/public'
import { THEMES, DEFAULT_THEME, getPages, type SiteContent, type SiteTheme, type Gradient } from '@/lib/sites/types'

// The slug of the site whose brand the client portal wears. Defaults to the
// Anima Temple site; override per deploy with NEXT_PUBLIC_PORTAL_SITE_SLUG.
export const PORTAL_SITE_SLUG = process.env.NEXT_PUBLIC_PORTAL_SITE_SLUG || 'animatemple-com'

export interface PortalSite {
  slug: string
  // The brand label shown in the header/footer when there's no logo image.
  brand: string
  // The live site's content (theme/accent/logo/font/footer), or null if the
  // portal's site isn't live / doesn't exist — the page still renders neutrally.
  content: SiteContent | null
  // Resolved theme palette (always present; falls back to DEFAULT_THEME).
  theme: { bg: string; text: string; muted: string; accent: string; label: string }
  // The accent colour (content override or the theme's), used for borders/labels.
  accent: string
  // --- The REAL site look, resolved for the portal (all null-safe). ---------
  // The object pageBackground() reads bg/bgGradient/bgImage/bgOpacity from: the
  // site-wide Site Look if set, else the home page's canvas, else null.
  lookSource: { bg?: string; bgGradient?: Gradient | null; bgImage?: string; bgOpacity?: number } | null
  // The font-system key (Site Look wins over the legacy content.fontSystem).
  fontSystem: string | undefined
  // The per-role font overrides (Site Look, else the home canvas), or null.
  fontRoles: { display?: string; body?: string; label?: string } | null
  // The brand palette swatches (Site Look, else the home canvas), or null.
  palette: string[] | null
}

// Resolves the portal's site once: theme, accent, brand and content for theming.
// THEME-AWARE and crash-proof — if the site isn't found we fall back to the
// default theme + a neutral brand so the portal still renders on any deploy.
export async function getPortalSite(): Promise<PortalSite> {
  const slug = PORTAL_SITE_SLUG
  const site = await getPublicSite(slug)
  const content = site?.content ?? null
  const theme = THEMES[(content?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const accent = content?.accentColor || theme.accent
  const brand = content?.brand || site?.name || 'Anima Temple'

  // Resolve the REAL look the portal should wear, mirroring how the published
  // site sources it: the canonical Site Look first, then the home page's canvas
  // (getPages(content)[0] is always the home page). All null-safe — when there's
  // no content/look/canvas these fall back to undefined/null and the portal
  // degrades to the plain theme palette + font system.
  const homeCanvas = content ? getPages(content)[0]?.canvas ?? null : null
  const lookSource = content?.siteLook ?? homeCanvas ?? null
  const fontSystem = content?.siteLook?.fontSystem ?? content?.fontSystem
  const fontRoles = content?.siteLook?.fontRoles ?? homeCanvas?.fontRoles ?? null
  const palette = content?.siteLook?.palette ?? homeCanvas?.palette ?? null

  return { slug, brand, content, theme, accent, lookSource, fontSystem, fontRoles, palette }
}
