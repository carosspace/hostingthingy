import { getPortalSite } from '@/lib/portal/site'
import { portalGoogleFamilies } from '@/lib/portal/look'
import { googleHref } from '@/lib/sites/googleFonts'

// The (client) route group is the END-USER portal — separate from the owner
// (portal) area. It is intentionally NOT auth-gated here: each page (e.g. /me)
// decides what to show logged-out vs logged-in, so the magic-link login renders
// in-place. Theming is applied per-page (theme-aware roots).
//
// The one thing this layout owns is the Site-Look role Google Fonts: it resolves
// the portal site once and emits a single stylesheet <link> for ONLY the Google
// families the owner's role fonts use, so those fonts load across every /me/*
// page (exactly like CanvasView emits its per-page Google <link>). Crash-safe:
// when there are no Google role fonts (or no custom look) it renders nothing.
export default async function ClientAreaLayout({ children }: { children: React.ReactNode }) {
  const portal = await getPortalSite()
  const families = portalGoogleFamilies(portal)
  return (
    <>
      {/* The Anima Temple brand faces — always loaded so the portal wears the same
          Cormorant / Mulish / Space Grotesk type as the public website. */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Mulish:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600&display=swap"
      />
      {/* Plus any Google families the owner's role fonts use (Site Look). */}
      {families.length > 0 && <link rel="stylesheet" href={googleHref(families)} />}
      {children}
    </>
  )
}
