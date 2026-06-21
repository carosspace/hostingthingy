import Link from 'next/link'
import { listCourses, type Course } from '@/lib/courses/repo'
import { createCourseAction } from './actions'

export const dynamic = 'force-dynamic'

const input =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-2.5 rounded-sm outline-none placeholder:text-ash/40'

export default async function CoursesPage() {
  let courses: Course[] = []
  let dbError = false
  try {
    courses = await listCourses()
  } catch {
    dbError = true
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <h1 className="font-display text-4xl italic text-parchment">Courses</h1>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on courses.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">014_courses.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-12 max-w-2xl">
      <section>
        <h1 className="font-display text-4xl italic text-parchment">Courses</h1>
        <p className="font-body text-ash mt-2 text-sm">
          Author lessons and journeys. Signed-in clients see the ones you publish.
        </p>
      </section>

      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">New course</h2>
        <form action={createCourseAction} className="border border-gold/15 rounded-sm p-5 space-y-3 mb-8">
          <input name="title" required placeholder="Course title (e.g. The Inner Temple)" className={input} />
          <textarea name="description" rows={2} placeholder="Short description (optional)" className={`${input} resize-none`} />
          <input name="coverImage" placeholder="Cover image URL (optional)" className={input} />
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors">
            Create course
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Your courses</h2>
        <div className="space-y-2">
          {courses.length === 0 && <p className="font-body text-ash/60 text-sm">No courses yet — create one above.</p>}
          {courses.map(c => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="border border-gold/10 rounded-sm p-4 flex items-center justify-between gap-4 hover:border-gold/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-body text-parchment truncate">{c.title}</p>
                <p className="font-body text-ash/60 text-sm mt-0.5">
                  {c.lessonCount ?? 0} lesson{(c.lessonCount ?? 0) === 1 ? '' : 's'}
                  {c.description ? ` · ${c.description}` : ''}
                </p>
              </div>
              <span
                className={`font-label text-[9px] tracking-[2px] uppercase shrink-0 ${
                  c.published ? 'text-green-400' : 'text-ash/50'
                }`}
              >
                {c.published ? 'Published' : 'Draft'}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
