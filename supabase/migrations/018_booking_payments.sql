-- 018_booking_payments.sql — Take payment for priced booking services.
-- When a service has a price (price_cents > 0) and payments are configured, the public
-- booking flow charges the visitor via Stripe BEFORE the appointment is confirmed. The
-- appointment is held as 'pending_payment' (occupying the slot so two buyers can't both
-- pay for it), then flipped to 'confirmed' + paid=true by the Stripe webhook on success.
-- Free services keep the existing request -> owner-confirm flow unchanged.
-- Idempotent — safe to re-run. Run in the platform's Supabase project: SQL Editor -> Run.

create extension if not exists "uuid-ossp";

-- Payment state on each appointment. paid flips true only when the webhook confirms the
-- Stripe session; stripe_session_id ties the row to its checkout for traceability + the
-- webhook's idempotency.
alter table public.appointments add column if not exists paid boolean not null default false;
alter table public.appointments add column if not exists stripe_session_id text;

-- Idempotency key: at most one appointment per Stripe session. Partial (WHERE not null) so
-- the many free/legacy rows with a null session id don't collide.
create unique index if not exists appointments_stripe_session_idx
  on public.appointments (stripe_session_id)
  where stripe_session_id is not null;

-- Add 'pending_payment' to the status CHECK. The original (005) is an inline column check,
-- which Postgres auto-names <table>_<column>_check. Drop + recreate it idempotently to
-- include the new state. (If a prior run already added it the drop is a no-op-safe guard.)
alter table public.appointments drop constraint if exists appointments_status_check;
alter table public.appointments add constraint appointments_status_check
  check (status in ('requested', 'confirmed', 'cancelled', 'pending_payment'));

-- A 'pending_payment' appointment ALSO occupies its slot. Recreate the public-page "taken"
-- query (from 006) to include it so the slot shows as taken while a buyer is mid-checkout.
create or replace function public.get_booking_page(p_slug text)
returns json language sql security definer set search_path = public as $$
  with site as (select owner_id from public.sites where slug = p_slug limit 1)
  select json_build_object(
    'services', coalesce((
      select json_agg(json_build_object(
        'serviceId', sv.id, 'name', sv.name, 'description', sv.description,
        'durationMin', sv.duration_min, 'priceCents', sv.price_cents, 'currency', sv.currency
      ) order by sv.created_at)
      from public.services sv, site
      where sv.owner_id = site.owner_id and sv.active
    ), '[]'::json),
    'settings', (
      select json_build_object(
        'timezone', coalesce(bs.timezone, 'UTC'),
        'windowDays', coalesce(bs.window_days, 30),
        'minNoticeHours', coalesce(bs.min_notice_hours, 12),
        'slotStepMin', coalesce(bs.slot_step_min, 0)
      )
      from site left join public.booking_settings bs on bs.owner_id = site.owner_id
    ),
    'availability', coalesce((
      select json_agg(json_build_object(
        'weekday', a.weekday, 'startMin', a.start_min, 'endMin', a.end_min
      ))
      from public.booking_availability a, site
      where a.owner_id = site.owner_id
    ), '[]'::json),
    'taken', coalesce((
      select json_agg(json_build_object(
        'date', to_char(ap.slot_date, 'YYYY-MM-DD'), 'time', ap.slot_time, 'durationMin', ap.duration_min
      ))
      from public.appointments ap, site
      where ap.owner_id = site.owner_id
        and ap.status in ('requested', 'confirmed', 'pending_payment')
        and ap.slot_date is not null
        and ap.slot_date >= current_date
    ), '[]'::json)
  );
$$;
grant execute on function public.get_booking_page(text) to anon, authenticated;

