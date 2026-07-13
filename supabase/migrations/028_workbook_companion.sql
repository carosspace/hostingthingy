-- 028_workbook_companion.sql — let an INTERACTIVE workbook also carry a companion download
-- (e.g. a printable PDF), so ONE purchase delivers BOTH: the interactive portal AND the file.
-- The companion is gated by the SAME entitlement as the workbook (bought / gifted / member /
-- free), reusing entitled_to_product — so every existing Tuned In buyer gets the PDF too.

alter table public.workbooks add column if not exists companion_file_path text;
alter table public.workbooks add column if not exists companion_file_name text;
alter table public.workbooks add column if not exists companion_file_size bigint;
alter table public.workbooks add column if not exists companion_mime text;

-- The gated companion file — returned ONLY when the caller is entitled to the product. The
-- app turns this into a short-lived signed URL from the private site-resources bucket
-- (identical delivery path to get_my_download_path / get_my_resource_path).
create or replace function public.get_my_workbook_companion(p_site_slug text, p_workbook_slug text)
returns table (file_path text, file_name text, mime text)
language sql security definer set search_path = public stable as $$
  select w.companion_file_path, w.companion_file_name, w.companion_mime
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and w.slug = p_workbook_slug
    and w.kind = 'workbook' -- a companion belongs to an interactive workbook (mirrors the sibling RPCs)
    and w.companion_file_path is not null
    and public.entitled_to_product(w)
  limit 1;
$$;
grant execute on function public.get_my_workbook_companion(text, text) to authenticated;

-- Re-list products, now also flagging whether each carries a companion file (so the portal
-- can show a "Download printable" button next to the interactive one). Superset of 025's
-- get_my_workbooks — same rows, one extra column.
drop function if exists public.get_my_workbooks(text);
create or replace function public.get_my_workbooks(p_site_slug text)
returns table (slug text, title text, kind text, access text, has_content boolean, entitled boolean, hidden boolean, has_companion boolean)
language sql security definer set search_path = public stable as $$
  select w.slug, w.title, w.kind, w.access,
    (case when w.kind = 'download' then w.file_path is not null
          else (w.html_content is not null and length(w.html_content) > 0) end) as has_content,
    public.entitled_to_product(w) as entitled,
    coalesce(w.hidden, false) as hidden,
    (w.companion_file_path is not null) as has_companion
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
  order by w.updated_at desc;
$$;
grant execute on function public.get_my_workbooks(text) to authenticated;
