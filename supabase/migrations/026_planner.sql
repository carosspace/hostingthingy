-- 026_planner.sql — cross-device storage for the standalone Anima Temple planner PWA.
-- One row per signed-in person: their whole planner as a JSON blob, synced across every
-- device they sign into with the same email. RLS keeps each person to their own row.
create table if not exists public.planner_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.planner_data enable row level security;

drop policy if exists planner_own_read on public.planner_data;
create policy planner_own_read on public.planner_data
  for select using (auth.uid() = user_id);

drop policy if exists planner_own_insert on public.planner_data;
create policy planner_own_insert on public.planner_data
  for insert with check (auth.uid() = user_id);

drop policy if exists planner_own_update on public.planner_data;
create policy planner_own_update on public.planner_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
