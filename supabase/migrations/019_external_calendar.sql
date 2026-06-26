-- 019_external_calendar.sql — "Block busy times" from the owner's own external calendar.
-- Each booking owner can paste THEIR OWN calendar's secret iCal address (Google/Apple/Outlook
-- all expose one, ending in .ics). The platform reads that calendar's busy events server-side
-- and stops offering overlapping booking slots.
--
-- This column holds a SEMI-PRIVATE secret (anyone with the URL can read the owner's calendar),
-- so it is DELIBERATELY NOT exposed via get_booking_page (the public, anon-callable RPC). It is
-- only ever read SERVER-SIDE via the service-role admin client; only the derived busy
-- time-blocks reach the public booking page — never the URL itself.
--
-- Idempotent — safe to re-run. Run in the platform's Supabase project: SQL Editor -> Run.

alter table public.booking_settings add column if not exists external_ical_url text;
