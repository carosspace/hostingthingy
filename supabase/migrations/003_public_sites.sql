-- Hosting Thingy — public read for live sites
-- Lets anyone view a *live* site at /s/<slug> without exposing private data.
-- A SECURITY DEFINER function returns only safe fields (name, slug, template)
-- and only for sites whose status is 'live'. RLS on the table stays locked down.
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

create or replace function public.get_public_site(p_slug text)
returns table (name text, slug text, template text)
language sql
security definer
set search_path = public
as $$
  select s.name, s.slug, s.template
  from public.sites s
  where s.slug = p_slug and s.status = 'live'
  limit 1;
$$;

grant execute on function public.get_public_site(text) to anon, authenticated;
