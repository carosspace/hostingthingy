-- 025_products.sql — make the per-product table (`workbooks`) hold BOTH interactive
-- workbooks AND downloadable files (ebooks / PDFs / guided meditations), each of which
-- can be free, members-only, or sold individually. BACKWARD COMPATIBLE: every existing
-- row defaults to kind='workbook' + access='paid', i.e. exactly today's behaviour, so the
-- live Tuned In / Meeting Yourself sales are unchanged.

alter table public.workbooks add column if not exists kind   text not null default 'workbook'; -- 'workbook' | 'download'
alter table public.workbooks add column if not exists access text not null default 'paid';     -- 'free' | 'members' | 'paid'
alter table public.workbooks add column if not exists file_path text;  -- download: storage object key in the site-resources bucket
alter table public.workbooks add column if not exists file_name text;
alter table public.workbooks add column if not exists file_size bigint;
alter table public.workbooks add column if not exists mime text;
alter table public.workbooks add column if not exists hidden boolean not null default false; -- kept off the public library

-- Unified entitlement: a member may OPEN a workbook / DOWNLOAD a file when ANY of:
--   • they hold a per-person access row (bought / gifted / redeemed a code)  ← unchanged paid path
--   • the product is marked free
--   • the product is members-only (has a tier) and they hold an active membership in it
-- Existing paid rows (access='paid', tier maybe null) resolve to the OLD "access-row OR tier"
-- behaviour, so nothing regresses.
create or replace function public.entitled_to_product(w public.workbooks)
returns boolean language sql stable set search_path = public as $$
  select
    exists (
      select 1 from public.workbook_access a
      where a.owner_id = w.owner_id and a.slug = w.slug
        and lower(a.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
    )
    or w.access = 'free'
    or (w.tier_id is not null and exists (
      select 1 from public.memberships m
      where m.tier_id = w.tier_id and coalesce(m.status, 'active') = 'active'
        and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
    ));
$$;

-- List every product the owner offers, tagged with kind/access/hidden + per-member entitlement.
drop function if exists public.get_my_workbooks(text);
create or replace function public.get_my_workbooks(p_site_slug text)
returns table (slug text, title text, kind text, access text, has_content boolean, entitled boolean, hidden boolean)
language sql security definer set search_path = public stable as $$
  select w.slug, w.title, w.kind, w.access,
    (case when w.kind = 'download' then w.file_path is not null
          else (w.html_content is not null and length(w.html_content) > 0) end) as has_content,
    public.entitled_to_product(w) as entitled,
    coalesce(w.hidden, false) as hidden
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
  order by w.updated_at desc;
$$;
grant execute on function public.get_my_workbooks(text) to authenticated;

-- Single workbook meta (kept for the /me/workbook page).
drop function if exists public.get_my_workbook(text, text);
create or replace function public.get_my_workbook(p_site_slug text, p_workbook_slug text default 'tuned-in')
returns table (title text, has_content boolean, entitled boolean)
language sql security definer set search_path = public stable as $$
  select w.title,
    (case when w.kind = 'download' then w.file_path is not null
          else (w.html_content is not null and length(w.html_content) > 0) end),
    public.entitled_to_product(w)
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and w.slug = p_workbook_slug
  limit 1;
$$;
grant execute on function public.get_my_workbook(text, text) to authenticated;

-- The gated interactive-workbook HTML — only when entitled.
drop function if exists public.get_my_workbook_html(text, text);
create or replace function public.get_my_workbook_html(p_site_slug text, p_workbook_slug text default 'tuned-in')
returns text language sql security definer set search_path = public stable as $$
  select w.html_content
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and w.slug = p_workbook_slug
    and w.kind = 'workbook' -- never serve stale HTML for a row that's now a download
    and public.entitled_to_product(w)
  limit 1;
$$;
grant execute on function public.get_my_workbook_html(text, text) to authenticated;

-- The gated DOWNLOAD file path — only when entitled. The app layer turns this into a
-- short-lived signed URL from the private site-resources bucket (mirrors get_my_resource_path).
create or replace function public.get_my_download_path(p_site_slug text, p_workbook_slug text)
returns table (file_path text, file_name text, mime text)
language sql security definer set search_path = public stable as $$
  select w.file_path, w.file_name, w.mime
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and w.slug = p_workbook_slug
    and w.kind = 'download'
    and w.file_path is not null
    and public.entitled_to_product(w)
  limit 1;
$$;
grant execute on function public.get_my_download_path(text, text) to authenticated;
