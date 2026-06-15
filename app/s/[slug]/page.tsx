import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'
import { THEMES, DEFAULT_THEME, type SiteTheme } from '@/lib/sites/types'

export const dynamic = 'force-dynamic'

const TAGLINES: Record<string, string> = {
  'Coming soon page': 'Something beautiful is on its way.',
  Portfolio: 'Selected work — and how to reach me.',
  'Business site': 'Welcome. Here is what we do.',
  Blog: 'Thoughts, stories, and ideas.',
  Blank: 'A fresh beginning.',
}

export default async function PublicSitePage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const c = site.content
  const theme = THEMES[(c?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const accent = c?.accentColor || theme.accent
  const brand = c?.brand || site.name
  const sections = c?.sections ?? []
  const contactEmail = c?.contactEmail ?? ''
  const contactLabel = c?.contactLabel || 'Get in touch'
  const heroImage = c?.heroImage
  const footerText = c?.footer || brand
  const hasContent = Boolean(c && (c.headline || c.subheadline || sections.length || heroImage))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      <header className="px-6 py-5 text-center" style={{ borderBottom: `1px solid ${accent}2e` }}>
        <span className="font-label" style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: accent }}>
          {brand}
        </span>
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
                  {c?.headline || site.name}
                </h1>
                {c?.subheadline && (
                  <p className="font-body text-lg md:text-2xl mt-5" style={{ color: 'rgba(255,255,255,0.92)' }}>
                    {c.subheadline}
                  </p>
                )}
              </div>
            </section>
          ) : (
            <section className="px-6 pt-24 pb-12 text-center max-w-3xl mx-auto">
              <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: theme.text }}>
                {c?.headline || site.name}
              </h1>
              {c?.subheadline && (
                <p className="font-body text-lg md:text-xl mt-6" style={{ color: theme.muted }}>
                  {c.subheadline}
                </p>
              )}
              <div className="mx-auto mt-10 h-px w-16" style={{ background: accent, opacity: 0.7 }} />
            </section>
          )}

          {sections.length > 0 && (
            <div className="max-w-2xl mx-auto px-6 pt-16 pb-16 space-y-16">
              {sections.map((sec, i) => (
                <section key={i}>
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
                </section>
              ))}
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
          <div className="max-w-xl">
            <p className="font-label text-[11px] tracking-[5px] uppercase" style={{ color: accent }}>
              {site.template}
            </p>
            <h1 className="font-display text-5xl md:text-6xl italic mt-6" style={{ color: theme.text }}>
              {site.name}
            </h1>
            <p className="font-body text-lg mt-6" style={{ color: theme.muted }}>
              {TAGLINES[site.template] ?? 'Welcome.'}
            </p>
          </div>
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
