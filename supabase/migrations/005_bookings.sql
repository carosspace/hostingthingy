-- Hosting Thingy — bookings (services + appointment requests)
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

create extension if not exists "uuid-ossp";

create table if not exists public.services (
  id           uuid primary key default uuid_generate_v4(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  description  text,
  duration_min int  not null default 60,
  price_cents  int  not null default 0,
  currency     text not null default 'eur',
  active       boolean not null default true,
  created_at   timestamptz default now()
);
create index if not exists services_owner_idx on public.services (owner_id);
alter table public.services enable row level security;
drop policy if exists "owner manages services" on public.services;
create policy "owner manages services" on public.services
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.appointments (
  id           uuid primary key default uuid_generate_v4(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  service_id   uuid references public.services(id) on delete set null,
  service_name text,
  client_name  text not null,
  client_email text not null,
  requested_at text,
  note         text,
  status       text not null default 'requested'
               check (status in ('requested','confirmed','cancelled')),
  created_at   timestamptz default now()
);
create index if not exists appointments_owner_idx on public.appointments (owner_id);
alter table public.appointments enable row level security;
drop policy if exists "owner reads appointments" on public.appointments;
create policy "owner reads appointments" on public.appointments
  for select using (auth.uid() = owner_id);
drop policy if exists "owner updates appointments" on public.appointments;
create policy "owner updates appointments" on public.appointments
  for update using (auth.uid() = owner_id);

-- Public: list a site owner's active services (safe fields only, no owner_id).
create or replace function public.get_booking_info(p_slug text)
returns table (service_id uuid, name text, description text, duration_min int, price_cents int, currency text)
language sql security definer set search_path = public as $$
  select sv.id, sv.name, sv.description, sv.duration_min, sv.price_cents, sv.currency
  from public.sites s
  join public.services sv on sv.owner_id = s.owner_id and sv.active = true
  where s.slug = p_slug
  order by sv.created_at;
$$;
grant execute on function public.get_booking_info(text) to anon, authenticated;

-- Public: create a booking request (resolves owner from the site, server-side).
create or replace function public.request_booking(
  p_slug text, p_service_id uuid, p_name text, p_email text, p_when text, p_note text
) returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_sname text;
begin
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return; end if;
  select name into v_sname from public.services where id = p_service_id and owner_id = v_owner;
  insert into public.appointments(owner_id, service_id, service_name, client_name, client_email, requested_at, note)
  values (v_owner, p_service_id, v_sname, nullif(trim(p_name),''), nullif(trim(p_email),''), p_when, p_note);
end; $$;
grant execute on function public.request_booking(text, uuid, text, text, text, text) to anon, authenticated;
