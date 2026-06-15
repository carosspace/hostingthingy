-- Hosting Thingy — custom domains
-- Adds an optional custom domain (e.g. yourname.com) to a site.
-- Run in the platform's Supabase project: SQL Editor → paste → Run.

alter table public.sites add column if not exists domain text;
