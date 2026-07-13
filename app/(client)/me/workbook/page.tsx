import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import { getMyWorkbook, getMyWorkbookCompanion } from '@/lib/portal/workbook'
import PortalHeader from '../PortalHeader'
import CompanionDownloadButton from '../resources/CompanionDownloadButton'

export const dynamic = 'force-dynamic'

export default async function ClientWorkbookPage({ searchParams }: { searchParams: { w?: string } }) {
  const portal = await getPortalSite()
  const { slug, brand, content, accent } = portal
  const rootStyle = portalRootStyle(portal)
  const { text: portalText, muted: portalMuted } = portalTextColors(portal)

  // Which workbook to open (product slug). Defaults to the original 'tuned-in'.
  const raw = String(searchParams?.w ?? 'tuned-in').toLowerCase()
  const workbookSlug = /^[a-z0-9-]{1,60}$/.test(raw) ? raw : 'tuned-in'

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  const workbook = await getMyWorkbook(slug, workbookSlug)
  const ready = !!workbook && workbook.hasContent
  const entitled = !!workbook && workbook.entitled

  // Entitled + ready → the immersive, full-height workbook in an iframe. The
  // gated /api/client/workbook route re-checks entitlement before serving the HTML.
  if (ready && entitled) {
    // Does this workbook carry a companion printable? (Returns meta only when entitled.)
    const companion = await getMyWorkbookCompanion(slug, workbookSlug)
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#1A1108' }}>
        <div
          className="flex items-center justify-between gap-3 px-4 py-2"
          style={{ borderBottom: `1px solid ${accent}22` }}
        >
          <Link href="/me" className="font-body text-xs hover:opacity-80 flex-shrink-0" style={{ color: accent }}>
            ← {brand}
          </Link>
          <span className="font-body text-xs truncate" style={{ color: `${accent}99` }}>
            {workbook!.title}
          </span>
          <span className="flex-shrink-0">
            {companion
              ? <CompanionDownloadButton workbookSlug={workbookSlug} accent={accent} label="Printable PDF" />
              : <span aria-hidden="true" />}
          </span>
        </div>
        <iframe
          src={`/api/client/workbook?w=${encodeURIComponent(workbookSlug)}`}
          title={workbook!.title}
          className="flex-1 w-full border-0"
          style={{ height: 'calc(100vh - 37px)' }}
        />
      </div>
    )
  }

  // Not ready, or ready-but-not-entitled → the branded portal shell with a message.
  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: portalMuted }}
        accent={accent}
        backHref="/me"
      />
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-20 text-center">
        <h1 className="font-display italic" style={{ color: portalText, fontSize: 40, lineHeight: 1.1 }}>
          {workbook?.title || 'Workbook'}
        </h1>
        {!ready ? (
          <p className="font-body mt-6 mx-auto" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 420 }}>
            Your workbook is being prepared. It will appear here soon.
          </p>
        ) : (
          <>
            <p className="font-body mt-6 mx-auto" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 440 }}>
              This workbook is locked. If you’ve purchased it, enter your unlock code and it will open right here, saved
              to your account.
            </p>
            <Link
              href="/me/redeem"
              className="inline-block mt-8 font-label transition-opacity hover:opacity-90"
              style={{ background: accent, color: '#1A1108', borderRadius: 10, padding: '13px 26px', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}
            >
              Redeem a code
            </Link>
          </>
        )}
      </main>
      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: portalMuted }}>
          {content?.footer || brand}
        </p>
      </footer>
    </div>
  )
}
