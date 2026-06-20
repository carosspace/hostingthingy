-- 012_client_bookings.sql — Client portal Stage 2: a signed-in client sees + cancels
-- THEIR OWN appointments. Appointments are email-keyed (no client_id), so we bridge
-- the logged-in client to their rows by their VERIFIED auth email (auth.jwt()->>'email').
-- owner is derived from the trusted portal slug, never from caller input.

-- All appointments belonging to the signed-in client for the portal's site owner.
create or replace function public.get_my_appointments(p_site_slug text)
returns table (
  id           uuid,
  service_name text,
  slot_date    date,
  slot_time    text,
  duration_min int,
  status       text,
  note         text,
  created_at   timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select a.id, a.service_name, a.slot_date, a.slot_time,
         a.duration_min, a.status, a.note, a.created_at
  from public.appointments a
  where a.owner_id = (select owner_id from public.sites where slug = p_site_slug limit 1)
    and nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '') is not null
    and lower(a.client_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by a.slot_date desc nulls last, a.slot_time desc;
$$;

grant execute on function public.get_my_appointments(text) to authenticated;

-- A client cancels one of their OWN appointments (email match), if it is still
-- requested/confirmed. Returns 'ok' | 'notfound' | 'error'.
create or replace function public.cancel_my_appointment(p_appointment_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email  text;
  v_status text;
begin
  v_email := nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
  if v_email is null then
    return 'error';
  end if;

  update public.appointments
     set status = 'cancelled'
   where id = p_appointment_id
     and lower(client_email) = v_email
     and status in ('requested', 'confirmed')
  returning status into v_status;

  if v_status is null then
    return 'notfound';
  end if;
  return 'ok';
end;
$$;

grant execute on function public.cancel_my_appointment(uuid) to authenticated;
