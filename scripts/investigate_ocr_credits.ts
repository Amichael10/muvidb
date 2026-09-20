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

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl!, supabaseKey!, {
  auth: { persistSession: false }
});

async function main() {
  console.log('Searching people...');

  // Check recent people created yesterday or last few days
  const yesterday = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: recentPeople, error: rErr } = await supabase
    .from('people')
    .select('id, name, slug, created_at, source')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false });

  console.log(`Found ${recentPeople?.length || 0} people created in last 48h.`);
  if (recentPeople && recentPeople.length > 0) {
    console.log('Sample recent people:', recentPeople.slice(0, 20));
  }

  // Search for receptionist or okonko or happiness
  const { data: q1 } = await supabase.from('people').select('id, name, slug, created_at').ilike('name', '%receptionist%');
  console.log('\nPeople with "receptionist":', q1);

  const { data: q2 } = await supabase.from('people').select('id, name, slug, created_at').ilike('name', '%okonk%');
  console.log('\nPeople with "okonk":', q2);

  const { data: q3 } = await supabase.from('people').select('id, name, slug, created_at').ilike('name', '%happi%');
  console.log('\nPeople with "happi":', q3);

  // Search credits with character_name or role or source
  const { data: creds } = await supabase
    .from('credits')
    .select('id, film_id, person_id, role, character_name, created_at, source')
    .gte('created_at', yesterday)
    .order('created_at', { ascending: false })
    .limit(30);
  console.log(`\nSample recent credits (${creds?.length || 0}):`, creds?.slice(0, 10));
}

main().catch(console.error);
