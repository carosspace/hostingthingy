import { signOutClient } from './actions'

// The public website these clients belong to (single-tenant v1: Anima Temple). The brand
// links back here, and the same Coaching / Energy Healing / Resources menu sits on top.
const SITE_URL = 'https://animatemple.com'
const SITE_NAV: { label: string; href: string }[] = [
  { label: 'Coaching', href: SITE_URL + '/coaching' },
  { label: 'Energy Healing', href: SITE_URL + '/healing' },
  { label: 'Resources', href: SITE_URL + '/resources' },
]

// The portal's shared header chrome: brand (logo or accent label) on the left — now a link
// back to the website — the website menu in the middle, and the client sign-out on the right.
// Used by /me and its sub-pages so the look stays identical. Server component — all colours
// come from props for theme-safety.
export default function PortalHeader({
  brand,
  logoImage,
  theme,
  accent,
  backHref,
  siteUrl = SITE_URL,
}: {
  brand: string
  logoImage?: string
  theme: { muted: string }
  accent: string
  backHref?: string
  siteUrl?: string
}) {
  const linkStyle = { fontSize: 10, letterSpacing: 3, textTransform: 'uppercase' as const, color: theme.muted }
  return (
    <header className="px-6 py-6" style={{ borderBottom: `1px solid ${accent}1f` }}>
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-x-5 gap-y-3 flex-wrap">
        <div className="flex items-center gap-5">
          <a
            href={siteUrl}
            aria-label={`${brand} — back to the website`}
            className="inline-flex items-center transition-opacity hover:opacity-70"
          >
            {logoImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={logoImage} alt={brand} style={{ height: 36, maxWidth: 180, objectFit: 'contain' }} />
            ) : (
              <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
                {brand}
              </span>
            )}
          </a>
          {backHref && (
            <a
              href={backHref}
              className="font-label transition-opacity hover:opacity-70"
              style={linkStyle}
            >
              ← Back
            </a>
          )}
        </div>

        <nav className="flex items-center gap-x-5 gap-y-2 flex-wrap" aria-label="Website">
          {SITE_NAV.map((n) => (
            <a key={n.href} href={n.href} className="font-label transition-opacity hover:opacity-70" style={linkStyle}>
              {n.label}
            </a>
          ))}
          <a
            href="https://blueprint.animatemple.com"
            className="font-label transition-opacity hover:opacity-70"
            style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: accent, border: `1px solid ${accent}59`, borderRadius: 999, padding: '5px 14px' }}
          >
            Divine Blueprint
          </a>
        </nav>

        <form action={signOutClient}>
          <button type="submit" className="font-label transition-opacity hover:opacity-70" style={linkStyle}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  )
}
