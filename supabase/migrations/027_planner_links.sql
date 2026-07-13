-- 027_planner_links.sql — connect two planners (mutual consent) to share AVAILABILITY only.
-- planner_links holds the connections; planner_data gains an email so a connected friend's
-- busy blocks can be looked up by email (the app only ever returns blocks, never the rest).

alter table public.planner_data add column if not exists email text;
create index if not exists planner_data_email on public.planner_data (lower(email));

create table if not exists public.planner_links (
  id uuid primary key default gen_random_uuid(),
  requester_email text not null,
  addressee_email text not null,
  status text not null default 'pending', -- 'pending' | 'accepted'
  created_at timestamptz not null default now(),
  unique (requester_email, addressee_email)
);
create index if not exists planner_links_addressee on public.planner_links (lower(addressee_email));

alter table public.planner_links enable row level security;

-- READS ONLY via RLS: a person sees only links where they are one of the two parties
-- (matched on their verified email in the JWT).
drop policy if exists planner_links_mine on public.planner_links;
create policy planner_links_mine on public.planner_links for select
  using (lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      or lower(addressee_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- NO insert/update/delete policies: with RLS enabled and no write policy, the public anon
-- client cannot write this table at all. All writes go through the API (/api/planner/links),
-- which uses the service role and takes the acting email from the session cookie — so a user
-- can never rewrite the email columns to grant themselves access to a stranger's availability.
-- (Clean up any older permissive write policies from a previous version of this migration.)
drop policy if exists planner_links_invite on public.planner_links;
drop policy if exists planner_links_upd on public.planner_links;
drop policy if exists planner_links_del on public.planner_links;
