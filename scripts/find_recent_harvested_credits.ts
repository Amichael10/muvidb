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
  console.log('Querying credits created in last 48 hours...');
  const { data: credits, error } = await supabase
    .from('credits')
    .select('id, film_id, person_id, role, character_name, billing_order, source, created_at, people(id, name, slug), films(id, title)')
    .gte('created_at', '2026-09-19T00:00:00Z')
    .order('created_at', { ascending: false });

  if (error || !credits) {
    console.error('Error fetching credits:', error);
    return;
  }

  console.log(`Total credits created since Sep 19: ${credits.length}`);

  // Group by film
  const filmMap = new Map<string, { title: string; count: number; sources: Set<string>; sampleCredits: any[] }>();
  credits.forEach(c => {
    const fId = c.film_id;
    const title = (c.films as any)?.title || 'Unknown';
    if (!filmMap.has(fId)) {
      filmMap.set(fId, { title, count: 0, sources: new Set(), sampleCredits: [] });
    }
    const entry = filmMap.get(fId)!;
    entry.count++;
    if (c.source) entry.sources.add(c.source);
    if (entry.sampleCredits.length < 5) {
      entry.sampleCredits.push({
        billing: c.billing_order,
        role: c.role,
        char: c.character_name,
        person: (c.people as any)?.name
      });
    }
  });

  console.log(`Across ${filmMap.size} films:`);
  for (const [fId, data] of filmMap.entries()) {
    console.log(`\n🎬 "${data.title}" (${fId}) - ${data.count} credits | sources: ${[...data.sources].join(', ')}`);
    data.sampleCredits.forEach(s => console.log(`   [#${s.billing}] ${s.role}: "${s.person}" ${s.char ? `as (${s.char})` : ''}`));
  }
}

main().catch(console.error);