-- The existing free-flow slot booker. Recreated only to add 'pending_payment' to the
-- conflict statuses so a held (mid-checkout) slot is treated as taken here too.
create or replace function public.request_booking_slot(
  p_slug text, p_service_id uuid, p_name text, p_email text,
  p_slot_date date, p_slot_time text, p_note text
) returns text language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_sname text; v_dur int; v_start int; v_conflict int;
begin
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return 'error'; end if;

  -- Serialize concurrent bookings for the same owner+day so the overlap check + insert below is
  -- ATOMIC. Under READ COMMITTED two visitors could otherwise both pass count(*)=0 (neither sees
  -- the other's uncommitted row) and both insert -> a double-booked slot. The xact-lock makes the
  -- second caller wait until the first commits, after which it sees the conflict and returns taken.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || '|' || p_slot_date::text, 0));

  select name, duration_min into v_sname, v_dur
  from public.services where id = p_service_id and owner_id = v_owner and active;
  if v_dur is null then return 'error'; end if;

  v_start := hhmm_to_min(p_slot_time);

  select count(*) into v_conflict
  from public.appointments ap
  where ap.owner_id = v_owner
    and ap.status in ('requested', 'confirmed', 'pending_payment')
    and ap.slot_date = p_slot_date
    and ap.slot_time is not null
    and (v_start < hhmm_to_min(ap.slot_time) + coalesce(ap.duration_min, v_dur))
    and (hhmm_to_min(ap.slot_time) < v_start + v_dur);
  if v_conflict > 0 then return 'taken'; end if;

  insert into public.appointments(
    owner_id, service_id, service_name, client_name, client_email,
    slot_date, slot_time, duration_min, note, requested_at
  ) values (
    v_owner, p_service_id, v_sname, nullif(trim(p_name), ''), nullif(trim(p_email), ''),
    p_slot_date, p_slot_time, v_dur, nullif(trim(p_note), ''),
    to_char(p_slot_date, 'YYYY-MM-DD') || ' ' || p_slot_time
  );
  return 'ok';
end; $$;
grant execute on function public.request_booking_slot(text, uuid, text, text, date, text, text) to anon, authenticated;

-- PAID flow: hold the slot as 'pending_payment' (same double-booking guard) and return the
-- NEW appointment id so the server can start a Stripe Checkout for it. Returns the uuid text
-- on success, or the sentinels 'taken' | 'error'. The server reads the price from the SERVICE
-- row (never the client); this only creates the hold. The webhook later flips it to confirmed.
-- TODO: expire stale pending_payment holds (a buyer who abandons checkout keeps the slot until
-- then; out of scope here).
create or replace function public.request_booking_slot_pending(
  p_slug text, p_service_id uuid, p_name text, p_email text,
  p_slot_date date, p_slot_time text, p_note text
) returns text language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_sname text; v_dur int; v_start int; v_conflict int; v_id uuid;
begin
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return 'error'; end if;

  -- Serialize concurrent bookings for the same owner+day so the overlap check + insert below is
  -- ATOMIC (see request_booking_slot). Without it two visitors could both hold the same slot as
  -- pending_payment, each get a Stripe Checkout, and BOTH pay -> a double charge + double booking.
  perform pg_advisory_xact_lock(hashtextextended(v_owner::text || '|' || p_slot_date::text, 0));

  select name, duration_min into v_sname, v_dur
  from public.services where id = p_service_id and owner_id = v_owner and active;
  if v_dur is null then return 'error'; end if;

  v_start := hhmm_to_min(p_slot_time);

  select count(*) into v_conflict
  from public.appointments ap
  where ap.owner_id = v_owner
    and ap.status in ('requested', 'confirmed', 'pending_payment')
    and ap.slot_date = p_slot_date
    and ap.slot_time is not null
    and (v_start < hhmm_to_min(ap.slot_time) + coalesce(ap.duration_min, v_dur))
    and (hhmm_to_min(ap.slot_time) < v_start + v_dur);
  if v_conflict > 0 then return 'taken'; end if;

  insert into public.appointments(
    owner_id, service_id, service_name, client_name, client_email,
    slot_date, slot_time, duration_min, note, requested_at, status, paid
  ) values (
    v_owner, p_service_id, v_sname, nullif(trim(p_name), ''), nullif(trim(p_email), ''),
    p_slot_date, p_slot_time, v_dur, nullif(trim(p_note), ''),
    to_char(p_slot_date, 'YYYY-MM-DD') || ' ' || p_slot_time, 'pending_payment', false
  ) returning id into v_id;

  return v_id::text;
end; $$;
grant execute on function public.request_booking_slot_pending(text, uuid, text, text, date, text, text) to anon, authenticated;

-- Persist a Stripe session id onto a pending appointment. SECURITY DEFINER + tightly scoped:
-- only updates a row that is still pending_payment, has no session id yet, and is owned by the
-- site at p_slug (so the public flow can attach its session without a logged-in user). The
-- session id provenance is the server's own createCheckout call, never client input.
create or replace function public.attach_booking_session(
  p_slug text, p_appointment_id uuid, p_session_id text
) returns boolean language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_count int;
begin
  if p_session_id is null or length(trim(p_session_id)) = 0 then return false; end if;
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return false; end if;

  update public.appointments
     set stripe_session_id = p_session_id
   where id = p_appointment_id
     and owner_id = v_owner
     and status = 'pending_payment'
     and stripe_session_id is null;

  get diagnostics v_count = row_count;
  return v_count > 0;
end; $$;
grant execute on function public.attach_booking_session(text, uuid, text) to anon, authenticated;
