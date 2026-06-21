import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCourse, listLessons, type Course, type Lesson } from '@/lib/courses/repo'
import {
  updateCourseAction,
  deleteCourseAction,
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  moveLessonAction,
} from '../actions'

export const dynamic = 'force-dynamic'

const input =
  'w-full bg-surface border border-gold/20 focus:border-gold/60 text-parchment font-body px-4 py-2.5 rounded-sm outline-none placeholder:text-ash/40'

export default async function CourseEditPage({ params }: { params: { id: string } }) {
  let course: Course | null = null
  let lessons: Lesson[] = []
  let dbError = false
  try {
    course = await getCourse(params.id)
    if (course) lessons = await listLessons(course.id)
  } catch {
    dbError = true
  }

  if (dbError) {
    return (
      <div className="space-y-6 max-w-xl">
        <Link href="/courses" className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold">
          ← Courses
        </Link>
        <div className="border border-gold/15 rounded-sm p-8 text-center">
          <p className="font-body text-parchment">Almost there — switch on courses.</p>
          <p className="font-body text-ash/60 text-sm mt-2">
            Run migration <code className="text-gold/70">014_courses.sql</code> in Supabase, then refresh.
          </p>
        </div>
      </div>
    )
  }

  if (!course) notFound()

  return (
    <div className="space-y-12 max-w-2xl">
      <section>
        <Link href="/courses" className="font-label text-[10px] tracking-[3px] uppercase text-ash hover:text-gold">
          ← Courses
        </Link>
        <h1 className="font-display text-4xl italic text-parchment mt-3">Edit course</h1>
      </section>

      {/* Course details */}
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Details</h2>
        <form action={updateCourseAction} className="border border-gold/15 rounded-sm p-5 space-y-3">
          <input type="hidden" name="id" value={course.id} />
          <input name="title" required defaultValue={course.title} placeholder="Course title" className={input} />
          <textarea
            name="description"
            rows={2}
            defaultValue={course.description ?? ''}
            placeholder="Short description (optional)"
            className={`${input} resize-none`}
          />
          <input name="coverImage" defaultValue={course.coverImage ?? ''} placeholder="Cover image URL (optional)" className={input} />
          <label className="flex items-center gap-2.5 font-body text-parchment text-sm select-none">
            <input
              type="checkbox"
              name="published"
              defaultChecked={course.published}
              className="accent-gold w-4 h-4"
            />
            Published <span className="text-ash/50">— visible to signed-in clients</span>
          </label>
          <div className="flex items-center justify-between gap-3 pt-1">
            <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors">
              Save changes
            </button>
          </div>
        </form>
        <form action={deleteCourseAction} className="mt-3">
          <input type="hidden" name="id" value={course.id} />
          <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">
            Delete course
          </button>
        </form>
      </section>

      {/* Lessons */}
      <section>
        <h2 className="font-label text-[11px] tracking-[4px] uppercase text-gold mb-4">Lessons</h2>

        <div className="space-y-3 mb-6">
          {lessons.length === 0 && <p className="font-body text-ash/60 text-sm">No lessons yet — add the first one below.</p>}
          {lessons.map((l, i) => (
            <div key={l.id} className="border border-gold/10 rounded-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <span className="font-label text-[9px] tracking-[2px] uppercase text-ash/50 pt-1">
                  Lesson {i + 1}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <form action={moveLessonAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="dir" value="up" />
                    <button
                      disabled={i === 0}
                      className="font-label text-[11px] text-ash hover:text-gold disabled:opacity-25 disabled:hover:text-ash"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                  </form>
                  <form action={moveLessonAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <input type="hidden" name="courseId" value={course.id} />
                    <input type="hidden" name="dir" value="down" />
                    <button
                      disabled={i === lessons.length - 1}
                      className="font-label text-[11px] text-ash hover:text-gold disabled:opacity-25 disabled:hover:text-ash"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                  </form>
                </div>
              </div>

              {/* Edit this lesson */}
              <form action={updateLessonAction} className="space-y-3">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <input name="title" required defaultValue={l.title} placeholder="Lesson title" className={input} />
                <textarea
                  name="body"
                  rows={4}
                  defaultValue={l.body ?? ''}
                  placeholder="Lesson body (optional)"
                  className={`${input} resize-y`}
                />
                <input name="videoUrl" defaultValue={l.videoUrl ?? ''} placeholder="Video URL — YouTube or Vimeo (optional)" className={input} />
                <div className="flex items-center gap-3">
                  <button className="font-label text-[10px] tracking-[2px] uppercase border border-gold/40 text-gold hover:bg-gold/10 px-5 py-2 rounded-sm">
                    Save lesson
                  </button>
                </div>
              </form>

              <form action={deleteLessonAction} className="mt-2">
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <button className="font-label text-[9px] tracking-[2px] uppercase text-red-400 hover:text-red-300">Delete lesson</button>
              </form>
            </div>
          ))}
        </div>

        {/* Add a lesson */}
        <form action={createLessonAction} className="border border-gold/15 rounded-sm p-5 space-y-3">
          <input type="hidden" name="courseId" value={course.id} />
          <p className="font-label text-[10px] tracking-[2px] uppercase text-gold/70">Add lesson</p>
          <input name="title" required placeholder="Lesson title" className={input} />
          <textarea name="body" rows={3} placeholder="Lesson body (optional)" className={`${input} resize-y`} />
          <input name="videoUrl" placeholder="Video URL — YouTube or Vimeo (optional)" className={input} />
          <button className="font-label text-[11px] tracking-[3px] uppercase bg-gold text-background hover:bg-goldLight px-6 py-2.5 rounded-sm transition-colors">
            Add lesson
          </button>
        </form>
      </section>
    </div>
  )
}
