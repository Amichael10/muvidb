import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
);

async function test() {
  console.log('--- 1. Testing match_people_by_name RPC ---');
  const { data: rpcData, error: rpcErr } = await supabase.rpc('match_people_by_name', {
    p_name: 'bamiloye',
    p_limit: 8
  });
  console.log('RPC Error:', rpcErr);
  console.log('RPC Data count:', rpcData?.length);

  console.log('\n--- 2. Testing suggest_similar_people RPC ---');
  const { data: simData, error: simErr } = await supabase.rpc('suggest_similar_people', {
    p_name: 'bamiloye',
    p_limit: 8
  });
  console.log('Suggest Error:', simErr);
  console.log('Suggest Data count:', simData?.length);

  console.log('\n--- 3. Testing get_people_with_counts RPC (Used in AdminPeople.jsx) ---');
  const { data: adminData, error: adminErr } = await supabase.rpc('get_people_with_counts', {
    p_search: 'bamiloye',
    p_verified: 'all',
    p_spotlight: 'all',
    p_sort_col: 'popularity_score',
    p_sort_asc: false,
    p_offset: 0,
    p_limit: 25,
    p_status: 'all'
  });
  console.log('AdminPeople Error:', adminErr);
  console.log('AdminPeople Data count:', adminData?.length);
  if (adminData?.length) {
    console.log('Top 3:', adminData.slice(0, 3).map(p => ({ id: p.id, name: p.name })));
  }

  console.log('\n--- 4. Testing countQuery (Used in AdminPeople.jsx) ---');
  let countQuery = supabase
    .from('people')
    .select('*', { count: 'exact', head: true })
    .ilike('name', '%bamiloye%');
  const { count, error: countErr } = await countQuery;
  console.log('Count Error:', countErr, 'Count:', count);
}

test().catch(console.error);
