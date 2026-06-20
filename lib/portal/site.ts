import { getPublicSite } from '@/lib/sites/public'
import { THEMES, DEFAULT_THEME, type SiteContent, type SiteTheme } from '@/lib/sites/types'

// The slug of the site whose brand the client portal wears. Defaults to the
// Anima Temple site; override per deploy with NEXT_PUBLIC_PORTAL_SITE_SLUG.
export const PORTAL_SITE_SLUG = process.env.NEXT_PUBLIC_PORTAL_SITE_SLUG || 'animatemple'

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
  return { slug, brand, content, theme, accent }
}
