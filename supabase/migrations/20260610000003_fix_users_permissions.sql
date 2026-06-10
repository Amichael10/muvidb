-- ============================================================
-- Fix public.users RLS infinite recursion & permissions
-- ============================================================

-- Ensure get_my_role is SECURITY DEFINER so it bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  RETURN COALESCE(v_role, 'fan');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the table has RLS enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 1. Drop existing policies to clear any infinite recursion loops
--    If an old policy had something like USING (get_my_role() = 'admin'),
--    it would cause an infinite loop when selecting from public.users.
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'users'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
    END LOOP;
END
$$;

-- 2. Create base reading policy (users can read their own data)
CREATE POLICY "Users can read own profile" ON public.users
FOR SELECT TO authenticated
USING (id = auth.uid());

-- 3. Admins can read all profiles
-- We use auth.jwt() to check admin status here to be extra safe against recursion
CREATE POLICY "Admins can read all profiles" ON public.users
FOR SELECT TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  OR get_my_role() IN ('admin', 'admin_limited')
);

-- 4. Admins can update profiles
CREATE POLICY "Admins can update profiles" ON public.users
FOR UPDATE TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  OR get_my_role() IN ('admin', 'admin_limited')
);

-- Ensure permissions are granted
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.users TO anon, authenticated;
