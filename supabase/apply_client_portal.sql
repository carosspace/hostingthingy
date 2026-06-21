-- ============================================================================
-- CLIENT PORTAL — apply all five migrations in one go (011 → 015, in order).
-- Paste this whole file into Supabase → SQL Editor → Run. Safe to re-run.
-- Turns on: client accounts + login, bookings, two-way messages, courses,
-- memberships + course gating.
-- ============================================================================


-- ====================== 011_client_portal.sql ==============================
-- A "client" is an end-user of a site (NOT the site owner). They sign in with the
-- same magic-link mechanism as owners (Supabase auth.users); a row here marks that
-- auth user as a client of a given owner/site. Email-keyed data is bridged to the
-- client by their VERIFIED auth email in later stages via SECURITY DEFINER RPCs.

create table if not exists public.clients (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  site_id     uuid references public.sites(id) on delete set null,
  email       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  unique (user_id, owner_id)
);

create index if not exists clients_owner_idx on public.clients (owner_id);
create index if not exists clients_user_idx  on public.clients (user_id);

alter table public.clients enable row level security;

drop policy if exists "client reads own" on public.clients;
create policy "client reads own" on public.clients
  for select using (auth.uid() = user_id);

drop policy if exists "client updates own" on public.clients;
create policy "client updates own" on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "owner reads own clients" on public.clients;
create policy "owner reads own clients" on public.clients
  for select using (auth.uid() = owner_id);

drop policy if exists "owner updates own clients" on public.clients;
create policy "owner updates own clients" on public.clients
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner deletes own clients" on public.clients;
create policy "owner deletes own clients" on public.clients
  for delete using (auth.uid() = owner_id);

-- No INSERT policy on purpose: clients self-provision ONLY through the SECURITY
-- DEFINER RPC below, so owner_id is derived from the trusted site slug.
create or replace function public.ensure_client(p_site_slug text)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_site  uuid;
  v_email text;
  v_row   public.clients;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select owner_id, id into v_owner, v_site
  from public.sites
  where slug = p_site_slug
  limit 1;

  if v_owner is null then
    raise exception 'unknown site';
  end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');

  insert into public.clients (user_id, owner_id, site_id, email)
  values (auth.uid(), v_owner, v_site, v_email)
  on conflict (user_id, owner_id)
  do update set site_id = excluded.site_id,
                email   = excluded.email
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.ensure_client(text) to authenticated;


-- ====================== 012_client_bookings.sql ============================
-- A signed-in client sees + cancels THEIR OWN appointments (bridged by verified email).

create or replace function public.get_my_appointments(p_site_slug text)
returns table (
  id           uuid,
  service_name text,
  slot_date    date,
  slot_time    text,
  duration_min int,
  status       text,
  note         text,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.service_name, a.slot_date, a.slot_time,
         a.duration_min, a.status, a.note, a.created_at
  from public.appointments a
  where a.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(a.client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by a.slot_date desc nulls last, a.slot_time desc;
$$;

grant execute on function public.get_my_appointments(text) to authenticated;

create or replace function public.cancel_my_appointment(p_appointment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_status text;
begin
  v_email := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  if v_email is null then
    return 'error';
  end if;

  update public.appointments
     set status = 'cancelled'
   where id = p_appointment_id
     and lower(client_email) = v_email
     and status in ('requested', 'confirmed')
  returning status into v_status;

  if v_status is null then
    return 'notfound';
  end if;
  return 'ok';
end;
$$;

grant execute on function public.cancel_my_appointment(uuid) to authenticated;


-- ====================== 013_client_messages.sql ============================
-- Two-way thread between a client and the owner. `sender` marks direction.

alter table public.messages
  add column if not exists sender text not null default 'client';

do $$
begin
  alter table public.messages
    add constraint messages_sender_chk check (sender in ('client', 'owner'));
exception
  when duplicate_object then null;
end $$;

drop policy if exists "owner inserts own messages" on public.messages;
create policy "owner inserts own messages" on public.messages
  for insert with check (auth.uid() = owner_id);

create or replace function public.get_my_messages(p_site_slug text)
returns table (
  id         uuid,
  sender     text,
  name       text,
  body       text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select m.id,
         m.sender,
         case when m.sender = 'owner' then null else m.name end as name,
         m.body,
         m.created_at
  from public.messages m
  where m.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by m.created_at asc;
$$;

grant execute on function public.get_my_messages(text) to authenticated;

create or replace function public.send_my_message(p_site_slug text, p_body text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_email text;
  v_name  text;
  v_body  text;
begin
  v_email := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  if v_email is null then
    return 'error';
  end if;

  v_body := nullif(btrim(coalesce(p_body, '')), '');
  if v_body is null then
    return 'error';
  end if;
  v_body := left(v_body, 5000);

  select owner_id into v_owner from public.sites where slug = p_site_slug limit 1;
  if v_owner is null then
    return 'error';
  end if;

  if (select count(*) from public.messages
        where owner_id = v_owner
          and lower(email) = v_email
          and created_at > now() - interval '1 minute') >= 20 then
    return 'error';
  end if;

  select coalesce(name, v_email) into v_name
  from public.clients
  where user_id = auth.uid() and owner_id = v_owner;
  if v_name is null then
    v_name := v_email;
  end if;

  insert into public.messages (owner_id, site_slug, name, email, body, read, sender)
  values (v_owner, p_site_slug, v_name, v_email, v_body, false, 'client');

  return 'ok';
end;
$$;

grant execute on function public.send_my_message(text, text) to authenticated;


-- ====================== 014_courses.sql ====================================
-- Owner authors courses + lessons; clients view PUBLISHED ones.

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
create policy "owner manages lessons" on public.lessons
  for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.courses c where c.id = course_id and c.owner_id = auth.uid())
  );

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


-- ====================== 015_memberships.sql ================================
-- Tiers + memberships + course gating. Recreates the two course RPCs above with
-- membership gating (so this section MUST run after the 014 section).

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
drop policy if exists "owner manages memberships" on public.memberships;
create policy "owner manages memberships" on public.memberships
  for all
  using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.tiers t where t.id = tier_id and t.owner_id = auth.uid())
  );

alter table public.courses add column if not exists tier_id uuid references public.tiers(id) on delete set null;

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


-- ====================== 016_revoke_public_exec.sql =========================
-- Lock these RPCs to signed-in users only (CREATE FUNCTION grants EXECUTE to
-- PUBLIC by default; revoke it so anon can't even invoke them).
revoke execute on function public.ensure_client(text)            from public;
revoke execute on function public.get_my_appointments(text)      from public;
revoke execute on function public.cancel_my_appointment(uuid)    from public;
revoke execute on function public.get_my_messages(text)          from public;
revoke execute on function public.send_my_message(text, text)    from public;
revoke execute on function public.get_my_courses(text)           from public;
revoke execute on function public.get_my_course(text, uuid)      from public;
revoke execute on function public.get_my_memberships(text)       from public;

-- ============================================================================
-- Done. Now confirm NEXT_PUBLIC_PORTAL_SITE_SLUG (= animatemple) in Coolify,
-- then sign in at app.animatemple.com/me
-- ============================================================================
