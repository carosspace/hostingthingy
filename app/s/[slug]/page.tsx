import Link from 'next/link'
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

// A real, public, viewable page for a hosted site. Themed by the owner's choice,
// rendering their content when present, otherwise a tasteful placeholder.
export default async function PublicSitePage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const c = site.content
  const theme = THEMES[(c?.theme as SiteTheme) ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME]
  const sections = c?.sections ?? []
  const contactEmail = c?.contactEmail ?? ''
  const hasContent = Boolean(c && (c.headline || c.subheadline || sections.length))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: theme.bg, color: theme.text }}>
      {hasContent ? (
        <main className="flex-1">
          <section className="px-6 pt-28 pb-12 text-center max-w-3xl mx-auto">
            <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: theme.text }}>
              {c?.headline || site.name}
            </h1>
            {c?.subheadline && (
              <p className="font-body text-lg md:text-xl mt-6" style={{ color: theme.muted }}>
                {c.subheadline}
              </p>
            )}
            <div className="mx-auto mt-10 h-px w-16" style={{ background: theme.accent, opacity: 0.6 }} />
          </section>

          {sections.length > 0 && (
            <div className="max-w-2xl mx-auto px-6 pb-16 space-y-12">
              {sections.map((sec, i) => (
                <section key={i}>
                  {sec.heading && (
                    <h2 className="font-display text-3xl italic mb-3" style={{ color: theme.accent }}>
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
                className="inline-block font-label text-[11px] tracking-[3px] uppercase px-8 py-3 rounded-sm"
                style={{ background: theme.accent, color: theme.bg }}
              >
                Get in touch
              </a>
            </section>
          )}
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-xl">
            <p className="font-label text-[11px] tracking-[5px] uppercase" style={{ color: theme.accent }}>
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

      <footer className="text-center py-10">
        <Link href="/" className="font-label text-[9px] tracking-[3px] uppercase" style={{ color: theme.muted, opacity: 0.6 }}>
          Made with Hosting Thingy
        </Link>
      </footer>
    </div>
  )
}
