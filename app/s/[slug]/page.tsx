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

// A real, public, viewable page for a hosted site. This is what visitors see at
// /s/<slug> — the platform serves the site itself (until the full engine lands).
export default async function PublicSitePage({ params }: { params: { slug: string } }) {
  const site = await getPublicSite(params.slug)
  if (!site) notFound()

  const tagline = TAGLINES[site.template] ?? 'Welcome.'

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
      style={{ background: '#faf7f2', color: '#1a1612' }}
    >
      <div className="max-w-xl">
        <p className="font-label text-[11px] tracking-[5px] uppercase" style={{ color: '#9a7d2e' }}>
          {site.template}
        </p>
        <h1 className="font-display text-5xl md:text-6xl italic mt-6" style={{ color: '#1a1612' }}>
          {site.name}
        </h1>
        <p className="font-body text-lg mt-6" style={{ color: '#6b6560' }}>
          {tagline}
        </p>
      </div>
      <Link
        href="/"
        className="mt-16 font-label text-[9px] tracking-[3px] uppercase"
        style={{ color: '#b3a78f' }}
      >
        Made with Hosting Thingy
      </Link>
    </div>
  )
}
