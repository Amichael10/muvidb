import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const BAD_NAME_PATTERNS = [
  'Nothing Could Satisfy%',
  'Wole Ojo Ebere%',
  '%Nigerian%',
  '%Movie%',
  '%Film%',
  '%\)%'
];

async function cleanupBadStubs() {
  console.log('🧹 Cleaning up invalid person stubs...');
  for (const pattern of BAD_NAME_PATTERNS) {
    const { data: people } = await supabase.from('people').select('id, name').ilike('name', pattern);
    if (people && people.length > 0) {
      for (const p of people) {
        await supabase.from('credits').delete().eq('person_id', p.id);
        await supabase.from('people').delete().eq('id', p.id);
        console.log(`Deleted bad person stub: "${p.name}" (${p.id})`);
      }
    }
  }
}

cleanupBadStubs();
