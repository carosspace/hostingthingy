-- 017_stripe_connect.sql — Multi-tenant Stripe Connect (Stage 1).
-- Each site owner connects THEIR OWN Stripe (Express connected account) so they can take
-- payments on their site; they are the merchant of record. The platform stores only the
-- connected account id + a cached "charges enabled" flag on the site, plus a `sales` table
-- the Stage-2 webhook writes to. Idempotent — safe to re-run.
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

create extension if not exists "pgcrypto"; -- provides gen_random_uuid()

-- The owner's Stripe Express account, cached on the site. NOT inside the content jsonb —
-- these are top-level columns written only by the stripe_* server actions.
alter table public.sites add column if not exists stripe_account_id text;
alter table public.sites add column if not exists stripe_charges_enabled boolean not null default false;

-- Completed payments. The Stage-2 Connect webhook (service role) inserts a row per paid
-- checkout session; the owner can read their own site's sales in the dashboard.
create table if not exists public.sales (
  id                uuid primary key default gen_random_uuid(),
  site_id           uuid not null references public.sites(id) on delete cascade,
  amount_cents      int  not null,
  currency          text not null,
  product           text,
  customer_email    text,
  stripe_session_id text not null unique, -- the webhook's idempotency key — always present
  created_at        timestamptz not null default now()
);
create index if not exists sales_site_idx on public.sales (site_id);

alter table public.sales enable row level security;

-- The site OWNER may read their own site's sales (resolved by joining sites → owner_id),
-- mirroring the per-site ownership used elsewhere (sites.owner_id = auth.uid()).
drop policy if exists "owner reads own sales" on public.sales;
create policy "owner reads own sales" on public.sales
  for select using (
    exists (
      select 1 from public.sites s
      where s.id = sales.site_id and s.owner_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policy on purpose: rows are written ONLY by the Stage-2 webhook
-- using the service role (which bypasses RLS). Nothing public/authenticated can insert.
-- Defense-in-depth (matches 016): explicitly revoke writes so the intent holds even if RLS
-- were ever toggled off. SELECT stays gated by the policy above.
revoke insert, update, delete on public.sales from anon, authenticated;
