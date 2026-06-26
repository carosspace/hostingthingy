import type { CSSProperties } from 'react'
import { notFound } from 'next/navigation'
import { getPublicSite, getCheckoutSite } from '@/lib/sites/public'
import { listPaidTiersForOwner, type PublicTier } from '@/lib/memberships/public'
import { THEMES, DEFAULT_THEME, type SiteTheme } from '@/lib/sites/types'
import { fontVars } from '@/lib/sites/fonts'
import { stripeConfigured } from '@/lib/stripe'
import SubscribeButton from './SubscribeButton'

export const dynamic = 'force-dynamic'

// Public SUBSCRIBE page: an owner's paid membership tiers, each with a Subscribe button. The owner is
// resolved from the trusted slug; tiers + prices are read SERVER-SIDE (the button only ever posts a
// tierId). Dormant-safe: with payments unconfigured or no paid tiers, it shows a calm closed state.

// Format a recurring price like "€9.99 / month".
function fmtPrice(t: PublicTier): string {
  let amount: string
  try {
    amount = new Intl.NumberFormat(undefined, { style: 'currency', currency: t.currency.toUpperCase() }).format(t.priceCents / 100)
  } catch {
    amount = `${(t.priceCents / 100).toFixed(2)} ${t.currency.toUpperCase()}`
  }
  return `${amount} / ${t.interval}`
}

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { joined?: string }
}) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const content = site.content
  const theme = THEMES[(content?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const accent = content?.accentColor || theme.accent
  const brand = content?.brand || site.name
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Resolve the owner (admin path) then their paid tiers. Both are dormant-safe → [].
  const checkout = await getCheckoutSite(params.slug)
  const tiers = checkout ? await listPaidTiersForOwner(checkout.ownerId) : []
  const paymentsLive = stripeConfigured()
  const joined = searchParams.joined === '1'

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
  }

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
        {joined ? (
          <div className="text-center py-10">
            <h1 className="font-display italic" style={{ color: theme.text, fontSize: 36, lineHeight: 1.15 }}>
              Welcome
            </h1>
            <p className="font-body mt-5 mx-auto" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 400 }}>
              Your subscription is being set up. Sign in to your portal to access your membership and any member-only courses.
            </p>
            <a
              href="/me"
              className="inline-block font-label mt-8"
              style={{
                background: accent,
                color: theme.bg,
                fontSize: 11,
                letterSpacing: 3,
                textTransform: 'uppercase',
                padding: '14px 28px',
                borderRadius: 11,
              }}
            >
              Go to my portal
            </a>
          </div>
        ) : !paymentsLive || tiers.length === 0 ? (
          <div className="text-center py-10">
            <h1 className="font-display italic" style={{ color: theme.text, fontSize: 32, lineHeight: 1.15 }}>
              Memberships aren&apos;t open yet
            </h1>
            <p className="font-body mt-5 mx-auto" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
              Please check back soon.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h1 className="font-display italic" style={{ color: theme.text, fontSize: 36, lineHeight: 1.15 }}>
                Become a member
              </h1>
              <p className="font-body mt-4 mx-auto" style={{ color: theme.muted, fontSize: 14, lineHeight: 1.6, maxWidth: 380 }}>
                Choose a circle to join {brand}. You can manage or cancel anytime.
              </p>
            </div>

            <div className="mt-12 grid gap-5">
              {tiers.map(t => (
                <div key={t.id} className="p-6 flex flex-col gap-3" style={cardStyle}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-display" style={{ color: theme.text, fontSize: 22, lineHeight: 1.2 }}>
                      {t.name}
                    </h2>
                    <span className="font-body whitespace-nowrap" style={{ color: accent, fontSize: 14 }}>
                      {fmtPrice(t)}
                    </span>
                  </div>
                  {t.description && (
                    <p className="font-body" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.55 }}>
                      {t.description}
                    </p>
                  )}
                  <div className="mt-1">
                    <SubscribeButton
                      slug={params.slug}
                      tierId={t.id}
                      theme={{ bg: theme.bg, text: theme.text, accent }}
                      label={`Subscribe — ${fmtPrice(t)}`}
                    />
                  </div>
                </div>
              ))}
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
