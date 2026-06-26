-- =============================================================================
-- CONTRIBUTIONS — image upload quarantine
-- =============================================================================
-- Adds file-upload support for contributed images (PNG/JPEG/WebP). Uploaded
-- images go into a PRIVATE 'contributions' bucket that only admins can read, so
-- un-moderated images are never publicly served. On approval the admin's browser
-- re-encodes the image (canvas → clean WebP, pixels only) into the public
-- 'film-images' bucket. Depends on is_admin(). Safe to re-run.
--
-- Run once in the Supabase SQL editor (after contributions_system.sql).
-- =============================================================================

-- Where the quarantined upload lives (path in the private bucket).
alter table public.contributions add column if not exists image_path text;

-- Private bucket — public = false so objects are NOT served without a signed URL.
insert into storage.buckets (id, name, public)
values ('contributions', 'contributions', false)
on conflict (id) do nothing;

-- Any signed-in user may upload into the quarantine bucket.
drop policy if exists "contrib_upload_authenticated" on storage.objects;
create policy "contrib_upload_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'contributions');

-- Only admins can read quarantined files (for review + signed URLs).
drop policy if exists "contrib_read_admin" on storage.objects;
create policy "contrib_read_admin" on storage.objects
  for select to authenticated
  using (bucket_id = 'contributions' and public.is_admin());

-- Only admins can delete quarantined files (cleanup after moderation).
drop policy if exists "contrib_delete_admin" on storage.objects;
create policy "contrib_delete_admin" on storage.objects
  for delete to authenticated
  using (bucket_id = 'contributions' and public.is_admin());
