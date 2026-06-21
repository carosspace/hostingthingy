import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fontVars } from '@/lib/sites/fonts'
import { getPortalSite } from '@/lib/portal/site'
import { getMyCourses, type MyCourse } from '@/lib/portal/courses'
import PortalHeader from '../PortalHeader'

export const dynamic = 'force-dynamic'

export default async function ClientCoursesPage() {
  const { slug, brand, content, theme, accent } = await getPortalSite()
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  // Graceful: empty list if migration 014 isn't applied (no crash).
  const courses = await getMyCourses(slug)

  const footer = content?.footer || brand

  const cardStyle: CSSProperties = {
    background: `${accent}0a`,
    border: `1px solid ${accent}26`,
    borderRadius: 18,
    overflow: 'hidden',
  }

  function Card({ c }: { c: MyCourse }) {
    return (
      <a href={`/me/courses/${c.id}`} className="flex flex-col transition-opacity hover:opacity-80" style={cardStyle}>
        {c.coverImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={c.coverImage}
            alt={c.title}
            style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
          />
        )}
        <div className="p-6 flex flex-col gap-2">
          <h2 className="font-display" style={{ color: theme.text, fontSize: 21, lineHeight: 1.2 }}>
            {c.title}
          </h2>
          {c.description && (
            <p className="font-body" style={{ color: theme.muted, fontSize: 13, lineHeight: 1.55 }}>
              {c.description}
            </p>
          )}
          <span
            className="font-label mt-1"
            style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: accent }}
          >
            {c.lessonCount} lesson{c.lessonCount === 1 ? '' : 's'}
          </span>
        </div>
      </a>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: theme.muted }}
        accent={accent}
        backHref="/me"
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <h1 className="font-display italic" style={{ color: theme.text, fontSize: 40, lineHeight: 1.1 }}>
          Courses
        </h1>
        <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6 }}>
          Lessons and journeys to walk through, from {brand}.
        </p>

        {courses.length === 0 ? (
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}
          >
            No courses yet. New journeys will appear here.
          </p>
        ) : (
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {courses.map(c => (
              <Card key={c.id} c={c} />
            ))}
          </div>
        )}
      </main>

      <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
        <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{footer}</p>
      </footer>
    </div>
  )
}
