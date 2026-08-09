import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

async function runSql() {
  const sql = `
    -- Enable RLS and set public policies on critics
    ALTER TABLE public.critics ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.critic_reviews ENABLE ROW LEVEL SECURITY;

    GRANT ALL ON public.critics TO authenticated;
    GRANT ALL ON public.critics TO service_role;
    GRANT ALL ON public.critics TO anon;

    GRANT ALL ON public.critic_reviews TO authenticated;
    GRANT ALL ON public.critic_reviews TO service_role;
    GRANT ALL ON public.critic_reviews TO anon;

    DROP POLICY IF EXISTS "Public critics read access" ON public.critics;
    DROP POLICY IF EXISTS "Admins manage critics" ON public.critics;
    DROP POLICY IF EXISTS "Allow all on critics" ON public.critics;

    CREATE POLICY "Allow all on critics" ON public.critics
      FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public critic_reviews read access" ON public.critic_reviews;
    DROP POLICY IF EXISTS "Admins manage critic_reviews" ON public.critic_reviews;
    DROP POLICY IF EXISTS "Allow all on critic_reviews" ON public.critic_reviews;

    CREATE POLICY "Allow all on critic_reviews" ON public.critic_reviews
      FOR ALL USING (true) WITH CHECK (true);
  `;

  console.log('Attempting SQL migration for critics permissions...');

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const text = await response.text();
    console.log('RPC exec_sql response:', response.status, text);
  } else {
    const data = await response.json();
    console.log('SQL Migration Success:', data);
  }
}

runSql();
