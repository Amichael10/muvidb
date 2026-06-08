import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  (process.env.VITE_SUPABASE_URL || '').trim(),
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
);

async function check() {
  const filmId = '275a04e6-190a-4ae5-b2ed-db2fd530f147'; // Divine Lies
  const { data: credits, error } = await supabase
    .from('credits')
    .select('id, role, character_name, people(name)')
    .eq('film_id', filmId);
  
  if (error) {
    console.error(error);
  } else {
    console.log(`Credits for The Boss IS Mine: ${credits?.length || 0}`);
    console.log(JSON.stringify(credits, null, 2));
  }
}

check();
