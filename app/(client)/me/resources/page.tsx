import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import { getMyResources, type MyResource } from '@/lib/portal/resources'
import { getMyWorkbooks } from '@/lib/portal/workbook'
import PortalHeader from '../PortalHeader'
import DownloadButton from './DownloadButton'
import ProductDownloadButton from './ProductDownloadButton'
import CompanionDownloadButton from './CompanionDownloadButton'

export const dynamic = 'force-dynamic'

// A short, human label for a file from its mime/name (e.g. "PDF", "Audio", "Image").
function kindLabel(r: MyResource): string {
  const mime = (r.mime || '').toLowerCase()
  const ext = (r.fileName?.split('.').pop() || '').toLowerCase()
  if (mime.startsWith('audio') || ['mp3', 'wav', 'm4a'].includes(ext)) return 'Audio'
  if (mime.startsWith('video') || ['mp4', 'mov'].includes(ext)) return 'Video'
  if (mime.startsWith('image') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return 'Image'
  if (mime.includes('pdf') || ext === 'pdf') return 'PDF'
  if (mime.includes('zip') || ext === 'zip') return 'Archive'
  if (['doc', 'docx'].includes(ext)) return 'Document'
  if (['ppt', 'pptx'].includes(ext)) return 'Slides'
  if (['xls', 'xlsx'].includes(ext)) return 'Sheet'
  return 'File'
}

// Human-readable file size, e.g. "2.4 MB".
function fmtSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n >= 10 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`
}

export default async function ClientResourcesPage() {
  const portal = await getPortalSite()
  const { slug, brand, content, accent } = portal
  const rootStyle = portalRootStyle(portal)
  const { text: portalText, muted: portalMuted } = portalTextColors(portal)

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  // Graceful: empty list if migration 022 isn't applied (no crash).
  const resources = await getMyResources(slug)
  // Interactive workbooks live here too — shown as "open" cards, not downloads. A
  // member may own more than one (e.g. Tuned In + Meeting Yourself); show each.
  const owned = (await getMyWorkbooks(slug).catch(() => []))
    // Entitled + ready, and not a HIDDEN FREE item (free = everyone entitled, so a hidden
    // free product would otherwise surface in every visitor's portal). Hidden paid/members
    // items still show to the people who actually own them.
    .filter(w => w.entitled && w.hasContent && !(w.hidden && w.access === 'free'))
  const openItems = owned.filter(w => w.kind === 'workbook') // interactive → open in portal
  const downloadItems = owned.filter(w => w.kind === 'download') // file → download
  const hasWorkbook = owned.length > 0

  const footer = content?.footer || brand

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
  }

  function Card({ r }: { r: MyResource }) {
    const meta = [kindLabel(r), fmtSize(r.fileSize)].filter(Boolean).join(' · ')
    return (
      <div className="p-6 flex flex-col gap-2" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <span aria-hidden="true" style={{ color: accent, fontSize: 22, lineHeight: 1 }}>⤓</span>
          {meta && (
            <span
              className="font-label"
              style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent }}
            >
              {meta}
            </span>
          )}
        </div>
        <h2 className="font-display" style={{ color: portalText, fontSize: 21, lineHeight: 1.2 }}>
          {r.title}
        </h2>
        {r.description && (
          <p className="font-body" style={{ color: portalMuted, fontSize: 13, lineHeight: 1.55 }}>
            {r.description}
          </p>
        )}
        <DownloadButton slug={slug} resourceId={r.id} accent={accent} />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: portalMuted }}
        accent={accent}
        backHref="/me"
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <h1 className="font-display italic" style={{ color: portalText, fontSize: 40, lineHeight: 1.1 }}>
          Resources
        </h1>
        <p className="font-body mt-3" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6 }}>
          Downloads to keep, from {brand}.
        </p>

        {resources.length === 0 && !hasWorkbook ? (
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}
          >
            No resources yet. New downloads will appear here.
          </p>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {openItems.map(w => (
              <div key={w.slug} className="p-6 flex flex-col gap-2" style={cardStyle}>
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" style={{ color: accent, fontSize: 22, lineHeight: 1 }}>❋</span>
                  <span className="font-label" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent }}>
                    Interactive{w.hasCompanion ? ' + PDF' : ''}
                  </span>
                </div>
                <a
                  href={`/me/workbook?w=${encodeURIComponent(w.slug)}`}
                  className="flex flex-col gap-2 transition-opacity hover:opacity-80"
                >
                  <h2 className="font-display" style={{ color: portalText, fontSize: 21, lineHeight: 1.2 }}>
                    {w.title}
                  </h2>
                  <p className="font-body" style={{ color: portalMuted, fontSize: 13, lineHeight: 1.55 }}>
                    Open it any time — everything you write is saved to your account.
                  </p>
                  <span className="font-label" style={{ marginTop: 6, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent }}>
                    Open workbook →
                  </span>
                </a>
                {w.hasCompanion && <CompanionDownloadButton workbookSlug={w.slug} accent={accent} label="Download printable PDF" />}
              </div>
            ))}
            {downloadItems.map(w => (
              <div key={w.slug} className="p-6 flex flex-col gap-2" style={cardStyle}>
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" style={{ color: accent, fontSize: 22, lineHeight: 1 }}>⤓</span>
                  <span className="font-label" style={{ fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', color: accent }}>
                    Download
                  </span>
                </div>
                <h2 className="font-display" style={{ color: portalText, fontSize: 21, lineHeight: 1.2 }}>{w.title}</h2>
                <ProductDownloadButton productSlug={w.slug} accent={accent} />
              </div>
            ))}
            {resources.map(r => (
              <Card key={r.id} r={r} />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: portalMuted }}>{footer}</p>
      </footer>
    </div>
  )
}
