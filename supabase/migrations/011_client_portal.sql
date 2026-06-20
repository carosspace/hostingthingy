-- 011_client_portal.sql — Client portal foundation (Stage 1).
-- A "client" is an end-user of a site (NOT the site owner). They sign in with the
-- same magic-link mechanism as owners (Supabase auth.users), and a row here marks
-- that auth user as a client of a given owner/site. Email-keyed data (appointments,
-- messages, blueprints) is bridged to the client by their VERIFIED auth email in
-- later stages via SECURITY DEFINER RPCs.
--
-- Multi-tenant ready: a client (user_id) can belong to many owners — unique(user_id, owner_id).
-- v1 uses a single owner (Anima Temple), resolved from the portal's site slug.

create table if not exists public.clients (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,  -- the signed-in client
  owner_id    uuid not null references auth.users(id) on delete cascade,  -- the site owner they belong to
  site_id     uuid references public.sites(id) on delete set null,
  email       text not null,
  name        text,
  created_at  timestamptz not null default now(),
  unique (user_id, owner_id)
);

create index if not exists clients_owner_idx on public.clients (owner_id);
create index if not exists clients_user_idx  on public.clients (user_id);

alter table public.clients enable row level security;

-- A client may read + update their OWN client rows (across owners).
drop policy if exists "client reads own" on public.clients;
create policy "client reads own" on public.clients
  for select using (auth.uid() = user_id);

drop policy if exists "client updates own" on public.clients;
create policy "client updates own" on public.clients
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- An owner may read (and manage) the clients that belong to them.
drop policy if exists "owner reads own clients" on public.clients;
create policy "owner reads own clients" on public.clients
  for select using (auth.uid() = owner_id);

drop policy if exists "owner updates own clients" on public.clients;
create policy "owner updates own clients" on public.clients
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner deletes own clients" on public.clients;
create policy "owner deletes own clients" on public.clients
  for delete using (auth.uid() = owner_id);

-- No INSERT policy on purpose: clients self-provision ONLY through the SECURITY DEFINER
-- RPC below, so owner_id is derived from the trusted site slug (never from client input).

-- Self-provision the signed-in user as a client of the site identified by p_site_slug.
-- Idempotent: re-running just refreshes site_id/email. owner_id + email come from
-- trusted server-side sources (the sites table + the JWT), not from the caller.
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
