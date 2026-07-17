-- =============================================================================
-- ADMIN IMAGE UPLOADS — storage write policies for the public image buckets
-- =============================================================================
-- The admin drawers (films, people) can now upload an image file instead of
-- only pasting a URL. Those uploads go from the admin's BROWSER, i.e. with the
-- anon key + their session — unlike the mirror_images cron, which uses the
-- service-role key and bypasses RLS entirely. Without an explicit INSERT policy
-- every browser upload fails with "new row violates row-level security policy".
--
-- Reads need no policy: these four buckets are public, so objects are served by
-- URL without consulting storage.objects. Granting SELECT here would only allow
-- LISTING the buckets, which 20260610000000_fix_security_lints.sql deliberately
-- removed (it exposes bucket structure). So writes only.
--
-- Depends on public.is_admin() (see sql/security_rls_hardening.sql), which reads
-- public.users.role server-side rather than the user-editable JWT metadata.
-- Safe to re-run.
-- =============================================================================

do $$
declare
  b text;
begin
  foreach b in array array['posters', 'backdrops', 'people', 'film-images'] loop
    -- Upload a new image.
    execute format('drop policy if exists %I on storage.objects', 'img_insert_admin_' || b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and public.is_admin())',
      'img_insert_admin_' || b, b
    );

    -- Overwrite an existing object (upsert path).
    execute format('drop policy if exists %I on storage.objects', 'img_update_admin_' || b);
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L and public.is_admin()) with check (bucket_id = %L and public.is_admin())',
      'img_update_admin_' || b, b, b
    );

    -- Remove an orphaned/replaced image.
    execute format('drop policy if exists %I on storage.objects', 'img_delete_admin_' || b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and public.is_admin())',
      'img_delete_admin_' || b, b
    );
  end loop;
end $$;
