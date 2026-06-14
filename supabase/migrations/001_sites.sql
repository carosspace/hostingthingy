-- Hosting Thingy — sites (the websites a user hosts on the platform)
-- Run in the platform's OWN Supabase project (a NEW one, separate from Divine
-- Blueprint). Supabase → SQL Editor → paste → Run.

create extension if not exists "uuid-ossp";

create table if not exists public.sites (
  id         uuid primary key default uuid_generate_v4(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  -- Reserved for future team/multi-tenant support. Unused for now.
  tenant_id  uuid,
  name       text not null,
  slug       text not null,
  template   text not null default 'Blank',
  status     text not null default 'queued'
             check (status in ('queued','building','live','failed','stopped')),
  url        text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists sites_owner_idx on public.sites (owner_id);

alter table public.sites enable row level security;

drop policy if exists "owner reads own sites" on public.sites;
create policy "owner reads own sites" on public.sites
  for select using (auth.uid() = owner_id);

drop policy if exists "owner inserts own sites" on public.sites;
create policy "owner inserts own sites" on public.sites
  for insert with check (auth.uid() = owner_id);

drop policy if exists "owner updates own sites" on public.sites;
create policy "owner updates own sites" on public.sites
  for update using (auth.uid() = owner_id);

drop policy if exists "owner deletes own sites" on public.sites;
create policy "owner deletes own sites" on public.sites
  for delete using (auth.uid() = owner_id);
