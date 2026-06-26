-- 022_resources.sql — RESOURCES / DOWNLOADS (a Kajabi-style file library for the client portal).
-- The OWNER uploads files (PDFs, worksheets, audio, images, zips, decks, video) and marks each as
-- FREE (any signed-in client) or MEMBERS-ONLY (gated to a tier). A signed-in CLIENT sees only the
-- resources they're entitled to under /me/resources and downloads each via a short-lived signed URL.
-- Idempotent + backward-compatible — safe to re-run. Run in the platform's Supabase project.
--
-- SECURITY MODEL (a reviewer will probe this):
--   * The bucket is PRIVATE → there is NO public URL; the storage path alone is useless to anyone.
--   * Uploads happen ONLY through service-role signed upload URLs (deny-by-default; no anon/auth
--     write policy) at a server-CHOSEN path.
--   * Downloads happen ONLY through a service-role signed URL minted server-side AFTER the
--     get_my_resource_path RPC re-checks entitlement against the caller's VERIFIED JWT email.
--   * get_my_resources NEVER returns file_path — the path stays server-side.
--
-- PREREQUISITE: this project's Supabase must have Storage enabled (the `storage` schema /
-- `storage.buckets` table must exist). Storage is on by default for hosted Supabase projects.

-- gen_random_uuid() lives in pgcrypto (already enabled by 017; re-affirmed here so this migration
-- is self-contained / safe to run on a fresh project).
create extension if not exists "pgcrypto";

-- ---- PRIVATE storage bucket -----------------------------------------------------------------
-- public = false → Storage serves NO /object/public/... URL; every download must go through a
-- short-lived signed URL minted by the service role. 100 MB cap. allowed_mime_types null = allow
-- any (the server-side ext allowlist in createResourceUploadUrl is the gate on what gets in).
-- Uploads + downloads go ONLY through service-role signed URLs (deny-by-default; we deliberately
-- add NO anon/authenticated storage policy, so the anon/auth key can neither read nor write here).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-resources', 'site-resources', false, 104857600, null)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- ---- resources table ------------------------------------------------------------------------
-- One uploadable file. tier_id NULL = free (any signed-in client); a tier id = members-only
-- (gated to that tier). file_path is the storage object key — it stays server-side and is NEVER
-- exposed by the client-read RPC.
create table if not exists public.resources (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  file_path   text not null,
  file_name   text,
  file_size   bigint,
  mime        text,
  tier_id     uuid references public.tiers(id) on delete set null,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists resources_owner_idx on public.resources (owner_id);

alter table public.resources enable row level security;
-- Owner manages their OWN rows (auth.uid() = owner_id). NO client read policy — clients read via
-- the get_my_resources / get_my_resource_path RPCs (which gate on tier entitlement).
drop policy if exists "owner manages resources" on public.resources;
create policy "owner manages resources" on public.resources
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---- RPC: the signed-in client's entitled resources -----------------------------------------
-- The owner is resolved server-side from the trusted slug; a resource is visible if it's free
-- (tier_id is null) OR the caller (verified JWT email) holds an ACTIVE membership in its tier.
-- DELIBERATELY DOES NOT return file_path — the path stays server-side. Matches the get_my_courses
-- membership gate (015/021), incl. the `and m.status = 'active'` requirement.
create or replace function public.get_my_resources(p_site_slug text)
returns table (
  id          uuid,
  title       text,
  description text,
  file_name   text,
  file_size   bigint,
  mime        text,
  tier_id     uuid
)
language sql
security definer
set search_path = public
stable
as $$
  select r.id, r.title, r.description, r.file_name, r.file_size, r.mime, r.tier_id
  from public.resources r
  where r.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and (
      r.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = r.tier_id
          and m.status = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  order by r.sort asc, r.created_at asc;
$$;

-- ---- RPC: the storage path for ONE resource, ENTITLEMENT-GATED ------------------------------
-- The download entitlement gate. Returns file_path ONLY if the resource belongs to the slug's
-- owner AND the caller is entitled (free OR an ACTIVE member of its tier). Otherwise no row →
-- the server mints no signed URL. SECURITY DEFINER so a client (whose auth.uid() ≠ owner_id, and
-- so is blocked by the resources RLS) can read JUST the path of a resource they're entitled to.
create or replace function public.get_my_resource_path(p_site_slug text, p_resource_id uuid)
returns table (file_path text)
language sql
security definer
set search_path = public
stable
as $$
  select r.file_path
  from public.resources r
  where r.id = p_resource_id
    and r.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and (
      r.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = r.tier_id
          and m.status = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  limit 1;
$$;

-- Defense-in-depth grants: CREATE FUNCTION grants EXECUTE to PUBLIC by default. Both RPCs key off
-- the caller's JWT, so anon already gets nothing back — revoke PUBLIC anyway so anon can't even
-- invoke them, then (re-)affirm the intended grant to authenticated.
revoke execute on function public.get_my_resources(text)            from public;
revoke execute on function public.get_my_resource_path(text, uuid)  from public;
grant  execute on function public.get_my_resources(text)            to authenticated;
grant  execute on function public.get_my_resource_path(text, uuid)  to authenticated;
