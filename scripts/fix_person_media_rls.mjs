import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function run() {
  const sql = `
    ALTER TABLE public.person_media ENABLE ROW LEVEL SECURITY;

    GRANT ALL ON public.person_media TO authenticated;
    GRANT ALL ON public.person_media TO service_role;
    GRANT SELECT ON public.person_media TO anon;

    DROP POLICY IF EXISTS "Authenticated users can upload person media" ON public.person_media;
    DROP POLICY IF EXISTS "Owners can update their person media" ON public.person_media;
    DROP POLICY IF EXISTS "Owners can delete their person media" ON public.person_media;
    DROP POLICY IF EXISTS "Allow all authenticated on person_media" ON public.person_media;
    DROP POLICY IF EXISTS "Allow authenticated to insert person_media" ON public.person_media;
    DROP POLICY IF EXISTS "Allow authenticated to update person_media" ON public.person_media;
    DROP POLICY IF EXISTS "Allow authenticated to delete person_media" ON public.person_media;
    DROP POLICY IF EXISTS "Service role full access on person_media" ON public.person_media;
    DROP POLICY IF EXISTS "Public can view approved person media" ON public.person_media;

    CREATE POLICY "Public can view approved person media" ON public.person_media
      FOR SELECT USING (status = 'approved' OR auth.uid() IS NOT NULL);

    CREATE POLICY "Allow authenticated to insert person_media" ON public.person_media
      FOR INSERT TO authenticated
      WITH CHECK (true);

    CREATE POLICY "Allow authenticated to update person_media" ON public.person_media
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "Allow authenticated to delete person_media" ON public.person_media
      FOR DELETE TO authenticated
      USING (true);

    CREATE POLICY "Service role full access on person_media" ON public.person_media
      FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  `;

  console.log('Fixing RLS policies on person_media...');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await res.text();
  console.log('Result:', res.status, text);
}

run().catch(console.error);
