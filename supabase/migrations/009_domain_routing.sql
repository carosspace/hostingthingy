-- Hosting Thingy — custom-domain routing
-- A fast, public lookup from a request host to the live site that owns that domain.
-- Used by middleware to serve a custom domain (e.g. animatemple.com) as the site.
-- Matches with or without a leading "www." on either side. Run in Supabase SQL editor.

create index if not exists sites_domain_idx on public.sites (lower(domain));

create or replace function public.get_site_by_domain(p_host text)
returns table (slug text, status text)
language sql security definer set search_path = public as $$
  select s.slug, s.status
  from public.sites s
  where s.domain is not null
    and lower(regexp_replace(s.domain, '^www\.', '')) = lower(regexp_replace(coalesce(p_host, ''), '^www\.', ''))
  limit 1;
$$;

grant execute on function public.get_site_by_domain(text) to anon, authenticated;
