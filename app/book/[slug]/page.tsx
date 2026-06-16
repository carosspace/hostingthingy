import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getBookingPage } from '@/lib/bookings/repo'
import { THEMES, DEFAULT_THEME, type SiteTheme } from '@/lib/sites/types'
import { fontVars } from '@/lib/sites/fonts'
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
  const services = data?.services ?? []
  const sent = searchParams.sent === '1'
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <header className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${accent}2e` }}>
        <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
          {brand}
        </span>
      </header>

      <main className="flex-1 max-w-xl mx-auto w-full px-6 py-14">
        {sent ? (
          <div className="text-center">
            <h1 className="font-display text-4xl italic" style={{ color: theme.text }}>Thank you ✦</h1>
            <p className="font-body mt-4" style={{ color: theme.muted }}>
              Your booking request has been sent. {content?.bookingHost || brand} will confirm it by email soon.
            </p>
          </div>
        ) : !data || services.length === 0 ? (
          <div className="text-center">
            <h1 className="font-display text-3xl italic" style={{ color: theme.text }}>Booking isn&rsquo;t open yet</h1>
            <p className="font-body mt-4" style={{ color: theme.muted }}>Please check back soon.</p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-4xl italic text-center" style={{ color: theme.text }}>Book a session</h1>
            {searchParams.error === 'taken' && (
              <p className="font-body text-center mt-3" style={{ color: '#c0392b' }}>
                Sorry — that time was just taken. Please pick another.
              </p>
            )}
            {searchParams.error === '1' && (
              <p className="font-body text-center mt-3" style={{ color: '#c0392b' }}>
                Please pick a day &amp; time and fill in your name and email.
              </p>
            )}
            <div className="mt-8">
              <BookingForm
                slug={params.slug}
                data={data}
                theme={{ bg: theme.bg, text: theme.text, muted: theme.muted, accent }}
              />
            </div>
          </>
        )}
      </main>

      <footer className="text-center py-8" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{content?.footer || brand}</p>
      </footer>
    </div>
  )
}
