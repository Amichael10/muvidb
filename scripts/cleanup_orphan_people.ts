
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrphanPeople() {
  console.log('--- Orphan People Check ---');
  
  // This is hard to do in a single query with Supabase without an RPC
  // So we'll just check for people with no photo/bio and then see if we should delete them
  
  const { data: people, error } = await supabase
    .from('people')
    .select('id, name')
    .is('photo_url', null)
    .is('biography', null)
    .limit(1000);

  if (error) {
    console.error('Error fetching people:', error);
    return;
  }

  console.log(`Checking ${people?.length} people with no photo/bio...`);
  
  let deleted = 0;
  for (const p of (people || [])) {
    const { count } = await supabase
      .from('credits')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', p.id);
      
    if (count === 0) {
      // No credits, delete
      const { error: delErr } = await supabase.from('people').delete().eq('id', p.id);
      if (!delErr) deleted++;
    }
  }

  console.log(`Deleted ${deleted} orphan people with no data.`);
}

checkOrphanPeople();
