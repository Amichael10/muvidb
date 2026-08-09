import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function fixCriticsPermissions() {
  console.log('--- FIXING CRITICS PERMISSIONS IN SUPABASE ---');

  // RLS SQL for critics & critic_reviews
  const sql = `
    -- Enable RLS on critics & critic_reviews if not enabled
    ALTER TABLE IF EXISTS public.critics ENABLE ROW LEVEL SECURITY;
    ALTER TABLE IF EXISTS public.critic_reviews ENABLE ROW LEVEL SECURITY;

    -- Grant permissions to authenticated and service_role
    GRANT ALL ON public.critics TO authenticated;
    GRANT ALL ON public.critics TO service_role;
    GRANT ALL ON public.critic_reviews TO authenticated;
    GRANT ALL ON public.critic_reviews TO service_role;

    -- Drop existing restrictive policies
    DROP POLICY IF EXISTS "Public critics read access" ON public.critics;
    DROP POLICY IF EXISTS "Admins manage critics" ON public.critics;
    DROP POLICY IF EXISTS "Public critic_reviews read access" ON public.critic_reviews;
    DROP POLICY IF EXISTS "Admins manage critic_reviews" ON public.critic_reviews;

    -- Public read policy
    CREATE POLICY "Public critics read access" ON public.critics
      FOR SELECT USING (true);

    -- Admin full management policy
    CREATE POLICY "Admins manage critics" ON public.critics
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
      ));

    -- Public read policy for reviews
    CREATE POLICY "Public critic_reviews read access" ON public.critic_reviews
      FOR SELECT USING (true);

    -- Admin full management policy for reviews
    CREATE POLICY "Admins manage critic_reviews" ON public.critic_reviews
      FOR ALL TO authenticated
      USING (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
      ))
      WITH CHECK (EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
      ));
  `;

  // Try calling rpc or sql execution if available
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('SQL Exec error (will try direct migration format):', error.message);
  } else {
    console.log('✓ Successfully applied critics RLS & permissions!');
  }
}

fixCriticsPermissions();
