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
  console.log('Fetching all harvest_consensus credits from Sep 18-20...');
  const { data: credits, error } = await supabase
    .from('credits')
    .select('id, film_id, person_id, role, character_name, billing_order, source, created_at, people(id, name, slug, created_at), films(id, title)')
    .eq('source', 'harvest_consensus')
    .order('film_id')
    .order('billing_order', { ascending: true });

  if (error || !credits) {
    console.error('Error fetching credits:', error);
    return;
  }

  console.log(`Found ${credits.length} total harvest_consensus credits.`);

  // Group by film
  const filmsMap = new Map<string, any[]>();
  for (const c of credits) {
    const fId = c.film_id;
    if (!filmsMap.has(fId)) filmsMap.set(fId, []);
    filmsMap.get(fId)!.push(c);
  }

  console.log(`Found ${filmsMap.size} films with harvest_consensus credits.`);

  for (const [fId, creds] of filmsMap.entries()) {
    const filmTitle = creds[0]?.films?.title || fId;
    console.log(`\n======================================================`);
    console.log(`🎬 Film: "${filmTitle}" (${fId}) - ${creds.length} credits`);
    console.log(`======================================================`);

    for (const c of creds) {
      const pName = (c.people as any)?.name || 'UNKNOWN';
      const pId = c.person_id;
      console.log(`  [#${c.billing_order}] role=${c.role.padEnd(10)} char=${(c.character_name || '').padEnd(15)} person="${pName}" (${pId})`);
    }
  }
}

main().catch(console.error);
