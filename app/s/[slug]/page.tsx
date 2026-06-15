import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicSite } from '@/lib/sites/public'

export const dynamic = 'force-dynamic'

const TAGLINES: Record<string, string> = {
  'Coming soon page': 'Something beautiful is on its way.',
  Portfolio: 'Selected work — and how to reach me.',
  'Business site': 'Welcome. Here is what we do.',
  Blog: 'Thoughts, stories, and ideas.',
  Blank: 'A fresh beginning.',
}

// A real, public, viewable page for a hosted site. Renders the owner's content
// when present, otherwise a tasteful placeholder.
export default async function PublicSitePage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const c = site.content
  const sections = c?.sections ?? []
  const hasContent = Boolean(c && (c.headline || c.subheadline || sections.length))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#faf7f2', color: '#1a1612' }}>
      {hasContent ? (
        <main className="flex-1">
          <section className="px-6 pt-28 pb-16 text-center max-w-3xl mx-auto">
            <h1 className="font-display text-5xl md:text-6xl italic" style={{ color: '#1a1612' }}>
              {c?.headline || site.name}
            </h1>
            {c?.subheadline && (
              <p className="font-body text-lg md:text-xl mt-6" style={{ color: '#6b6560' }}>
                {c.subheadline}
              </p>
            )}
          </section>
          {sections.length > 0 && (
            <div className="max-w-2xl mx-auto px-6 pb-24 space-y-12">
              {sections.map((sec, i) => (
                <section key={i}>
                  {sec.heading && (
                    <h2 className="font-display text-3xl italic mb-3" style={{ color: '#1a1612' }}>
                      {sec.heading}
                    </h2>
                  )}
                  {sec.body && (
                    <p className="font-body leading-relaxed whitespace-pre-wrap" style={{ color: '#4a4540' }}>
                      {sec.body}
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="max-w-xl">
            <p className="font-label text-[11px] tracking-[5px] uppercase" style={{ color: '#9a7d2e' }}>
              {site.template}
            </p>
            <h1 className="font-display text-5xl md:text-6xl italic mt-6" style={{ color: '#1a1612' }}>
              {site.name}
            </h1>
            <p className="font-body text-lg mt-6" style={{ color: '#6b6560' }}>
              {TAGLINES[site.template] ?? 'Welcome.'}
            </p>
          </div>
        </main>
      )}
      <footer className="text-center py-10">
        <Link href="/" className="font-label text-[9px] tracking-[3px] uppercase" style={{ color: '#b3a78f' }}>
          Made with Hosting Thingy
        </Link>
      </footer>
    </div>
  )
}
