-- Hosting Thingy — site content (the actual website a site shows)
-- Adds a JSON content blob to each site, and updates the public read function
-- to return it. Run in the platform's Supabase project: SQL Editor → paste → Run.

alter table public.sites add column if not exists content jsonb;

-- The return shape changes (adds content), so drop + recreate.
drop function if exists public.get_public_site(text);

create function public.get_public_site(p_slug text)
returns table (name text, slug text, template text, content jsonb)
language sql
security definer
set search_path = public
as $$
  select s.name, s.slug, s.template, s.content
  from public.sites s
  where s.slug = p_slug and s.status = 'live'
  limit 1;
$$;

grant execute on function public.get_public_site(text) to anon, authenticated;
