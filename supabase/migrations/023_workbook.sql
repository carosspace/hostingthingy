-- 023_workbook.sql — an interactive HTML workbook ("Tuned In") served INSIDE the
-- client portal, gated to members of a tier. One workbook per owner for now.
-- Reuses the tiers/memberships entitlement model (migrations 015/021/022): the
-- workbook is unlocked by (a) no tier (free to all members), or (b) an active
-- membership in its tier — granted via purchase, a redeem code, or a manual grant.

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

-- Portal META (light — no HTML): the workbook's title, whether content exists, and
-- whether the signed-in client is entitled. Entitled = the workbook has no tier
-- (free) OR the caller holds an ACTIVE membership in its tier, matched by their
-- verified JWT email. SECURITY DEFINER so it can read across the owner's rows.
create or replace function public.get_my_workbook(p_site_slug text)
returns table (title text, has_content boolean, entitled boolean)
language sql
security definer
set search_path = public
stable
as $$
  select
    w.title,
    (w.html_content is not null and length(w.html_content) > 0) as has_content,
    (
      w.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = w.tier_id
          and coalesce(m.status, 'active') = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    ) as entitled
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
  limit 1;
$$;
grant execute on function public.get_my_workbook(text) to authenticated;

-- The gated HTML: returns the workbook's html_content ONLY when the caller is
-- entitled (same check), else null. Served by the /api/client/workbook route.
create or replace function public.get_my_workbook_html(p_site_slug text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select w.html_content
  from public.workbooks w
  where w.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and (
      w.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = w.tier_id
          and coalesce(m.status, 'active') = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  limit 1;
$$;
grant execute on function public.get_my_workbook_html(text) to authenticated;
