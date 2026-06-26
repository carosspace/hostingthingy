import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getBookingPage } from '@/lib/bookings/repo'
import { getOwnerBusyRanges, busyRangesToTaken } from '@/lib/bookings/external-calendar'
import { THEMES, DEFAULT_THEME, type SiteTheme } from '@/lib/sites/types'
import { fontVars } from '@/lib/sites/fonts'
import { stripeConfigured } from '@/lib/stripe'
import BookingForm from './BookingForm'

export const dynamic = 'force-dynamic'

export default async function BookPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { sent?: string; error?: string }
}) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const content = site.content
  const theme = THEMES[(content?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const accent = content?.accentColor || theme.accent
  const brand = content?.brand || site.name
  const data = await getBookingPage(params.slug)
  // "Block busy times": fold the owner's own external calendar (their secret iCal URL, read
  // server-side only) into the taken slots. Dormant-safe — no URL / any failure => no extra ranges
  // => identical behavior. The URL never reaches the client; only the derived busy time-blocks do.
  if (data) {
    const busy = await getOwnerBusyRanges(params.slug, data.settings.windowDays)
    if (busy.length) {
      data.taken = [...data.taken, ...busyRangesToTaken(busy, data.settings.timezone)]
    }
  }
  const services = data?.services ?? []
  const sent = searchParams.sent === '1'
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Editable copy (per-site) with calm defaults; {brand} in successBody is substituted.
  const copy = content?.booking
  const heading = copy?.heading || 'Book a session'
  const intro = copy?.intro || "Choose what feels right, then a time that's open."
  const successTitle = copy?.successTitle || 'Thank you'
  const bookingHost = content?.bookingHost || brand // the name shown to clients on confirmations
  const successBody = (copy?.successBody || 'Your booking request has been sent — {brand} will confirm it by email soon.').replace(/\{brand\}/g, () => bookingHost)
  const closedTitle = copy?.closedTitle || "Booking isn't open yet"
  const closedBody = copy?.closedBody || 'Please check back soon.'

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <header className="px-6 pt-12 pb-8 text-center" style={{ borderBottom: `1px solid ${accent}22` }}>
        {content?.logoImage ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={content.logoImage} alt={brand} style={{ height: 44, maxWidth: 220, objectFit: 'contain', display: 'inline-block' }} />
        ) : (
          <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
            {brand}
          </span>
        )}
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-16">
        {sent ? (
          <div className="text-center py-10">
            <h1 className="font-display italic" style={{ color: theme.text, fontSize: 36, lineHeight: 1.15 }}>{successTitle}</h1>
            <p className="font-body mt-5 mx-auto" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
              {successBody}
            </p>
          </div>
        ) : !data || services.length === 0 ? (
          <div className="text-center py-10">
            <h1 className="font-display italic" style={{ color: theme.text, fontSize: 32, lineHeight: 1.15 }}>{closedTitle}</h1>
            <p className="font-body mt-5 mx-auto" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
              {closedBody}
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-display italic" style={{ color: theme.text, fontSize: 36, lineHeight: 1.15 }}>{heading}</h1>
              <p className="font-body mt-4 mx-auto" style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6, maxWidth: 360 }}>
                {intro}
              </p>
            </div>
            {searchParams.error === 'taken' && (
              <p
                className="font-body text-center mt-6 mx-auto px-4 py-3 rounded-xl"
                style={{ color: theme.text, background: `${accent}14`, border: `1px solid ${accent}33`, fontSize: 13, maxWidth: 420 }}
              >
                Sorry — that time was just taken. Please pick another.
              </p>
            )}
            {searchParams.error === '1' && (
              <p
                className="font-body text-center mt-6 mx-auto px-4 py-3 rounded-xl"
                style={{ color: theme.text, background: `${accent}14`, border: `1px solid ${accent}33`, fontSize: 13, maxWidth: 420 }}
              >
                Please pick a day &amp; time and fill in your name and email.
              </p>
            )}
            {searchParams.error === 'cancelled' && (
              <p
                className="font-body text-center mt-6 mx-auto px-4 py-3 rounded-xl"
                style={{ color: theme.text, background: `${accent}14`, border: `1px solid ${accent}33`, fontSize: 13, maxWidth: 420 }}
              >
                Payment wasn&apos;t completed, so your booking isn&apos;t confirmed yet. Pick a time to try again.
              </p>
            )}
            {searchParams.error === 'payments_off' && (
              <p
                className="font-body text-center mt-6 mx-auto px-4 py-3 rounded-xl"
                style={{ color: theme.text, background: `${accent}14`, border: `1px solid ${accent}33`, fontSize: 13, maxWidth: 420 }}
              >
                Online payment for this service isn&apos;t available right now, so the booking couldn&apos;t be completed. Please reach out directly.
              </p>
            )}
            <div className="mt-12">
              <BookingForm
                slug={params.slug}
                data={data}
                theme={{ bg: theme.bg, text: theme.text, muted: theme.muted, accent }}
                paymentsLive={stripeConfigured()}
                layout={content?.booking?.layout || 'minimal'}
              />
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{content?.footer || brand}</p>
      </footer>
    </div>
  )
}
