import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fontVars } from '@/lib/sites/fonts'
import { getPortalSite } from '@/lib/portal/site'
import {
  getMyBlueprints,
  blueprintConfigured,
  blueprintViewUrl,
  type MyBlueprint,
} from '@/lib/portal/blueprint'
import PortalHeader from '../PortalHeader'

export const dynamic = 'force-dynamic'

// A calm, human "Created {date}" label, or null if there's no timestamp.
function formatCreated(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function ClientBlueprintPage() {
  const { brand, content, theme, accent } = await getPortalSite()
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  // The email is the AUTHENTICATED user's verified email — never client input.
  const email = user.email || ''
  const configured = blueprintConfigured()
  // Only query when the module is configured; getMyBlueprints also guards this
  // itself and degrades to [] on any error, so the portal can never crash here.
  const blueprints = configured ? await getMyBlueprints(email) : []

  const footer = content?.footer || brand

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
  }

  function Card({ b }: { b: MyBlueprint }) {
    const created = formatCreated(b.generatedAt)
    const url = blueprintViewUrl(b.id)
    const title = b.name?.trim() || 'Your Divine Blueprint'
    return (
      <div className="p-6 flex flex-col gap-3" style={cardStyle}>
        <div>
          <h2 className="font-display" style={{ color: theme.text, fontSize: 21, lineHeight: 1.2 }}>
            {title}
          </h2>
          {created && (
            <p className="font-body mt-1.5" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.55 }}>
              Created {created}
            </p>
          )}
        </div>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-label transition-opacity hover:opacity-70"
            style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent }}
          >
            Open your blueprint →
          </a>
        ) : (
          <span className="font-body" style={{ fontSize: 12, color: theme.muted, opacity: 0.85 }}>
            Reader link not configured yet.
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: theme.muted }}
        accent={accent}
        backHref="/me"
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <h1 className="font-display italic" style={{ color: theme.text, fontSize: 40, lineHeight: 1.1 }}>
          Your Divine Blueprint
        </h1>
        <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6 }}>
          Your reading, kept safe in one place.
        </p>

        {!configured ? (
          // Envs absent: a gentle placeholder, never an error.
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 420 }}
          >
            Your Divine Blueprint will live here soon.
          </p>
        ) : blueprints.length === 0 ? (
          // Configured, but no reading for this verified email yet.
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 460 }}
          >
            We couldn&apos;t find a blueprint for{' '}
            <span style={{ color: theme.text }}>{email}</span> yet. If you&apos;ve ordered your
            reading, it&apos;ll appear here once it&apos;s ready.
          </p>
        ) : (
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {blueprints.map(b => (
              <Card key={b.id} b={b} />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{footer}</p>
      </footer>
    </div>
  )
}
