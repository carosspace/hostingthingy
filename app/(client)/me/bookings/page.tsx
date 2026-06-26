import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getPortalSite } from '@/lib/portal/site'
import { portalRootStyle, portalTextColors } from '@/lib/portal/look'
import { formatDayLabel, formatTimeLabel } from '@/lib/bookings/types'
import { getMyAppointments, type MyAppointment } from '@/lib/portal/bookings'
import PortalHeader from '../PortalHeader'
import { cancelAppointment } from './actions'

export const dynamic = 'force-dynamic'

// Today as 'YYYY-MM-DD' (UTC), to match the date strings the RPC returns.
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default async function ClientBookingsPage() {
  const portal = await getPortalSite()
  const { slug, brand, content, accent } = portal
  const rootStyle = portalRootStyle(portal)
  const { text: portalText, muted: portalMuted } = portalTextColors(portal)

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  const appointments = await getMyAppointments(slug)
  const today = todayISO()

  // UPCOMING = not cancelled AND (no date yet, or a future-or-today slot). Undated
  // pending requests (legacy 005 path) count as upcoming so they stay cancellable.
  // Everything else (genuinely past dates, cancelled) is PAST/OTHER.
  const isUpcoming = (a: MyAppointment) =>
    a.status !== 'cancelled' && (!a.slotDate || a.slotDate >= today)
  const upcoming = appointments.filter(isUpcoming)
  const past = appointments.filter(a => !isUpcoming(a))
  // Upcoming reads best ascending (soonest first); the RPC sorts desc.
  upcoming.reverse()

  const footer = content?.footer || brand

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
  }

  // Status pill: theme-safe on all 4 themes. confirmed = accent, requested =
  // a gentle neutral (text at low alpha), cancelled = muted.
  function statusPill(status: MyAppointment['status']) {
    const base: CSSProperties = {
      fontSize: 9,
      letterSpacing: 2,
      textTransform: 'uppercase',
      padding: '4px 10px',
      borderRadius: 999,
      whiteSpace: 'nowrap',
    }
    if (status === 'confirmed') {
      return { style: { ...base, background: `${accent}1a`, color: accent }, label: 'Confirmed' }
    }
    if (status === 'cancelled') {
      return { style: { ...base, background: `${portalMuted}1f`, color: portalMuted }, label: 'Cancelled' }
    }
    // requested
    return { style: { ...base, background: `${portalText}14`, color: portalMuted, border: `1px solid ${portalMuted}33` }, label: 'Pending' }
  }

  function Card({ a }: { a: MyAppointment }) {
    const pill = statusPill(a.status)
    const canCancel = a.status === 'requested' || a.status === 'confirmed'
    const showCancel = canCancel && isUpcoming(a)
    return (
      <div className="p-5 flex flex-col gap-3" style={cardStyle}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display" style={{ color: portalText, fontSize: 19, lineHeight: 1.2 }}>
            {a.serviceName || 'Session'}
          </h3>
          <span className="font-label" style={pill.style}>{pill.label}</span>
        </div>
        <p className="font-body" style={{ color: portalMuted, fontSize: 14, lineHeight: 1.5 }}>
          {a.slotDate ? formatDayLabel(a.slotDate) : 'Date to be confirmed'}
          {a.slotTime ? ` · ${formatTimeLabel(a.slotTime)}` : ''}
          {a.durationMin ? ` · ${a.durationMin} min` : ''}
        </p>
        {a.note && (
          <p className="font-body" style={{ color: portalMuted, fontSize: 13, lineHeight: 1.5, opacity: 0.85 }}>
            {a.note}
          </p>
        )}
        {showCancel && (
          <form action={cancelAppointment} className="mt-1">
            <input type="hidden" name="id" value={a.id} />
            <button
              type="submit"
              className="font-label transition-opacity hover:opacity-70"
              style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: portalMuted }}
            >
              Cancel session
            </button>
          </form>
        )}
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
          Your sessions
        </h1>

        {appointments.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-body mx-auto" style={{ color: portalMuted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
              You have no sessions yet.
            </p>
            <a
              href={`/book/${slug}`}
              className="font-label inline-block mt-6 transition-opacity hover:opacity-70"
              style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent }}
            >
              Book a session →
            </a>
          </div>
        ) : (
          <div className="mt-12 flex flex-col gap-12">
            {upcoming.length > 0 && (
              <section>
                <p className="font-label" style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: accent }}>
                  Upcoming
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  {upcoming.map(a => <Card key={a.id} a={a} />)}
                </div>
              </section>
            )}

            {past.length > 0 && (
              <section>
                <p className="font-label" style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: portalMuted }}>
                  Past
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  {past.map(a => <Card key={a.id} a={a} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: portalMuted }}>{footer}</p>
      </footer>
    </div>
  )
}
