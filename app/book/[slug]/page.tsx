import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { getBookingServices } from '@/lib/bookings/repo'
import { formatPrice } from '@/lib/bookings/types'
import { THEMES, DEFAULT_THEME, type SiteTheme } from '@/lib/sites/types'
import { requestBookingAction } from './actions'

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
  const services = await getBookingServices(params.slug)
  const sent = searchParams.sent === '1'

  const fieldStyle = { background: 'rgba(255,255,255,0.7)', color: '#222', border: '1px solid rgba(0,0,0,0.12)' }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.bg, color: theme.text }}>
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
              Your request has been sent. {brand} will be in touch by email soon.
            </p>
          </div>
        ) : services.length === 0 ? (
          <div className="text-center">
            <h1 className="font-display text-3xl italic" style={{ color: theme.text }}>Booking isn&rsquo;t open yet</h1>
            <p className="font-body mt-4" style={{ color: theme.muted }}>Please check back soon.</p>
          </div>
        ) : (
          <>
            <h1 className="font-display text-4xl italic text-center" style={{ color: theme.text }}>Book a session</h1>
            {searchParams.error === '1' && (
              <p className="font-body text-center mt-3" style={{ color: '#c0392b' }}>
                Please pick a service and fill in your name and email.
              </p>
            )}
            <form action={requestBookingAction} className="mt-8 space-y-5">
              <input type="hidden" name="slug" value={params.slug} />
              <div className="space-y-2">
                {services.map((s, i) => (
                  <label key={s.serviceId} className="flex items-start gap-3 cursor-pointer rounded-sm p-4" style={{ border: `1px solid ${accent}40` }}>
                    <input type="radio" name="serviceId" value={s.serviceId} defaultChecked={i === 0} className="mt-1" style={{ accentColor: accent }} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-body" style={{ color: theme.text }}>{s.name}</span>
                        <span className="font-body text-sm" style={{ color: accent }}>
                          {s.durationMin} min · {formatPrice(s.priceCents, s.currency)}
                        </span>
                      </div>
                      {s.description && <p className="font-body text-sm mt-1" style={{ color: theme.muted }}>{s.description}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <input name="name" required placeholder="Your name" className="w-full px-4 py-3 rounded-sm font-body outline-none" style={fieldStyle} />
              <input name="email" type="email" required placeholder="Your email" className="w-full px-4 py-3 rounded-sm font-body outline-none" style={fieldStyle} />
              <input name="when" placeholder="Preferred day / time (e.g. weekday mornings)" className="w-full px-4 py-3 rounded-sm font-body outline-none" style={fieldStyle} />
              <textarea name="note" rows={3} placeholder="Anything you'd like to share (optional)" className="w-full px-4 py-3 rounded-sm font-body outline-none resize-none" style={fieldStyle} />
              <button className="w-full font-label" style={{ background: accent, color: theme.bg, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: 14, borderRadius: 3 }}>
                Request booking
              </button>
            </form>
          </>
        )}
      </main>

      <footer className="text-center py-8" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{content?.footer || brand}</p>
      </footer>
    </div>
  )
}
