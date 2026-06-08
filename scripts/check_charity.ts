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
  const { data: person, error } = await supabase
    .from('people')
    .select('id, name, tmdb_id, photo_url, slug')
    .ilike('name', 'Charity Awoke')
    .maybeSingle();
  
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(person, null, 2));
  }
}

check();
