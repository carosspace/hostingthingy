-- Hosting Thingy — scheduling (weekly availability + real time-slot bookings)
-- Run in the platform's Supabase project: SQL Editor → paste → Run.
-- Safe to run more than once.

create extension if not exists "uuid-ossp";

-- Per-owner booking settings (timezone, how far ahead, minimum notice, slot step).
create table if not exists public.booking_settings (
  owner_id         uuid primary key references auth.users(id) on delete cascade,
  timezone         text not null default 'UTC',
  window_days      int  not null default 30,
  min_notice_hours int  not null default 12,
  slot_step_min    int  not null default 0,   -- 0 = step by the service's own length
  updated_at       timestamptz default now()
);
alter table public.booking_settings enable row level security;
drop policy if exists "owner manages booking settings" on public.booking_settings;
create policy "owner manages booking settings" on public.booking_settings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Weekly recurring availability windows. weekday: 0=Sun .. 6=Sat (matches JS getDay).
-- Times are minutes from midnight in the owner's timezone. Many rows per owner/day.
create table if not exists public.booking_availability (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  weekday    int  not null check (weekday between 0 and 6),
  start_min  int  not null check (start_min between 0 and 1440),
  end_min    int  not null check (end_min between 0 and 1440),
  created_at timestamptz default now()
);
create index if not exists booking_availability_owner_idx on public.booking_availability (owner_id);
alter table public.booking_availability enable row level security;
drop policy if exists "owner manages availability" on public.booking_availability;
create policy "owner manages availability" on public.booking_availability
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Real chosen slot on each appointment (date + HH:MM + duration snapshot).
alter table public.appointments add column if not exists slot_date    date;
alter table public.appointments add column if not exists slot_time    text;
alter table public.appointments add column if not exists duration_min int;
create index if not exists appointments_owner_slot_idx on public.appointments (owner_id, slot_date);

-- Helper: 'HH:MM' -> minutes from midnight.
create or replace function public.hhmm_to_min(t text) returns int
language sql immutable as $$
  select (split_part(t, ':', 1))::int * 60 + (split_part(t, ':', 2))::int;
$$;

-- Public: everything the booking page needs, resolved from the site slug.
-- No owner_id is ever returned. Returns one JSON object.
create or replace function public.get_booking_page(p_slug text)
returns json language sql security definer set search_path = public as $$
  with site as (select owner_id from public.sites where slug = p_slug limit 1)
  select json_build_object(
    'services', coalesce((
      select json_agg(json_build_object(
        'serviceId', sv.id, 'name', sv.name, 'description', sv.description,
        'durationMin', sv.duration_min, 'priceCents', sv.price_cents, 'currency', sv.currency
      ) order by sv.created_at)
      from public.services sv, site
      where sv.owner_id = site.owner_id and sv.active
    ), '[]'::json),
    'settings', (
      select json_build_object(
        'timezone', coalesce(bs.timezone, 'UTC'),
        'windowDays', coalesce(bs.window_days, 30),
        'minNoticeHours', coalesce(bs.min_notice_hours, 12),
        'slotStepMin', coalesce(bs.slot_step_min, 0)
      )
      from site left join public.booking_settings bs on bs.owner_id = site.owner_id
    ),
    'availability', coalesce((
      select json_agg(json_build_object(
        'weekday', a.weekday, 'startMin', a.start_min, 'endMin', a.end_min
      ))
      from public.booking_availability a, site
      where a.owner_id = site.owner_id
    ), '[]'::json),
    'taken', coalesce((
      select json_agg(json_build_object(
        'date', to_char(ap.slot_date, 'YYYY-MM-DD'), 'time', ap.slot_time, 'durationMin', ap.duration_min
      ))
      from public.appointments ap, site
      where ap.owner_id = site.owner_id
        and ap.status in ('requested', 'confirmed')
        and ap.slot_date is not null
        and ap.slot_date >= current_date
    ), '[]'::json)
  );
$$;
grant execute on function public.get_booking_page(text) to anon, authenticated;

-- Public: book a specific slot. Guards against double-booking (overlap on the same
-- day with an existing requested/confirmed appointment). Returns 'ok'|'taken'|'error'.
create or replace function public.request_booking_slot(
  p_slug text, p_service_id uuid, p_name text, p_email text,
  p_slot_date date, p_slot_time text, p_note text
) returns text language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_sname text; v_dur int; v_start int; v_conflict int;
begin
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return 'error'; end if;

  select name, duration_min into v_sname, v_dur
  from public.services where id = p_service_id and owner_id = v_owner and active;
  if v_dur is null then return 'error'; end if;

  v_start := hhmm_to_min(p_slot_time);

  select count(*) into v_conflict
  from public.appointments ap
  where ap.owner_id = v_owner
    and ap.status in ('requested', 'confirmed')
    and ap.slot_date = p_slot_date
    and ap.slot_time is not null
    and (v_start < hhmm_to_min(ap.slot_time) + coalesce(ap.duration_min, v_dur))
    and (hhmm_to_min(ap.slot_time) < v_start + v_dur);
  if v_conflict > 0 then return 'taken'; end if;

  insert into public.appointments(
    owner_id, service_id, service_name, client_name, client_email,
    slot_date, slot_time, duration_min, note, requested_at
  ) values (
    v_owner, p_service_id, v_sname, nullif(trim(p_name), ''), nullif(trim(p_email), ''),
    p_slot_date, p_slot_time, v_dur, nullif(trim(p_note), ''),
    to_char(p_slot_date, 'YYYY-MM-DD') || ' ' || p_slot_time
  );
  return 'ok';
end; $$;
grant execute on function public.request_booking_slot(text, uuid, text, text, date, text, text) to anon, authenticated;
