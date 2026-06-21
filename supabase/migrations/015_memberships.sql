-- 015_memberships.sql — Memberships (client portal Stage 6). The owner creates tiers
-- and grants a client (by email) a membership; a course can be gated to a tier. Free
-- in v1 (owner-granted); paid tiers later. Gating is ENFORCED inside the course-read
-- RPCs (recreated below) so it can't be bypassed from the client.

create table if not exists public.tiers (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  description text,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists tiers_owner_idx on public.tiers (owner_id);

alter table public.tiers enable row level security;
drop policy if exists "owner manages tiers" on public.tiers;
create policy "owner manages tiers" on public.tiers
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- A membership grants a client (identified by email, like bookings/messages) a tier.
create table if not exists public.memberships (
  id           uuid primary key default uuid_generate_v4(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  tier_id      uuid not null references public.tiers(id) on delete cascade,
  client_email text not null,
  created_at   timestamptz not null default now(),
  unique (tier_id, client_email)
);
create index if not exists memberships_owner_idx on public.memberships (owner_id);
create index if not exists memberships_email_idx on public.memberships (lower(client_email));

alter table public.memberships enable row level security;
-- with_check also requires the tier to belong to the owner (no granting into a
-- foreign tier), mirroring the lessons hardening in 014.
drop policy if exists "owner manages memberships" on public.memberships;
create policy "owner manages memberships" on public.memberships
  for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.tiers t where t.id = tier_id and t.owner_id = auth.uid())
  );

-- Gate a course to a tier (null = open to everyone). on delete set null = un-gate if
-- the tier is removed (course stays published + becomes open).
alter table public.courses add column if not exists tier_id uuid references public.tiers(id) on delete set null;

-- Recreate the course-read RPCs (same signatures as 014) with membership GATING:
-- a course is visible only if open (tier_id is null) OR the signed-in client (verified
-- email) holds a membership in that course's tier.
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
    and (
      c.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = c.tier_id
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  order by c.sort asc, c.created_at asc;
$$;
grant execute on function public.get_my_courses(text) to authenticated;

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
    and (
      c.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = c.tier_id
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  order by l.sort asc nulls last, l.created_at asc;
$$;
grant execute on function public.get_my_course(text, uuid) to authenticated;

-- The signed-in client's tiers with the portal's owner (what they're a member of).
create or replace function public.get_my_memberships(p_site_slug text)
returns table (tier_id uuid, name text, description text)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.name, t.description
  from public.memberships m
  join public.tiers t on t.id = m.tier_id
  where m.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
  order by t.sort asc, t.name asc;
$$;
grant execute on function public.get_my_memberships(text) to authenticated;
