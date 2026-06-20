-- Hosting Thingy — tenant-isolation hardening (from the 2026-06-20 bug-hunt)
-- Run in the platform's Supabase project: SQL Editor → paste → Run.
-- Closes three verified multi-tenant bugs that can only be fixed at the DB layer:
--   (bug 2) custom-domain cross-tenant hijack — two sites could both claim a domain
--   (bug 4) non-unique slugs let one tenant shadow another's /s/<slug> and misroute leads
--   (bug 9) the public submit_message RPC had no length caps / rate limit (anon storage DoS)
-- The app code already ships the matching halves (apex-domain block, save guards, a
-- collision-safe slug retry in createSiteRecord/renameSiteRecord). This migration is the
-- load-bearing DB half — apply it to fully close bugs 2, 4 and 9.

-- ── 1. Domain uniqueness (bug 2) ──────────────────────────────────────────────
-- Stops two sites from both holding the same custom domain. Domains are rare + manually
-- claimed, so a pre-existing collision is unlikely; if this errors, run the diagnostic
-- below and clear the duplicate domain off one of the sites first.
--   SELECT lower(domain) d, count(*) FROM public.sites WHERE domain IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
create unique index if not exists sites_domain_unique on public.sites (lower(domain)) where domain is not null;

-- ── 2. Slug uniqueness (bug 4) ────────────────────────────────────────────────
-- Slug is the PUBLIC routing key (/s/<slug>, the sitemap, and every owner-resolving RPC),
-- so it must be globally unique. There is currently NO constraint, so duplicates may already
-- exist. RUN THIS DIAGNOSTIC FIRST and resolve any rows it returns (rename one site) before
-- creating the index, or the CREATE will fail:
--   SELECT lower(slug) s, count(*), array_agg(id) ids FROM public.sites GROUP BY 1 HAVING count(*) > 1;
-- Once there are no duplicates:
create unique index if not exists sites_slug_unique on public.sites (lower(slug));

-- ── 3. submit_message caps + throttle (bug 9) ─────────────────────────────────
-- The protective caps + honeypot lived only in the server action, but the RPC is granted to
-- anon and can be POSTed directly with the public anon key. Enforce the caps in the RPC so
-- every caller is bounded, and add a light per-owner rate limit so a loop of direct calls
-- can't flood an inbox.
create or replace function public.submit_message(p_slug text, p_name text, p_email text, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_recent int;
begin
  if length(coalesce(trim(p_body), '')) = 0 then return; end if;
  select owner_id into v_owner from public.sites where slug = p_slug limit 1;
  if v_owner is null then return; end if;
  -- Light flood guard: at most 20 messages per inbox per rolling minute.
  select count(*) into v_recent from public.messages
    where owner_id = v_owner and created_at > now() - interval '1 minute';
  if v_recent >= 20 then return; end if;
  insert into public.messages(owner_id, site_slug, name, email, body)
  values (
    v_owner,
    left(p_slug, 200),
    left(nullif(trim(p_name), ''), 120),
    left(nullif(trim(p_email), ''), 200),
    left(p_body, 5000)
  );
end; $$;
grant execute on function public.submit_message(text, text, text, text) to anon, authenticated;

-- Defense-in-depth length bounds on the columns themselves.
alter table public.messages drop constraint if exists messages_name_len;
alter table public.messages add constraint messages_name_len check (name is null or length(name) <= 120) not valid;
alter table public.messages drop constraint if exists messages_email_len;
alter table public.messages add constraint messages_email_len check (email is null or length(email) <= 200) not valid;
alter table public.messages drop constraint if exists messages_body_len;
alter table public.messages add constraint messages_body_len check (length(body) <= 5000) not valid;
