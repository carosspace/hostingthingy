import type { CSSProperties } from 'react'
import { THEMES, DEFAULT_THEME, type SiteContent, type SitePage, type SiteTheme, type CtaType } from '@/lib/sites/types'
import { fontVars } from '@/lib/sites/fonts'

export default function PublicPage({
  siteSlug,
  siteName,
  content,
  page,
  pages,
  currentSlug,
}: {
  siteSlug: string
  siteName: string
  content: SiteContent | null
  page: SitePage
  pages: SitePage[]
  currentSlug: string
}) {
  const theme = THEMES[(content?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const accent = content?.accentColor || theme.accent
  const brand = content?.brand || siteName
  const contactEmail = content?.contactEmail ?? ''
  const contactLabel = content?.contactLabel || 'Get in touch'
  const footerText = content?.footer || brand
  const sections = page.sections ?? []
  const heroImage = page.heroImage
  const hasContent = Boolean(page.headline || page.subheadline || sections.length || heroImage)
  const hrefFor = (p: SitePage) => (p.slug === '' ? `/s/${siteSlug}` : `/s/${siteSlug}/${p.slug}`)

  const logo = content?.logoImage
  const visiblePages = pages.filter(p => !p.hidden)
  const navLinks = content?.navLinks ?? []
  const showNav = visiblePages.length > 1 || navLinks.length > 0

  const layout = content?.layout ?? 'contained'
  const bodyMax = layout === 'full' ? 'max-w-6xl' : 'max-w-2xl'

  // Resolve any call-to-action button (used by the hero and by each section).
  function makeCta(label?: string, type?: CtaType, href?: string) {
    const l = (label ?? '').trim()
    const ty = type ?? 'none'
    const h =
      ty === 'booking'
        ? `/book/${siteSlug}`
        : ty === 'email'
          ? contactEmail
            ? `mailto:${contactEmail}`
            : ''
          : ty === 'link'
            ? (href ?? '').trim()
            : ''
    if (!l || !h) return null
    return (
      <a
        href={h}
        className="inline-block font-label"
        style={{ background: accent, color: theme.bg, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: '13px 30px', borderRadius: 3 }}
      >
        {l}
      </a>
    )
  }
  const ctaButton = makeCta(page.ctaLabel, page.ctaType, page.ctaHref)

  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <header className="px-6 py-5 flex flex-col items-center gap-3" style={{ borderBottom: `1px solid ${accent}2e` }}>
        <a href={`/s/${siteSlug}`} className="inline-block">
          {logo ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={logo} alt={brand} style={{ height: 46, maxWidth: 220, objectFit: 'contain' }} />
          ) : (
            <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
              {brand}
            </span>
          )}
        </a>
        {showNav && (
          <nav className="flex flex-wrap items-center justify-center gap-5">
            {visiblePages.map(p => (
              <a
                key={p.id}
                href={hrefFor(p)}
                className="font-label"
                style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: p.slug === currentSlug ? accent : theme.muted }}
              >
                {p.navLabel || p.title}
              </a>
            ))}
            {navLinks.map((l, i) => (
              <a
                key={`nl-${i}`}
                href={l.href}
                target={l.newTab ? '_blank' : undefined}
                rel={l.newTab ? 'noreferrer' : undefined}
                className="font-label"
                style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: theme.muted }}
              >
                {l.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {hasContent ? (
        <main className="flex-1">
          {heroImage ? (
            <section className="relative" style={{ height: '60vh', minHeight: 360 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.42)' }} />
              <div className="relative h-full flex flex-col items-center justify-center text-center px-6">
                <h1 className="font-display text-5xl md:text-7xl italic" style={{ color: '#ffffff' }}>
                  {page.headline || page.title || siteName}
                </h1>
                {page.subheadline && (
                  <p className="font-body text-lg md:text-2xl mt-5" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {page.subheadline}
                  </p>
                )}
                {ctaButton && <div className="mt-8">{ctaButton}</div>}
              </div>
            </section>
          ) : (
            <section className="px-6 pt-24 pb-12 text-center max-w-3xl mx-auto">
              <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: theme.text }}>
                {page.headline || page.title || siteName}
              </h1>
              {page.subheadline && (
                <p className="font-body text-lg md:text-xl mt-6" style={{ color: theme.muted }}>
                  {page.subheadline}
                </p>
              )}
              {ctaButton && <div className="mt-8">{ctaButton}</div>}
              <div className="mx-auto mt-10 h-px w-16" style={{ background: accent, opacity: 0.7 }} />
            </section>
          )}

          {sections.length > 0 && (
            <div className="pt-16 pb-16 space-y-16">
              {sections.map((sec, i) => {
                const secCta = makeCta(sec.ctaLabel, sec.ctaType, sec.ctaHref)
                if (sec.bgImage) {
                  return (
                    <section key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={sec.bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
                      <div className={`relative ${bodyMax} mx-auto px-6 py-20`} style={{ textAlign: sec.align || 'center' }}>
                        {sec.heading && (
                          <h2 className="font-display text-3xl md:text-4xl italic mb-3" style={{ color: '#ffffff' }}>
                            {sec.heading}
                          </h2>
                        )}
                        {sec.body && (
                          <p className="font-body leading-relaxed whitespace-pre-wrap" style={{ color: 'rgba(255,255,255,0.92)' }}>
                            {sec.body}
                          </p>
                        )}
                        {secCta && <div className="mt-6">{secCta}</div>}
                      </div>
                    </section>
                  )
                }
                return (
                  <section
                    key={i}
                    className={sec.bgColor ? '' : `${bodyMax} mx-auto px-6`}
                    style={sec.bgColor ? { background: sec.bgColor } : undefined}
                  >
                    <div className={sec.bgColor ? `${bodyMax} mx-auto px-6 py-16` : ''} style={{ textAlign: sec.align || 'left' }}>
                      {sec.image && (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={sec.image} alt="" className="w-full rounded-sm mb-5" style={{ maxHeight: 420, objectFit: 'cover' }} />
                        </>
                      )}
                      {sec.heading && (
                        <h2 className="font-display text-3xl italic mb-3" style={{ color: accent }}>
                          {sec.heading}
                        </h2>
                      )}
                      {sec.body && (
                        <p className="font-body leading-relaxed whitespace-pre-wrap" style={{ color: theme.text, opacity: 0.85 }}>
                          {sec.body}
                        </p>
                      )}
                      {secCta && <div className="mt-5">{secCta}</div>}
                    </div>
                  </section>
                )
              })}
            </div>
          )}

          {contactEmail && (
            <section className="px-6 pb-24 text-center">
              <a
                href={`mailto:${contactEmail}`}
                className="inline-block font-label"
                style={{ background: accent, color: theme.bg, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', padding: '12px 28px', borderRadius: 3 }}
              >
                {contactLabel}
              </a>
            </section>
          )}
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: theme.text }}>
            {page.title || siteName}
          </h1>
          <p className="font-body text-lg mt-6" style={{ color: theme.muted }}>
            This page is taking shape.
          </p>
        </main>
      )}

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>
          {footerText}
        </p>
      </footer>
    </div>
  )
}
