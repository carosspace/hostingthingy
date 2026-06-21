import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fontVars } from '@/lib/sites/fonts'
import { getPortalSite } from '@/lib/portal/site'
import { getMyMemberships, type MyMembership } from '@/lib/portal/memberships'
import PortalHeader from '../PortalHeader'

export const dynamic = 'force-dynamic'

export default async function ClientMembershipsPage() {
  const { slug, brand, content, theme, accent } = await getPortalSite()
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  // Graceful: empty list if migration 015 isn't applied (no crash).
  const memberships = await getMyMemberships(slug)

  const footer = content?.footer || brand

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
  }

  function Card({ m }: { m: MyMembership }) {
    return (
      <div className="p-6 flex flex-col gap-2" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <span aria-hidden="true" style={{ color: accent, fontSize: 22, lineHeight: 1 }}>♢</span>
        </div>
        <h2 className="font-display" style={{ color: theme.text, fontSize: 21, lineHeight: 1.2 }}>
          {m.name}
        </h2>
        {m.description && (
          <p className="font-body" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.55 }}>
            {m.description}
          </p>
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
          Memberships
        </h1>
        <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6 }}>
          The circles you hold with {brand}.
        </p>

        {memberships.length === 0 ? (
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}
          >
            You don&apos;t have any memberships yet.
          </p>
        ) : (
          <>
            <div className="mt-12 grid gap-5 sm:grid-cols-2">
              {memberships.map(m => (
                <Card key={m.tierId} m={m} />
              ))}
            </div>
            <p className="font-body mt-8" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.6 }}>
              Member-only courses appear under Courses.
            </p>
          </>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{footer}</p>
      </footer>
    </div>
  )
}
