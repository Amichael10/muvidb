-- FIXING ADMIN ACCESS: ONLY CREATE IF NOT EXISTS
DO $$
BEGIN
    -- Policy for Users
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'users' AND policyname = 'Admins can view all users'
    ) THEN
        CREATE POLICY "Admins can view all users" 
        ON public.users 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
    END IF;

    -- Policy for Profile Claims
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profile_claims' AND policyname = 'Admins can view all claims'
    ) THEN
        CREATE POLICY "Admins can view all claims" 
        ON public.profile_claims 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.users 
                WHERE id = auth.uid() AND role = 'admin'
            )
        );
    END IF;

    -- FIX RLS FOR FILMS/CINEMAS (Ensuring they are actually open if they weren't before)
    -- The user says they already exist, so we don't recreate them here.
    -- But we ensure RLS is ENABLED for these tables to prevent anon-writes from blocking.
    ALTER TABLE public.films ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.cinemas ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
END
$$;
