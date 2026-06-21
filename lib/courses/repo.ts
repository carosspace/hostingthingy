import { createSupabaseServerClient } from '@/lib/supabase/server'

// ---- Types -------------------------------------------------------------

export interface Course {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  published: boolean
  sort: number
  lessonCount?: number
  // The tier this course is gated to (null = open). Only populated once
  // migration 015 is applied; undefined when the column doesn't exist yet.
  tierId?: string | null
}

export interface Lesson {
  id: string
  courseId: string
  title: string
  body: string | null
  videoUrl: string | null
  sort: number
}

// ---- Owner side (RLS: owner_id = auth.uid()) ---------------------------
// Every read/write below runs through the auth-aware server client, so RLS
// scopes every row to the signed-in owner. Inserts set owner_id from the
// AUTHED user (passed in), never from posted form data.

function mapCourse(r: {
  id: string
  title: string
  description: string | null
  cover_image: string | null
  published: boolean
  sort: number
}): Course {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    coverImage: r.cover_image ?? null,
    published: r.published,
    sort: r.sort,
  }
}

function mapLesson(r: {
  id: string
  course_id: string
  title: string
  body: string | null
  video_url: string | null
  sort: number
}): Lesson {
  return {
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    body: r.body ?? null,
    videoUrl: r.video_url ?? null,
    sort: r.sort,
  }
}

// All of the owner's courses (with a lesson count for the list view).
export async function listCourses(): Promise<Course[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, description, cover_image, published, sort, lessons(count)')
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(r => {
    const course = mapCourse(r as Parameters<typeof mapCourse>[0])
    // PostgREST returns the embedded aggregate as lessons: [{ count }].
    const counts = (r as { lessons?: { count: number }[] }).lessons
    course.lessonCount = Array.isArray(counts) ? counts[0]?.count ?? 0 : 0
    return course
  })
}

export async function getCourse(id: string): Promise<Course | null> {
  const supabase = createSupabaseServerClient()
  // Try to read tier_id (migration 015); fall back to the base columns if the
  // column doesn't exist yet, so pre-015 editing still loads.
  const withTier = await supabase
    .from('courses')
    .select('id, title, description, cover_image, published, sort, tier_id')
    .eq('id', id)
    .maybeSingle()
  if (!withTier.error) {
    if (!withTier.data) return null
    const course = mapCourse(withTier.data)
    course.tierId = (withTier.data as { tier_id?: string | null }).tier_id ?? null
    return course
  }
  if (withTier.error.code !== '42703' && withTier.error.code !== 'PGRST204') {
    throw withTier.error
  }
  const { data, error } = await supabase
    .from('courses')
    .select('id, title, description, cover_image, published, sort')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapCourse(data) : null
}

export async function createCourse(
  ownerId: string,
  input: { title: string; description: string; coverImage: string },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('courses').insert({
    owner_id: ownerId,
    title: input.title,
    description: input.description || null,
    cover_image: input.coverImage || null,
  })
  if (error) throw error
}

// tierId gates the course: a tier id = members of that tier only; null = open to
// everyone; undefined = leave the gating untouched. The tier_id column only
// exists once migration 015 is applied, so we set it OPTIONALLY: if the update
// fails because the column is missing (pre-015), we retry without it so Stage 5
// course editing keeps working.
export async function updateCourse(
  id: string,
  input: {
    title: string
    description: string
    coverImage: string
    published: boolean
    tierId?: string | null
  },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const base = {
    title: input.title,
    description: input.description || null,
    cover_image: input.coverImage || null,
    published: input.published,
    updated_at: new Date().toISOString(),
  }

  // When gating was submitted, try to set tier_id too.
  if (input.tierId !== undefined) {
    const { error } = await supabase
      .from('courses')
      .update({ ...base, tier_id: input.tierId || null })
      .eq('id', id)
    if (!error) return
    // 42703 = undefined_column (Postgres); PGRST204 = column not found in schema
    // cache (PostgREST). Pre-015 → fall through and save the rest of the course.
    if (error.code !== '42703' && error.code !== 'PGRST204') throw error
  }

  const { error } = await supabase.from('courses').update(base).eq('id', id)
  if (error) throw error
}

export async function deleteCourse(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('courses').delete().eq('id', id)
  if (error) throw error
}

// ---- Lessons (owner) ---------------------------------------------------

export async function listLessons(courseId: string): Promise<Lesson[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('lessons')
    .select('id, course_id, title, body, video_url, sort')
    .eq('course_id', courseId)
    .order('sort', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapLesson)
}

export async function createLesson(
  ownerId: string,
  courseId: string,
  input: { title: string; body: string; videoUrl: string },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  // Verify the target course belongs to the caller. RLS scopes this select to
  // auth.uid() = owner_id, so a foreign (or non-existent) course returns null —
  // without this, the lessons RLS (which only checks owner_id) would let an owner
  // attach a lesson to another owner's course by guessing its id.
  const { data: owned } = await supabase
    .from('courses')
    .select('id')
    .eq('id', courseId)
    .maybeSingle()
  if (!owned) throw new Error('course not found or not owned')
  // Append: place new lessons after the current last sibling.
  const { data: last } = await supabase
    .from('lessons')
    .select('sort')
    .eq('course_id', courseId)
    .order('sort', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextSort = (last?.sort ?? -1) + 1
  const { error } = await supabase.from('lessons').insert({
    owner_id: ownerId,
    course_id: courseId,
    title: input.title,
    body: input.body || null,
    video_url: input.videoUrl || null,
    sort: nextSort,
  })
  if (error) throw error
}

export async function updateLesson(
  id: string,
  input: { title: string; body: string; videoUrl: string },
): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase
    .from('lessons')
    .update({
      title: input.title,
      body: input.body || null,
      video_url: input.videoUrl || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function deleteLesson(id: string): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { error } = await supabase.from('lessons').delete().eq('id', id)
  if (error) throw error
}

// Swap a lesson's sort with its adjacent sibling (within the same course),
// moving it up or down one position. RLS scopes both rows to the owner.
export async function moveLesson(id: string, dir: 'up' | 'down'): Promise<void> {
  const supabase = createSupabaseServerClient()
  const { data: me, error: meErr } = await supabase
    .from('lessons')
    .select('id, course_id, sort')
    .eq('id', id)
    .maybeSingle()
  if (meErr) throw meErr
  if (!me) return

  // The nearest sibling on the chosen side, by sort then created_at.
  const asc = dir === 'down'
  const { data: neighbors, error: nErr } = await supabase
    .from('lessons')
    .select('id, sort')
    .eq('course_id', me.course_id)
    .neq('id', me.id)
    .filter('sort', asc ? 'gte' : 'lte', me.sort)
    .order('sort', { ascending: asc })
    .limit(2)
  if (nErr) throw nErr
  // The first row at the same sort could be the item itself's tie; pick the
  // first one whose sort differs, else the first that isn't us at equal sort.
  const sibling = (neighbors ?? []).find(n => n.sort !== me.sort) ?? (neighbors ?? [])[0]
  if (!sibling) return

  // Swap the two sort values.
  const { error: e1 } = await supabase.from('lessons').update({ sort: sibling.sort }).eq('id', me.id)
  if (e1) throw e1
  const { error: e2 } = await supabase.from('lessons').update({ sort: me.sort }).eq('id', sibling.id)
  if (e2) throw e2
}
