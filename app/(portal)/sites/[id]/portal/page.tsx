import Link from 'next/link'
import { getSite } from '@/lib/sites/store'
import { buildPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors, portalGoogleFamilies } from '@/lib/portal/look'
import { googleHref } from '@/lib/sites/googleFonts'
import type { MemberPortalConfig } from '@/lib/sites/types'
import PortalEditorClient from './PortalEditorClient'

export const dynamic = 'force-dynamic'

// The Member-portal editor tab: a live, faithful preview of the client portal home
// (app/(client)/me/page.tsx) on the right, with the owner's controls on the left.
// The look is built from THIS site (not the fixed portal slug) so the preview
// matches what this site's clients will actually see.
export default async function PortalEditorPage({ params }: { params: { id: string } }) {
  const site = await getSite(params.id)
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

  const portal = buildPortalSite(site.slug, site.name, site.content ?? null)
  const rootStyle = portalRootStyle(portal)
  const { text: portalText, muted: portalMuted } = portalTextColors(portal)
  const families = portalGoogleFamilies(portal)
  // The accent the portal inherits from the site (ignoring any portal override),
  // so the editor can show "inherit" as the baseline and reset to it.
  const baseAccent = site.content?.accentColor || portal.theme.accent
  const initial: MemberPortalConfig = site.content?.memberPortal ?? {}

  return (
    <div className="space-y-5">
      {/* Load the same Google role-fonts the live portal uses, so the preview matches. */}
      {families.length > 0 && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={googleHref(families)} />
        </>
      )}

      <div>
        <Link
          href={`/sites/${site.id}`}
          className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold transition-colors"
        >
          ← {site.name}
        </Link>
        <h1 className="font-display text-3xl italic text-parchment mt-2">Member portal</h1>
        <p className="font-body text-ash/60 text-sm mt-1">
          What your clients see when they sign in. Edits preview live — press Save to publish.
        </p>
      </div>

      <PortalEditorClient
        siteId={site.id}
        brand={portal.brand}
        baseAccent={baseAccent}
        rootStyle={rootStyle}
        portalText={portalText}
        portalMuted={portalMuted}
        initial={initial}
      />
    </div>
  )
}
