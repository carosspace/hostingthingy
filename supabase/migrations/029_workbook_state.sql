-- 029_workbook_state.sql — what a member WRITES inside an interactive workbook, saved to
-- their account instead of only that browser. One row per (member, workbook). The workbook
-- HTML itself is untouched: the portal seeds and captures localStorage for them (see
-- /api/client/workbook), so this works for Tuned In, Meeting Yourself, The Stirring and
-- anything added later.

create table if not exists public.workbook_state (
  user_id    uuid not null references auth.users(id) on delete cascade,
  slug       text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.workbook_state enable row level security;

-- Each person reads/writes ONLY their own writing. No owner access: what a member writes in
-- their workbook is private to them, not readable by the shop owner.
drop policy if exists workbook_state_own_sel on public.workbook_state;
create policy workbook_state_own_sel on public.workbook_state for select
  using (auth.uid() = user_id);

drop policy if exists workbook_state_own_ins on public.workbook_state;
create policy workbook_state_own_ins on public.workbook_state for insert
  with check (auth.uid() = user_id);

drop policy if exists workbook_state_own_upd on public.workbook_state;
create policy workbook_state_own_upd on public.workbook_state for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists workbook_state_own_del on public.workbook_state;
create policy workbook_state_own_del on public.workbook_state for delete
  using (auth.uid() = user_id);
