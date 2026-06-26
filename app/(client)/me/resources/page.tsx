import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import { getMyResources, type MyResource } from '@/lib/portal/resources'
import PortalHeader from '../PortalHeader'
import DownloadButton from './DownloadButton'

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

        {resources.length === 0 ? (
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}
          >
            No resources yet. New downloads will appear here.
          </p>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
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
