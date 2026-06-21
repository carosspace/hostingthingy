import type { CSSProperties } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { fontVars } from '@/lib/sites/fonts'
import { getPortalSite } from '@/lib/portal/site'
import { embedSrc } from '@/lib/sites/embed'
import { getMyCourse, type MyLesson } from '@/lib/portal/courses'
import PortalHeader from '../../PortalHeader'

export const dynamic = 'force-dynamic'

export default async function ClientCourseDetailPage({ params }: { params: { id: string } }) {
  const { slug, brand, content, theme, accent } = await getPortalSite()
  const rootStyle = { background: theme.bg, color: theme.text, ...fontVars(content?.fontSystem) } as unknown as CSSProperties

  // Sub-pages require sign-in; /me itself renders the login. Redirect there.
  const user = await getCurrentUser()
  if (!user) redirect('/me')

  // Graceful: null on error / not found / unpublished (no crash).
  const course = await getMyCourse(slug, params.id)

  const footer = content?.footer || brand

  // Not found / unpublished / not this owner's → a calm message + back link.
  if (!course) {
    return (
      <div className="min-h-screen flex flex-col" style={rootStyle}>
        <PortalHeader
          brand={brand}
          logoImage={content?.logoImage}
          theme={{ muted: theme.muted }}
          accent={accent}
          backHref="/me/courses"
        />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
          <div className="text-center py-16">
            <p className="font-body mx-auto" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}>
              Course not found.
            </p>
            <a
              href="/me/courses"
              className="font-label inline-block mt-6 transition-opacity hover:opacity-70"
              style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: accent }}
            >
              ← Back to courses
            </a>
          </div>
        </main>
        <footer className="text-center py-10" style={{ borderTop: `1px solid ${accent}1f` }}>
          <p className="font-body" style={{ fontSize: 13, color: theme.muted }}>{footer}</p>
        </footer>
      </div>
    )
  }

  function Lesson({ l, index }: { l: MyLesson; index: number }) {
    // video_url renders ONLY via embedSrc — arbitrary / unsupported URLs are ignored.
    const src = l.videoUrl ? embedSrc(l.videoUrl) : null
    return (
      <section>
        <p className="font-label" style={{ fontSize: 10, letterSpacing: 3, textTransform: 'uppercase', color: accent }}>
          Lesson {index + 1}
        </p>
        <h2 className="font-display mt-2" style={{ color: theme.text, fontSize: 24, lineHeight: 1.25 }}>
          {l.title}
        </h2>
        {l.body && (
          <p
            className="font-body whitespace-pre-wrap mt-3"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.65 }}
          >
            {l.body}
          </p>
        )}
        {src && (
          <div
            className="mt-5"
            style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 14, overflow: 'hidden', border: `1px solid ${accent}26` }}
          >
            <iframe
              src={src}
              title={l.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={rootStyle}>
      <PortalHeader
        brand={brand}
        logoImage={content?.logoImage}
        theme={{ muted: theme.muted }}
        accent={accent}
        backHref="/me/courses"
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-16">
        <h1 className="font-display italic" style={{ color: theme.text, fontSize: 40, lineHeight: 1.1 }}>
          {course.title}
        </h1>
        {course.description && (
          <p className="font-body mt-3" style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6 }}>
            {course.description}
          </p>
        )}

        {course.lessons.length === 0 ? (
          <p
            className="font-body text-center mx-auto mt-16"
            style={{ color: theme.muted, fontSize: 15, lineHeight: 1.6, maxWidth: 380 }}
          >
            Lessons are on their way.
          </p>
        ) : (
          <div className="mt-12 flex flex-col gap-12">
            {course.lessons.map((l, i) => (
              <Lesson key={l.id} l={l} index={i} />
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
