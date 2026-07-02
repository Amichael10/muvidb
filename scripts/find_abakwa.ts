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
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, slug, source, release_type, streaming_links, created_at')
    .ilike('title', '%abakwa%');
  
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(films, null, 2));
  }
}

check();
