-- Hosting Thingy — newsletter subscribers (website popup → owner's Subscribers list)
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

create extension if not exists "uuid-ossp";

create table if not exists public.newsletter_subscribers (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  site_slug   text,
  email       text not null,
  source      text,
  created_at  timestamptz default now(),
  unique (owner_id, email)
);
create index if not exists newsletter_owner_idx on public.newsletter_subscribers (owner_id, created_at desc);
alter table public.newsletter_subscribers enable row level security;

-- Owner reads / deletes their own subscribers. No insert via RLS — visitors subscribe through the
-- SECURITY DEFINER function below (which resolves the owner from the site slug), never directly.
drop policy if exists "owner reads subscribers" on public.newsletter_subscribers;
create policy "owner reads subscribers" on public.newsletter_subscribers
  for select using (auth.uid() = owner_id);
drop policy if exists "owner deletes subscribers" on public.newsletter_subscribers;
create policy "owner deletes subscribers" on public.newsletter_subscribers
  for delete using (auth.uid() = owner_id);

-- Public: subscribe to a site's newsletter. Owner resolved from the slug server-side, so a visitor
-- can never target another owner or read anything. Idempotent on (owner, email). Returns
-- 'ok' | 'invalid' (bad email) | 'error' (unknown site).
create or replace function public.subscribe_newsletter(p_slug text, p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_email text;
begin
  v_email := lower(trim(coalesce(p_email, '')));
  if position('@' in v_email) = 0 or length(v_email) < 3 then return 'invalid'; end if;
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return 'error'; end if;
  insert into public.newsletter_subscribers(owner_id, site_slug, email, source)
  values (v_owner, p_slug, left(v_email, 200), 'website')
  on conflict (owner_id, email) do nothing;
  return 'ok';
end; $$;
grant execute on function public.subscribe_newsletter(text, text) to anon, authenticated;
