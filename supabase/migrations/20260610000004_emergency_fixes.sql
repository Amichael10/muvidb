-- 1. Reset search_path for all functions affected by the lint script
ALTER FUNCTION public.calculate_popularity_score RESET search_path;
ALTER FUNCTION public.update_popularity_on_view_change RESET search_path;
ALTER FUNCTION public.update_popularity_on_credit_change RESET search_path;
ALTER FUNCTION public.generate_slug RESET search_path;
ALTER FUNCTION public.get_my_role RESET search_path;
ALTER FUNCTION public.create_pro_profile RESET search_path;
ALTER FUNCTION public.update_updated_at RESET search_path;
ALTER FUNCTION public.refresh_film_average_rating RESET search_path;
ALTER FUNCTION public.refresh_all_popularity_scores RESET search_path;
ALTER FUNCTION public.batch_create_films_from_videos RESET search_path;
ALTER FUNCTION public.auto_slug_films RESET search_path;
ALTER FUNCTION public.auto_slug_people RESET search_path;
ALTER FUNCTION public.auto_slug_channels RESET search_path;
ALTER FUNCTION public.auto_slug_companies RESET search_path;
ALTER FUNCTION public.batch_certify_films RESET search_path;
ALTER FUNCTION public.get_people_with_counts RESET search_path;
ALTER FUNCTION public.handle_new_user RESET search_path;
ALTER FUNCTION public.handle_user_sync RESET search_path;

-- Overloaded functions require arguments to be specified
ALTER FUNCTION public.merge_people(p_master_id uuid, p_duplicate_ids uuid[]) RESET search_path;
ALTER FUNCTION public.merge_people(p_primary_id uuid, p_secondary_id uuid, p_metadata jsonb) RESET search_path;
ALTER FUNCTION public.merge_films(p_primary_id uuid, p_secondary_id uuid, p_metadata jsonb) RESET search_path;

-- 2. Force the authenticated user to read their own profile without recursion
-- We already created a policy, but let's make sure there is no edge case.
-- Ensure we can always see our own row.
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid());

-- 3. Update the admins!
-- To ensure admins have admin rights, let's create a helper to promote a user to admin.
CREATE OR REPLACE FUNCTION public.force_promote_to_admin(user_email text)
RETURNS void AS $$
DECLARE
  target_id uuid;
BEGIN
  -- Find the user in auth.users (if accessible) or just public.users
  -- If we can't query auth.users from here, we will just update public.users by email if it exists
  SELECT id INTO target_id FROM auth.users WHERE email = user_email;
  
  IF target_id IS NOT NULL THEN
    -- Update public.users
    UPDATE public.users SET role = 'admin' WHERE id = target_id;
    -- Also update auth.users metadata if possible
    UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb WHERE id = target_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Provide a way for the user to execute it directly:
-- SELECT public.force_promote_to_admin('your_admin_email@example.com');
