import { createSupabaseServerClient } from '@/lib/supabase/server'

// A published course as the signed-in client sees it in the list (from get_my_courses).
export interface MyCourse {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  lessonCount: number
}

// One lesson within a course the client is viewing.
export interface MyLesson {
  id: string
  title: string
  body: string | null
  videoUrl: string | null
  sort: number
}

// A single published course + its lessons, reassembled from the denormalized RPC.
export interface MyCourseDetail {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  lessons: MyLesson[]
}

// The portal owner's PUBLISHED courses (owner resolved server-side from the
// trusted slug by the get_my_courses RPC — we never pass an owner id).
// GRACEFUL DEGRADE: any error (e.g. migration 014 not applied) returns [] + logs,
// so the page renders an empty list instead of crashing.
export async function getMyCourses(slug: string): Promise<MyCourse[]> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_courses', { p_site_slug: slug })
    if (error) {
      console.error('[client-portal] get_my_courses failed (migration 014 applied?):', error.message)
      return []
    }
    return (data ?? []).map(
      (r: {
        id: string
        title: string
        description: string | null
        cover_image: string | null
        lesson_count: number | string | null
        sort: number
      }) => ({
        id: r.id,
        title: r.title,
        description: r.description ?? null,
        coverImage: r.cover_image ?? null,
        // lesson_count is bigint → may arrive as a string; coerce to a number.
        lessonCount: Number(r.lesson_count ?? 0) || 0,
      }),
    )
  } catch (e) {
    console.error('[client-portal] get_my_courses threw:', e)
    return []
  }
}

// One PUBLISHED course + its lessons. The get_my_course RPC returns DENORMALIZED
// rows — the course fields repeat on every row, with one row per lesson (and a
// lessonless course returns a single row with null lesson_* fields). We reassemble
// those rows into one course object with a deduped, ordered lessons array.
// Returns null if the course isn't found / isn't published / errored.
export async function getMyCourse(slug: string, courseId: string): Promise<MyCourseDetail | null> {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.rpc('get_my_course', {
      p_site_slug: slug,
      p_course_id: courseId,
    })
    if (error) {
      console.error('[client-portal] get_my_course failed (migration 014 applied?):', error.message)
      return null
    }
    const rows = (data ?? []) as {
      course_id: string
      course_title: string
      course_description: string | null
      cover_image: string | null
      lesson_id: string | null
      lesson_title: string | null
      lesson_body: string | null
      lesson_video: string | null
      lesson_sort: number | null
    }[]
    // No rows at all → not found / unpublished / not this owner's.
    if (rows.length === 0) return null

    const head = rows[0]
    const lessons: MyLesson[] = rows
      // Drop the null-lesson row(s) (= a lessonless course → empty lessons).
      .filter(r => r.lesson_id != null)
      .map(r => ({
        id: r.lesson_id as string,
        title: r.lesson_title ?? '',
        body: r.lesson_body ?? null,
        videoUrl: r.lesson_video ?? null,
        sort: r.lesson_sort ?? 0,
      }))

    return {
      id: head.course_id,
      title: head.course_title,
      description: head.course_description ?? null,
      coverImage: head.cover_image ?? null,
      lessons,
    }
  } catch (e) {
    console.error('[client-portal] get_my_course threw:', e)
    return null
  }
}
