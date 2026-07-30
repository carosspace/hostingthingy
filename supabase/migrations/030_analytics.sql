-- 030_analytics.sql — first-party visitor stats for the public site, so Caro can see her
-- traffic inside her own dashboard instead of a third-party analytics account.
--
-- PRIVACY BY DESIGN: no IP address, no user-agent string, no cookies, no identifiers of any
-- kind are stored — so there is nothing personal in here and no cookie banner is required.
-- Rows are pre-aggregated counters per (day, path, referrer host, device), which also keeps
-- the table small and the dashboard fast no matter how much traffic arrives.

create table if not exists public.page_stats (
  site_slug  text not null,
  day        date not null,
  path       text not null,
  referrer   text not null default '',      -- host only ('' = typed/direct)
  device     text not null default 'other', -- 'mobile' | 'desktop' | 'other'
  views      integer not null default 0,
  visits     integer not null default 0,    -- first page of a browser session
  primary key (site_slug, day, path, referrer, device)
);

create index if not exists page_stats_day on public.page_stats (site_slug, day desc);

alter table public.page_stats enable row level security;
-- Deliberately NO policies: the anon key can neither read nor write. Recording goes through
-- the site's own /api/track (service role), and the dashboard reads with the service role
-- after checking the signed-in owner. That stops anyone from inflating or scraping the stats.

-- Increment the counter for one page view. Security-definer so the API can call it without
-- granting table rights; execute is revoked from the public roles below.
create or replace function public.record_page_view(
  p_site text, p_path text, p_ref text, p_device text, p_new_visit boolean
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.page_stats (site_slug, day, path, referrer, device, views, visits)
  values (
    left(coalesce(p_site, ''), 80),
    (now() at time zone 'utc')::date,
    left(coalesce(nullif(p_path, ''), '/'), 200),
    left(coalesce(p_ref, ''), 120),
    case when p_device in ('mobile', 'desktop') then p_device else 'other' end,
    1,
    case when p_new_visit then 1 else 0 end
  )
  on conflict (site_slug, day, path, referrer, device) do update
    set views  = page_stats.views + 1,
        visits = page_stats.visits + case when p_new_visit then 1 else 0 end;
end;
$$;

revoke all on function public.record_page_view(text, text, text, text, boolean) from public;
revoke all on function public.record_page_view(text, text, text, text, boolean) from anon;
revoke all on function public.record_page_view(text, text, text, text, boolean) from authenticated;
