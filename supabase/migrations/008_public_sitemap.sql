-- Hosting Thingy — sitemap source
-- A SECURITY DEFINER function that lists every LIVE site's slug, last-update time,
-- and the slugs of its pages (extracted from the content JSON so we never pull the
-- heavy element/image data). Used by app/sitemap.ts. Safe to expose to anon.
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

create or replace function public.list_public_pages()
returns table (slug text, updated_at timestamptz, page_slugs text[])
language sql security definer set search_path = public as $$
  select
    s.slug,
    s.updated_at,
    coalesce(
      (select array_agg(p->>'slug') from jsonb_array_elements(s.content->'pages') p),
      array['']::text[]
    ) as page_slugs
  from public.sites s
  where s.status = 'live';
$$;

grant execute on function public.list_public_pages() to anon, authenticated;
