import type { CSSProperties } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { fontVars } from '@/lib/sites/fonts'
import { getPortalSite } from '@/lib/portal/site'
import ClientLogin from './ClientLogin'
import { signOutClient } from './actions'

export const dynamic = 'force-dynamic'

// The signed-in client row returned by the ensure_client RPC.
interface ClientRow {
  id: string
  email: string
  name: string | null
}

// The five portal modules. Stage 1: present + beautiful but inactive.
const MODULES: { title: string; icon: string; desc: string }[] = [
  { title: 'Your Divine Blueprint', icon: '✦', desc: 'Your reading, kept safe in one place.' },
  { title: 'Bookings', icon: '◷', desc: 'Your sessions — past and upcoming.' },
  { title: 'Messages', icon: '✉', desc: 'Talk with {brand}, privately.' },
  { title: 'Courses', icon: '❖', desc: 'Lessons and journeys to walk through.' },
  { title: 'Memberships', icon: '♢', desc: 'Your circle and what it unlocks.' },
]

export default async function ClientPortalPage() {
  const { slug, brand, content, theme, accent } = await getPortalSite()
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  const user = await getCurrentUser()

  // --- Logged out: branded magic-link login -------------------------------
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16" style={rootStyle}>
        <ClientLogin brand={brand} logoImage={content?.logoImage} theme={{ bg: theme.bg, text: theme.text, muted: theme.muted, accent }} />
      </div>
    )
  }

  // --- Logged in: provision + fetch the client row ------------------------
  // ensure_client self-provisions this auth user as a client of the portal's
  // site. If migration 011 isn't applied yet, the RPC errors — degrade
  // gracefully and render the shell from the auth user's email.
  let client: ClientRow | null = null
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('ensure_client', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] ensure_client failed (migration 011 applied?):', error.message)
    } else {
      const row = Array.isArray(data) ? data[0] : data
      if (row) client = row as ClientRow
    }
  } catch (e) {
    console.error('[client-portal] ensure_client threw:', e)
  }

  const email = client?.email || user.email || 'friend'
  const displayName = client?.name?.trim() || ''
  const footer = content?.footer || brand

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
  }
  const pillStyle: CSSProperties = {
    background: `${accent}1a`,
    color: accent,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 999,
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      {/* Header: brand left, sign-out right */}
      <header className="px-6 py-6" style={{ borderBottom: `1px solid ${accent}1f` }}>
        <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
          {content?.logoImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={content.logoImage} alt={brand} style={{ height: 36, maxWidth: 180, objectFit: 'contain' }} />
          ) : (
            <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
              {brand}
            </span>
          )}
          <form action={signOutClient}>
            <button
              type="submit"
              className="font-label transition-opacity hover:opacity-70"
              style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: theme.muted }}
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        {/* Greeting */}
        <div>
          <h1 className="font-display italic" style={{ color: theme.text, fontSize: 40, lineHeight: 1.1 }}>
            Welcome{displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6 }}>
            Signed in as <span style={{ color: theme.text }}>{email}</span>. This is your space with {brand} — everything in one calm place.
          </p>
        </div>

        {/* Module grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {MODULES.map(m => (
            <div key={m.title} className="p-6 flex flex-col gap-3" style={cardStyle}>
              <div className="flex items-start justify-between gap-3">
                <span aria-hidden="true" style={{ color: accent, fontSize: 22, lineHeight: 1 }}>{m.icon}</span>
                <span className="font-label" style={pillStyle}>Coming soon</span>
              </div>
              <div>
                <h2 className="font-display" style={{ color: theme.text, fontSize: 21, lineHeight: 1.2 }}>{m.title}</h2>
                <p className="font-body mt-1.5" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.55 }}>
                  {m.desc.replace(/\{brand\}/g, () => brand)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{footer}</p>
      </footer>
    </div>
  )
}
