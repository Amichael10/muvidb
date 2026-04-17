-- Create a helper function that reads the role while BYPASSING Row Level Security (RLS).
-- This breaks the infinite loop.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Drop your existing recursive RLS policies (adjust names if they differ in your database)
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Recreate the policy using the new helper function
-- Only admins can see ALL users:
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR public.get_auth_role() = 'admin'
);
