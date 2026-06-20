import { signOutClient } from './actions'

// The portal's shared header chrome: brand (logo or accent label) on the left,
// an optional "← Back" link, and the client sign-out form on the right. Used by
// both /me (the shell) and its sub-pages (e.g. /me/bookings) so the look stays
// identical. Server component — all colours come from props for theme-safety.
export default function PortalHeader({
  brand,
  logoImage,
  theme,
  accent,
  backHref,
}: {
  brand: string
  logoImage?: string
  theme: { muted: string }
  accent: string
  backHref?: string
}) {
  return (
    <header className="px-6 py-6" style={{ borderBottom: `1px solid ${accent}1f` }}>
      <div className="max-w-3xl mx-auto w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          {logoImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logoImage} alt={brand} style={{ height: 36, maxWidth: 180, objectFit: 'contain' }} />
          ) : (
            <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
              {brand}
            </span>
          )}
          {backHref && (
            <a
              href={backHref}
              className="font-label transition-opacity hover:opacity-70"
              style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: theme.muted }}
            >
              ← Back
            </a>
          )}
        </div>
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
  )
}
