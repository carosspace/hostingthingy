-- 023_workbook.sql — an interactive HTML workbook ("Tuned In") served INSIDE the
-- client portal, LOCKED until a member unlocks it. Access is granted by redeeming
-- an unlock code (handed to buyers on the website or Etsy), or later by a purchase
-- / manual grant. Not free — a member with no access row simply can't open it.

-- The workbook itself (one per owner for now). tier_id is kept for optional future
-- "unlock for members of a tier" gating, but the primary path is per-person access.
create table if not exists public.workbooks (
  owner_id     uuid primary key references auth.users(id) on delete cascade,
  title        text not null default 'Workbook',
  html_content text,
  tier_id      uuid references public.tiers(id) on delete set null,
  updated_at   timestamptz not null default now()
);
alter table public.workbooks enable row level security;
drop policy if exists "owner manages workbook" on public.workbooks;
create policy "owner manages workbook" on public.workbooks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Who may open the owner's workbook, keyed by the member's verified email. A row
-- here = unlocked. Written by redeeming a code (or, later, a purchase webhook).
create table if not exists public.workbook_access (
  owner_id     uuid not null references auth.users(id) on delete cascade,
  client_email text not null,
  source       text not null default 'code',
  created_at   timestamptz not null default now(),
  primary key (owner_id, client_email)
);
alter table public.workbook_access enable row level security;
drop policy if exists "owner manages workbook_access" on public.workbook_access;
create policy "owner manages workbook_access" on public.workbook_access
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Unlock codes the owner hands out. Each code unlocks the workbook for whoever
-- redeems it first. redeemed_by_email/redeemed_at record who used it.
create table if not exists public.redeem_codes (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references auth.users(id) on delete cascade,
  code              text not null,
  redeemed_by_email text,
  redeemed_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (owner_id, code)
);
create index if not exists redeem_codes_owner_idx on public.redeem_codes (owner_id);
alter table public.redeem_codes enable row level security;
drop policy if exists "owner manages redeem_codes" on public.redeem_codes;
create policy "owner manages redeem_codes" on public.redeem_codes
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Portal META (light — no HTML): title, whether content exists, and whether the
-- signed-in member is entitled. Entitled = they hold a workbook_access row, OR an
-- active membership in the workbook's (optional) tier. Matched by verified JWT email.
create or replace function public.get_my_workbook(p_site_slug text)
returns table (title text, has_content boolean, entitled boolean)
language sql security definer set search_path = public stable as $$
  select
    w.title,
    (w.html_content is not null and length(w.html_content) > 0) as has_content,
    (
      exists (
        select 1 from public.workbook_access a
        where a.owner_id = w.owner_id
          and lower(a.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
      or (w.tier_id is not null and exists (
        select 1 from public.memberships m
        where m.tier_id = w.tier_id
          and coalesce(m.status, 'active') = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      ))
    ) as entitled
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
  limit 1;
$$;
grant execute on function public.get_my_workbook(text) to authenticated;

-- The gated HTML — returned ONLY when the caller is entitled (same check), else null.
create or replace function public.get_my_workbook_html(p_site_slug text)
returns text language sql security definer set search_path = public stable as $$
  select w.html_content
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and (
      exists (
        select 1 from public.workbook_access a
        where a.owner_id = w.owner_id
          and lower(a.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
      or (w.tier_id is not null and exists (
        select 1 from public.memberships m
        where m.tier_id = w.tier_id
          and coalesce(m.status, 'active') = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      ))
    )
  limit 1;
$$;
grant execute on function public.get_my_workbook_html(text) to authenticated;

-- Client-callable: redeem an unlock code. Grants the caller (by verified JWT email)
-- access to the owner's workbook + marks the code used. Idempotent for the same
-- person. Returns 'ok' | 'already' (used by someone else) | 'invalid' | 'error'.
create or replace function public.redeem_code(p_site_slug text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_email text;
  v_code_id uuid;
  v_redeemed text;
begin
  v_email := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  if v_email is null then return 'error'; end if;

  select owner_id into v_owner from public.sites where slug = p_site_slug limit 1;
  if v_owner is null then return 'error'; end if;

  select id, redeemed_by_email into v_code_id, v_redeemed
  from public.redeem_codes
  where owner_id = v_owner and lower(code) = lower(trim(p_code))
  limit 1;

  if v_code_id is null then return 'invalid'; end if;
  if v_redeemed is not null and v_redeemed <> v_email then return 'already'; end if;

  insert into public.workbook_access (owner_id, client_email, source)
  values (v_owner, v_email, 'code')
  on conflict (owner_id, client_email) do nothing;

  update public.redeem_codes
  set redeemed_by_email = v_email, redeemed_at = now()
  where id = v_code_id and redeemed_by_email is null;

  return 'ok';
end;
$$;
grant execute on function public.redeem_code(text, text) to authenticated;
