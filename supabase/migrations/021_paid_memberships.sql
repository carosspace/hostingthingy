-- 021_paid_memberships.sql — PAID RECURRING MEMBERSHIPS via Stripe Subscriptions, on the
-- owner's OWN Stripe account (the platform's DIRECT-charge model). Today memberships are free
-- + owner-granted (migration 015). This adds: an owner can put a recurring PRICE on a tier; a
-- visitor can SUBSCRIBE and pay; on payment the membership is granted; on cancel/non-payment it's
-- revoked (status flips); the client manages/cancels via Stripe's billing portal.
--
-- Backward-compatible + idempotent: every add is `if not exists`, existing rows default to a free,
-- ACTIVE membership so free/manual grants stay exactly as they were. The course-gating RPCs are
-- recreated FAITHFULLY from 015 — the ONLY change is the membership gate now also requires
-- m.status = 'active' (so a canceled/past-due subscriber loses gated-course access; free/manual
-- grants are 'active' by default and are unaffected).

-- ---- tiers: optional recurring price -----------------------------------------------------
-- price_cents NULL  => a FREE / manual tier (the only kind before this migration). Non-null => a
-- PAID tier the public can subscribe to. currency + bill_interval describe the recurring charge.
alter table public.tiers add column if not exists price_cents int;
alter table public.tiers add column if not exists currency text not null default 'eur';
alter table public.tiers add column if not exists bill_interval text not null default 'month'
  check (bill_interval in ('month', 'year'));

-- ---- memberships: subscription linkage + lifecycle status ---------------------------------
-- A free/manual grant has all four NULL/'active'. A paid grant carries the Stripe subscription +
-- customer ids and a status that the webhook keeps in sync. Gating requires status = 'active'.
alter table public.memberships add column if not exists stripe_subscription_id text;
alter table public.memberships add column if not exists stripe_customer_id text;
alter table public.memberships add column if not exists status text not null default 'active'
  check (status in ('active', 'past_due', 'canceled'));
alter table public.memberships add column if not exists current_period_end timestamptz;

-- One membership row per Stripe subscription — the webhook locates the row by this id on
-- subscription.updated/deleted. Partial (only where the id is present) so free/manual rows (NULL)
-- don't collide on the unique index.
create unique index if not exists memberships_stripe_sub_idx
  on public.memberships (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- ---- RECREATE the gating RPCs FAITHFULLY (015), adding ONLY `and m.status = 'active'` --------
-- A botched recreate breaks live course access, so these reproduce the ENTIRE 015 bodies (params,
-- return shape, security definer, search_path, stable, the open-OR-member gate, ordering) verbatim
-- EXCEPT for the single added status condition inside the membership EXISTS sub-select.

create or replace function public.get_my_courses(p_site_slug text)
returns table (
  id          uuid,
  title       text,
  description text,
  cover_image text,
  lesson_count bigint,
  sort        int
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.title, c.description, c.cover_image,
         (select count(*) from public.lessons l where l.course_id = c.id and l.owner_id = c.owner_id) as lesson_count,
         c.sort
  from public.courses c
  where c.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and c.published = true
    and (
      c.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = c.tier_id
          and m.status = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  order by c.sort asc, c.created_at asc;
$$;
grant execute on function public.get_my_courses(text) to authenticated;

create or replace function public.get_my_course(p_site_slug text, p_course_id uuid)
returns table (
  course_id          uuid,
  course_title       text,
  course_description text,
  cover_image        text,
  lesson_id          uuid,
  lesson_title       text,
  lesson_body        text,
  lesson_video       text,
  lesson_sort        int
)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.title, c.description, c.cover_image,
         l.id, l.title, l.body, l.video_url, l.sort
  from public.courses c
  left join public.lessons l on l.course_id = c.id and l.owner_id = c.owner_id
  where c.id = p_course_id
    and c.published = true
    and c.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and (
      c.tier_id is null
      or exists (
        select 1 from public.memberships m
        where m.tier_id = c.tier_id
          and m.status = 'active'
          and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
      )
    )
  order by l.sort asc nulls last, l.created_at asc;
$$;
grant execute on function public.get_my_course(text, uuid) to authenticated;

-- The signed-in client's tiers with the portal's owner. Recreated from 015 to ALSO return the
-- membership status + current_period_end (so the client UI can show "active / past due / canceled"
-- and a renewal date) and the tier's price/interval (so a paid membership reads as paid). The owner
-- is still resolved server-side from the trusted slug; the client is matched by verified JWT email.
create or replace function public.get_my_memberships(p_site_slug text)
returns table (
  tier_id            uuid,
  name               text,
  description        text,
  status             text,
  current_period_end timestamptz,
  price_cents        int,
  currency           text,
  bill_interval      text,
  has_subscription   boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select t.id, t.name, t.description,
         m.status, m.current_period_end,
         t.price_cents, t.currency, t.bill_interval,
         (m.stripe_subscription_id is not null) as has_subscription
  from public.memberships m
  join public.tiers t on t.id = m.tier_id
  where m.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
  order by t.sort asc, t.name asc;
$$;
grant execute on function public.get_my_memberships(text) to authenticated;

-- The Stripe customer id for the signed-in client's OWN paid membership in a given tier, scoped to
-- the portal owner (resolved server-side from the trusted slug) and matched by the client's verified
-- JWT email. SECURITY DEFINER so a client (whose auth.uid() ≠ owner_id, and so is blocked by the
-- memberships RLS) can still read JUST their own customer id — needed to open Stripe's billing portal.
-- Returns at most one row; null/no row for a free/manual membership (stripe_customer_id is null) or
-- a tier the client doesn't hold. Never exposes another client's membership.
create or replace function public.get_my_membership_customer(p_site_slug text, p_tier_id uuid)
returns table (stripe_customer_id text, stripe_subscription_id text, status text)
language sql
security definer
set search_path = public
stable
as $$
  select m.stripe_customer_id, m.stripe_subscription_id, m.status
  from public.memberships m
  where m.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and m.tier_id = p_tier_id
    and lower(m.client_email) = nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '')
  limit 1;
$$;
grant execute on function public.get_my_membership_customer(text, uuid) to authenticated;
