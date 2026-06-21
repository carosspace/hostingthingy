-- 014_courses.sql — Courses module (client portal Stage 5). The owner authors
-- courses + lessons; signed-in clients of that owner view PUBLISHED ones.
-- Gating/enrollment is Stage 6 (Memberships); for now any signed-in client of the
-- owner can view published courses.

create table if not exists public.courses (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  cover_image text,
  published   boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists courses_owner_idx on public.courses (owner_id);

alter table public.courses enable row level security;
drop policy if exists "owner manages courses" on public.courses;
create policy "owner manages courses" on public.courses
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.lessons (
  id         uuid primary key default uuid_generate_v4(),
  course_id  uuid not null references public.courses(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text,
  video_url  text,
  sort       int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists lessons_course_idx on public.lessons (course_id);

alter table public.lessons enable row level security;
drop policy if exists "owner manages lessons" on public.lessons;
-- with_check also requires the lesson's course to belong to the caller, so an owner
-- cannot attach a lesson to another owner's course even by guessing its id.
create policy "owner manages lessons" on public.lessons
  for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.courses c where c.id = course_id and c.owner_id = auth.uid())
  );

-- Signed-in client reads PUBLISHED courses for the portal's owner (owner from the
-- trusted slug). Includes a lesson count for the list view.
create or replace function public.get_my_courses(p_site_slug text)
returns table (
  id          uuid,
  title       text,
  description text,
  cover_image text,
  lesson_count bigint,
  sort        int
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.title, c.description, c.cover_image,
         (select count(*) from public.lessons l where l.course_id = c.id and l.owner_id = c.owner_id) as lesson_count,
         c.sort
  from public.courses c
  where c.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and c.published = true
  order by c.sort asc, c.created_at asc;
$$;

grant execute on function public.get_my_courses(text) to authenticated;

-- Signed-in client reads ONE published course + its lessons (denormalized: course
-- fields repeat per lesson; a course with no lessons returns one row with null lesson
-- fields). Only resolves if the course is published AND owned by the portal owner.
create or replace function public.get_my_course(p_site_slug text, p_course_id uuid)
returns table (
  course_id          uuid,
  course_title       text,
  course_description text,
  cover_image        text,
  lesson_id          uuid,
  lesson_title       text,
  lesson_body        text,
  lesson_video       text,
  lesson_sort        int
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.title, c.description, c.cover_image,
         l.id, l.title, l.body, l.video_url, l.sort
  from public.courses c
  left join public.lessons l on l.course_id = c.id and l.owner_id = c.owner_id
  where c.id = p_course_id
    and c.published = true
    and c.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
  order by l.sort asc nulls last, l.created_at asc;
$$;

grant execute on function public.get_my_course(text, uuid) to authenticated;
