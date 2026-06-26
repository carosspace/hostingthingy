-- 020_video_storage.sql — Direct video uploads for the canvas "Video / Map" element.
-- Owners can upload an MP4/WebM/MOV/Ogg file that plays as a native <video> on the
-- published site. Videos are far too big to base64-inline into the page JSON (12 MB save
-- limit), so they live in Supabase Storage and the page only stores the public URL.
-- Idempotent — safe to re-run. Run in the platform's Supabase project: SQL Editor → paste → Run.
--
-- PREREQUISITE: this project's Supabase must have Storage enabled (the `storage` schema /
-- `storage.buckets` table must exist). Storage is on by default for hosted Supabase projects.

-- A PUBLIC bucket for site videos: world-readable (so a published <video src> just works),
-- capped at 100 MB per file, restricted to a small video MIME allowlist.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-videos', 'site-videos', true, 104857600, array['video/mp4','video/webm','video/quicktime','video/ogg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- READ: a public bucket is world-readable with NO policy needed (Storage serves
-- /storage/v1/object/public/<bucket>/... openly), so we add no SELECT policy.
--
-- WRITE: uploads happen ONLY through service-role signed upload URLs minted by the
-- createVideoUploadUrl server action (after it verifies auth + site ownership and chooses
-- the storage path itself). The service role bypasses RLS, so signed-URL uploads work
-- regardless of policies. We deliberately add NO anon/authenticated insert policy here —
-- deny-by-default write is intended, so nobody can upload directly with the anon key and
-- fill storage. The server gate is the only write path.
