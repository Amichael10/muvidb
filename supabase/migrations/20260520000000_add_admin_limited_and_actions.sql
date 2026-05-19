-- Migration: Add admin_limited role and admin_actions logging table
-- Generated on 2026-05-20

-- 1. Add 'admin_limited' to user_role enum if it does not exist
-- Note: In PostgreSQL, we can use a DO block to safely check and add if supported, or run it directly.
-- In some envs, ALTER TYPE ADD VALUE cannot run in a transaction, so we run it directly.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin_limited';

-- 2. Create admin_actions table for tracking what admin level users have done
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  action_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  entity_type TEXT NOT NULL, -- 'film', 'person', 'credit', 'company'
  entity_id TEXT,
  entity_name TEXT,
  details JSONB DEFAULT '{}'::jsonb
);

-- 3. Enable RLS on admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- 4. Set RLS Policies for admin_actions
DROP POLICY IF EXISTS "Allow authenticated users to insert admin actions" ON public.admin_actions;
CREATE POLICY "Allow authenticated users to insert admin actions"
  ON public.admin_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to read their own admin actions" ON public.admin_actions;
CREATE POLICY "Allow users to read their own admin actions"
  ON public.admin_actions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR 
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- 5. Update admin_change_role to handle 'admin_limited'
CREATE OR REPLACE FUNCTION admin_change_role(target_user_id UUID, new_role TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_role TEXT;
BEGIN
    -- Security Check: Ensure caller is an admin
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Normalize role values to valid enum members
    v_normalized_role := CASE new_role
      WHEN 'admin'          THEN 'admin'
      WHEN 'admin_limited'  THEN 'admin_limited'
      WHEN 'professional'   THEN 'professional'
      WHEN 'pro'            THEN 'professional'
      WHEN 'fan'            THEN 'fan'
      WHEN 'user'           THEN 'fan'
      ELSE new_role -- Allow direct enum values if they match
    END;

    -- 1. Update public.users table (cast TEXT -> user_role enum explicitly)
    UPDATE public.users 
    SET role = v_normalized_role::user_role
    WHERE id = target_user_id;

    -- 2. Update auth.users raw_app_meta_data for RLS constraints & JWT claims
    UPDATE auth.users 
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb), 
      '{role}', 
      to_jsonb(v_normalized_role)
    ) 
    WHERE id = target_user_id;
END;
$$;
