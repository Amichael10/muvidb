import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { Agent, setGlobalDispatcher } from 'undici';

setGlobalDispatcher(new Agent({
  connect: { timeout: 60000 },
  headersTimeout: 60000,
  bodyTimeout: 60000
}));

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data: recentHarvestCredits } = await supabase
    .from('credits')
    .select('film_id, created_at, films(id, title)')
    .eq('source', 'harvest_consensus')
    .gte('created_at', '2026-09-18T00:00:00Z');

  const filmIds = [...new Set(recentHarvestCredits?.map(c => c.film_id) || [])];
  
  for (const fId of filmIds) {
    const { data: film } = await supabase.from('films').select('title, created_at').eq('id', fId).single();
    const { count } = await supabase.from('credits').select('*', { count: 'exact', head: true }).eq('film_id', fId);
    console.log(`- "${film?.title}" (${fId}) -> ${count} credits`);
  }
}

main().catch(console.error);
