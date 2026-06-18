-- Hosting Thingy — contact form messages (visitor → owner inbox)
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

create extension if not exists "uuid-ossp";

create table if not exists public.messages (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  site_slug   text,
  name        text,
  email       text,
  body        text not null,
  read        boolean not null default false,
  created_at  timestamptz default now()
);
create index if not exists messages_owner_idx on public.messages (owner_id, created_at desc);
alter table public.messages enable row level security;

-- Owner can read / update (mark read) / delete their own messages. No insert via RLS
-- (visitors insert through the SECURITY DEFINER function below, never directly).
drop policy if exists "owner reads messages" on public.messages;
create policy "owner reads messages" on public.messages
  for select using (auth.uid() = owner_id);
drop policy if exists "owner updates messages" on public.messages;
create policy "owner updates messages" on public.messages
  for update using (auth.uid() = owner_id);
drop policy if exists "owner deletes messages" on public.messages;
create policy "owner deletes messages" on public.messages
  for delete using (auth.uid() = owner_id);

-- Public: submit a contact message (resolves the owner from the site slug server-side,
-- so a visitor can never target another owner or read anything).
create or replace function public.submit_message(p_slug text, p_name text, p_email text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  if length(coalesce(trim(p_body), '')) = 0 then return; end if;
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return; end if;
  insert into public.messages(owner_id, site_slug, name, email, body)
  values (v_owner, p_slug, nullif(trim(p_name), ''), nullif(trim(p_email), ''), left(p_body, 5000));
end; $$;
grant execute on function public.submit_message(text, text, text, text) to anon, authenticated;
