-- ============================================================
-- Fix broken functions due to search_path = ''
-- Reverting the search_path to 'public' so internal unqualified
-- references (like 'users', 'films', etc.) can resolve properly.
-- ============================================================

ALTER FUNCTION public.calculate_popularity_score SET search_path = public;
ALTER FUNCTION public.update_popularity_on_view_change SET search_path = public;
ALTER FUNCTION public.update_popularity_on_credit_change SET search_path = public;
ALTER FUNCTION public.generate_slug SET search_path = public;
ALTER FUNCTION public.get_my_role SET search_path = public;
ALTER FUNCTION public.create_pro_profile SET search_path = public;
ALTER FUNCTION public.update_updated_at SET search_path = public;
ALTER FUNCTION public.refresh_film_average_rating SET search_path = public;
ALTER FUNCTION public.refresh_all_popularity_scores SET search_path = public;
ALTER FUNCTION public.batch_create_films_from_videos SET search_path = public;
ALTER FUNCTION public.auto_slug_films SET search_path = public;
ALTER FUNCTION public.auto_slug_people SET search_path = public;
ALTER FUNCTION public.auto_slug_channels SET search_path = public;
ALTER FUNCTION public.auto_slug_companies SET search_path = public;
ALTER FUNCTION public.batch_certify_films SET search_path = public;
ALTER FUNCTION public.get_people_with_counts SET search_path = public;
ALTER FUNCTION public.handle_new_user SET search_path = public;
ALTER FUNCTION public.handle_user_sync SET search_path = public;

-- merge_people has two signatures
ALTER FUNCTION public.merge_people(p_master_id uuid, p_duplicate_ids uuid[]) SET search_path = public;
ALTER FUNCTION public.merge_people(p_primary_id uuid, p_secondary_id uuid, p_metadata jsonb) SET search_path = public;

-- merge_films
ALTER FUNCTION public.merge_films(p_primary_id uuid, p_secondary_id uuid, p_metadata jsonb) SET search_path = public;

-- Also, explicitly ensure users can read their own row in public.users
-- This ensures AuthContext.jsx doesn't fall back to 'fan' from user_metadata
DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users FOR SELECT USING (id = auth.uid());
