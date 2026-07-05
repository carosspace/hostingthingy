-- 024_multi_workbook.sql — allow an owner to sell MORE THAN ONE interactive
-- workbook (e.g. "Tuned In" AND "Meeting Yourself"), each gated + delivered
-- independently. We add a product `slug` dimension to the three workbook tables
-- and re-point the RPCs to take a workbook slug (defaulting to 'tuned-in' so every
-- existing row + caller keeps working unchanged).
--
-- BACKWARD COMPATIBLE: existing rows backfill to slug='tuned-in'; the RPCs default
-- p_workbook_slug to 'tuned-in'; so a caller that passes only p_site_slug still
-- resolves the original single workbook. Safe to run once; idempotent guards throughout.

-- ── workbooks: was PK(owner_id) → allow one row per (owner, product) ──────────
alter table public.workbooks add column if not exists slug text not null default 'tuned-in';
-- Re-point the primary key from owner_id to (owner_id, slug). Existing rows already
-- carry slug='tuned-in' (the default above), so each stays unique under the new PK.
alter table public.workbooks drop constraint if exists workbooks_pkey;
alter table public.workbooks add constraint workbooks_pkey primary key (owner_id, slug);

-- ── workbook_access: unlock is now per (owner, product, email) ────────────────
alter table public.workbook_access add column if not exists slug text not null default 'tuned-in';
alter table public.workbook_access drop constraint if exists workbook_access_pkey;
alter table public.workbook_access add constraint workbook_access_pkey primary key (owner_id, slug, client_email);

-- ── redeem_codes: each code unlocks a specific product ────────────────────────
alter table public.redeem_codes add column if not exists slug text not null default 'tuned-in';

-- ── RPCs: take a workbook slug (default 'tuned-in'). Drop the 1-arg versions
-- first so PostgREST never sees an ambiguous overload. ────────────────────────
drop function if exists public.get_my_workbook(text);
create or replace function public.get_my_workbook(p_site_slug text, p_workbook_slug text default 'tuned-in')
returns table (title text, has_content boolean, entitled boolean)
language sql security definer set search_path = public stable as $$
  select
    w.title,
    (w.html_content is not null and length(w.html_content) > 0) as has_content,
    (
      exists (
        select 1 from public.workbook_access a
        where a.owner_id = w.owner_id and a.slug = w.slug
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
    and w.slug = p_workbook_slug
  limit 1;
$$;
grant execute on function public.get_my_workbook(text, text) to authenticated;

-- Every workbook the owner offers, with per-row has_content + entitled for the
-- signed-in member. The portal lists the ones they're entitled to.
create or replace function public.get_my_workbooks(p_site_slug text)
returns table (slug text, title text, has_content boolean, entitled boolean)
language sql security definer set search_path = public stable as $$
  select
    w.slug,
    w.title,
    (w.html_content is not null and length(w.html_content) > 0) as has_content,
    (
      exists (
        select 1 from public.workbook_access a
        where a.owner_id = w.owner_id and a.slug = w.slug
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
  order by w.updated_at desc;
$$;
grant execute on function public.get_my_workbooks(text) to authenticated;

-- The gated HTML — returned ONLY when the caller is entitled to THAT product.
drop function if exists public.get_my_workbook_html(text);
create or replace function public.get_my_workbook_html(p_site_slug text, p_workbook_slug text default 'tuned-in')
returns text language sql security definer set search_path = public stable as $$
  select w.html_content
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and w.slug = p_workbook_slug
    and (
      exists (
        select 1 from public.workbook_access a
        where a.owner_id = w.owner_id and a.slug = w.slug
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
grant execute on function public.get_my_workbook_html(text, text) to authenticated;

-- Redeem a code → grants access to the PRODUCT the code is for (read from the code row).
create or replace function public.redeem_code(p_site_slug text, p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_email text;
  v_code_id uuid;
  v_redeemed text;
  v_slug text;
begin
  v_email := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  if v_email is null then return 'error'; end if;

  select owner_id into v_owner from public.sites where slug = p_site_slug limit 1;
  if v_owner is null then return 'error'; end if;

  select id, redeemed_by_email, slug into v_code_id, v_redeemed, v_slug
  from public.redeem_codes
  where owner_id = v_owner and lower(code) = lower(trim(p_code))
  limit 1;

  if v_code_id is null then return 'invalid'; end if;
  if v_redeemed is not null and v_redeemed <> v_email then return 'already'; end if;

  insert into public.workbook_access (owner_id, slug, client_email, source)
  values (v_owner, coalesce(v_slug, 'tuned-in'), v_email, 'code')
  on conflict (owner_id, slug, client_email) do nothing;

  update public.redeem_codes
  set redeemed_by_email = v_email, redeemed_at = now()
  where id = v_code_id and redeemed_by_email is null;

  return 'ok';
end;
$$;
grant execute on function public.redeem_code(text, text) to authenticated;
